"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TRIANGULATION } from '@/utils/triangulation';

interface FaceOccluderProps {
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>;
}

export default function FaceOccluder({ trackingRef }: FaceOccluderProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Buffer Geometry to hold the face mesh
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Pre-allocate enough for 478 landmarks (Face Mesh standard)
    const positions = new Float32Array(478 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(TRIANGULATION);
    return geo;
  }, []);

  useFrame(() => {
    const { landmarks, viewport } = trackingRef.current;
    if (meshRef.current && landmarks.length > 0 && viewport.vWidth > 0) {
      const positionAttribute = meshRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      
      for (let i = 0; i < landmarks.length; i++) {
        const lp = landmarks[i];
        
        // MIRRORING: Flip X axis (0.5 - x)
        const x = (0.5 - lp.x) * viewport.vWidth;
        const y = -(lp.y - 0.5) * viewport.vHeight;
        const z = -lp.z * 5.0; 
        
        positionAttribute.setXYZ(i, x, y, z);
      }
      
      positionAttribute.needsUpdate = true;
      // We don't necessarily need to compute vertex normals every frame for an occluder
      // since it's invisible (colorWrite: false).
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial 
        colorWrite={false} 
        depthWrite={true} 
        side={THREE.DoubleSide} 
        polygonOffset={true}
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}
