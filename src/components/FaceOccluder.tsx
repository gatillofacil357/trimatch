"use client";

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TRIANGULATION } from '@/utils/triangulation';

interface FaceOccluderProps {
  webcamRef: React.RefObject<any>;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>;
}

export default function FaceOccluder({ webcamRef, trackingRef }: FaceOccluderProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Buffer Geometry to hold the face mesh
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Pre-allocate enough for 478 landmarks (Face Mesh standard)
    const positions = new Float32Array(478 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(TRIANGULATION);
    return geo;
  }, []);

  // Initialize offscreen canvas for color sampling
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 10;
      canvasRef.current.height = 10;
    }
  }, []);

  useFrame(() => {
    const { landmarks, viewport } = trackingRef.current;
    if (meshRef.current && landmarks.length > 0 && viewport.vWidth > 0) {
      const positionAttribute = meshRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      
      // We will pull the topmost landmarks upwards to cover the hair
      // Forehead landmarks: 10, 151, 9, 8
      for (let i = 0; i < landmarks.length; i++) {
        let lp = { ...landmarks[i] };
        
        // Stretch the top of the head vertices upwards to create a bald cap
        if (i === 10 || i === 151 || i === 9 || i === 8 || i === 338 || i === 109 || i === 297 || i === 67) {
            lp.y -= 0.15; // Pull up
            lp.z -= 0.05; // Pull back slightly
        }

        // MIRRORING: Flip X axis (0.5 - x)
        const x = (0.5 - lp.x) * viewport.vWidth;
        const y = -(lp.y - 0.5) * viewport.vHeight;
        const z = -lp.z * 5.0; 
        
        positionAttribute.setXYZ(i, x, y, z);
      }
      positionAttribute.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();

      // Sample Skin Color from forehead (landmark 151 is top of forehead)
      if (webcamRef.current?.video && canvasRef.current && materialRef.current) {
        const video = webcamRef.current.video;
        if (video.readyState >= 2) {
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                // Approximate video to landmark coordinates
                const foreheadLp = landmarks[151];
                const vx = Math.floor(foreheadLp.x * video.videoWidth);
                const vy = Math.floor(foreheadLp.y * video.videoHeight);
                
                // Ensure within bounds
                if (vx > 0 && vx < video.videoWidth && vy > 0 && vy < video.videoHeight) {
                    ctx.drawImage(video, vx - 5, vy - 5, 10, 10, 0, 0, 10, 10);
                    const pixel = ctx.getImageData(5, 5, 1, 1).data;
                    
                    // Smooth color transition
                    const r = pixel[0] / 255;
                    const g = pixel[1] / 255;
                    const b = pixel[2] / 255;
                    
                    const uniforms = materialRef.current.uniforms;
                    uniforms.uColor.value.lerp(new THREE.Vector3(r, g, b), 0.1);
                }
            }
        }
      }
    }
  });

  // GLSL Shader for smooth blending edge
  const vertexShader = `
    varying vec2 vUv;
    varying float vY;
    void main() {
      vUv = uv;
      vY = position.y; // World/local Y position to calculate vertical fade
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // The fragment shader creates a smooth gradient that is opaque at the top (to hide hair)
  // and fades smoothly to transparent at the bottom (to blend with the skin/forehead)
  const fragmentShader = `
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vY;

    void main() {
      // The mask is pulled up around y = 0.0 to y = 0.5 roughly
      // Force strongly visible alpha to guarantee occlusion over video
      float alpha = smoothstep(-0.2, 0.4, vUv.y); 

      // Fade the edges horizontally
      float edgeX = 1.0 - abs(vUv.x * 2.0 - 1.0);
      alpha *= smoothstep(0.0, 0.4, edgeX);

      // Enforce limits
      alpha = clamp(alpha, 0.0, 1.0);

      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={1}>
      <shaderMaterial 
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uColor: { value: new THREE.Vector3(0.8, 0.6, 0.5) } }}
        transparent={true}
        side={THREE.DoubleSide} 
        depthWrite={true}
      />
    </mesh>
  );
}
