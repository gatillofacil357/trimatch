"use client";

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TRIANGULATION } from '@/utils/triangulation';

interface BeardFilterProps {
  webcamRef: React.RefObject<any>;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>;
}

export default function BeardFilter({ webcamRef, trackingRef }: BeardFilterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(478 * 3);
    const uvs = new Float32Array(478 * 2);
    
    // UV map is critical for the shader to know where the chin/beard is vs the forehead
    // Typically MediaPipe landmarks have x,y covering 0-1 range roughly, 0,0 top-left
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(TRIANGULATION);
    return geo;
  }, []);

  useFrame(() => {
    const { landmarks, viewport } = trackingRef.current;
    if (meshRef.current && landmarks.length > 0 && viewport.vWidth > 0) {
      const positionAttribute = meshRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const uvAttribute = meshRef.current.geometry.getAttribute('uv') as THREE.BufferAttribute;
      
      for (let i = 0; i < landmarks.length; i++) {
        let lp = landmarks[i];
        
        // MIRRORING: Flip X axis (0.5 - x) like we do for video feed alignment
        const x = (0.5 - lp.x) * viewport.vWidth;
        const y = -(lp.y - 0.5) * viewport.vHeight;
        const z = -lp.z * 5.0; 
        
        positionAttribute.setXYZ(i, x, y, z);
        
        // Use normalized landmarks directly as UVs to power our localized shader
        uvAttribute.setXY(i, lp.x, lp.y); 
      }
      positionAttribute.needsUpdate = true;
      uvAttribute.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();
    }
  });

  // GLSL Shader for smooth blending beard filter
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv; // Passing the landmark x,y coords downwards (0 to 1)
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // The fragment shader filtering to the lower jaw and adding hair texture
  const fragmentShader = `
    uniform vec3 uColor;
    varying vec2 vUv;

    // Pseudo-random noise function for hair strands
    float rand(vec2 co) {
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }
    
    // Value noise
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = rand(i);
        float b = rand(i + vec2(1.0, 0.0));
        float c = rand(i + vec2(0.0, 1.0));
        float d = rand(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      // Create high-frequency directional noise to look like short hairs
      // Scale X massively more than Y to create vertical/diagonal strands
      vec2 hairUv = vUv * vec2(150.0, 40.0);
      
      // Arc the strands so they curve around the chin somewhat
      hairUv.x += sin(vUv.y * 3.14) * 5.0; 
      
      float hairTex = noise(hairUv);
      // Sharpen the noise to make them look like distinct thin hairs instead of clouds
      hairTex = smoothstep(0.4, 0.8, hairTex);

      // --- MASK CALCULATION ---
      // Vertical Fade: Fade from cheeks (y=0.6) to chin (y=0.9)
      float verticalFade = smoothstep(0.65, 0.95, vUv.y); 
      
      // Horizontal Fade: Soft edges near ears
      float edgeX = 1.0 - abs(vUv.x - 0.5) * 2.0; 
      float horizontalFade = smoothstep(0.1, 0.5, edgeX);

      // Mouth Cutout
      float dx = (vUv.x - 0.5) * 2.0; 
      float dy = (vUv.y - 0.75) * 2.5; 
      float mouthDist = dx*dx + dy*dy;
      float mouthHole = smoothstep(0.06, 0.18, mouthDist); 

      // Combine spatial mask
      float maskAlpha = verticalFade * horizontalFade * mouthHole;
      
      // Modulate the mask heavily by the hair texture so we only see the "strands"
      // not a solid block. Adding a little base alpha so it's not totally sparse.
      float finalAlpha = maskAlpha * (hairTex * 0.9 + 0.1);
      
      // Boost density where the mask is strongest (chin)
      finalAlpha *= 1.2;

      // Ensure NO rendering at all if alpha is practically zero
      if(finalAlpha < 0.01) discard;

      // Darken the color in the "strand" centers for depth
      vec3 finalColor = uColor * (0.5 + hairTex * 0.5);

      gl_FragColor = vec4(finalColor, finalAlpha);    
    }
  `;

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={10}>
      <shaderMaterial 
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uColor: { value: new THREE.Vector3(0.1, 0.05, 0.02) } }} // Dark brownish-black beard
        transparent={true}
        side={THREE.DoubleSide} 
        depthWrite={false}
      />
    </mesh>
  );
}
