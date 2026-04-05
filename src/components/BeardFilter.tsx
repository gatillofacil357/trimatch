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

  // The fragment shader filters to just the lower jaw / chin area
  const fragmentShader = `
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      // vUv.y ranges from roughly 0.0 (top of forehead) to 1.0 (bottom of chin)
      // We want the beard on the lower half (y > 0.6)
      
      // Calculate alpha based on vertical position (fade from cheeks to dark chin)
      // At y=0.6 (cheeks), alpha is 0.0. At y=0.85 (jaw/chin), alpha is 0.8
      float verticalFade = smoothstep(0.65, 0.9, vUv.y); 
      
      // Fade the edges horizontally so it doesn't bleed out of the face sides
      // Center is x=0.5. Edges are x=0.0 and x=1.0. 
      // We distance from center -> diff from 0.5. 0.0 at edges, 1.0 at center.
      float edgeX = 1.0 - abs(vUv.x - 0.5) * 2.0; 
      // Soften horizontal edges
      float horizontalFade = smoothstep(0.1, 0.5, edgeX);

      // Hole for the mouth: Landmarks around mouth roughly y=0.7 to 0.8, x=0.4 to 0.6
      // Create a soft inverted ellipse for the mouth
      float dx = (vUv.x - 0.5) * 2.0; // -1 to 1
      float dy = (vUv.y - 0.75) * 2.5; // Scale Y to make an ellipse
      float mouthDist = dx*dx + dy*dy;
      float mouthHole = smoothstep(0.04, 0.15, mouthDist); // Alpha is 0 near center, 1 outside

      // Combine Alpha
      float alpha = verticalFade * horizontalFade * mouthHole;
      
      // Boost the maximum opacity a bit for the darkest part of the beard
      alpha *= 0.85;

      // Ensure NO rendering at all if alpha is practically zero to save depth buffer
      if(alpha < 0.01) discard;

      gl_FragColor = vec4(uColor, alpha);    
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
