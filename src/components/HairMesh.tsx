"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHADERS: Ultra-Simple for Visibility Test v4.8
const hairVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const hairFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uAlpha;
  void main() {
    // SOLID NEON GREEN TEST
    gl_FragColor = vec4(0.0, 1.0, 0.0, uAlpha);
  }
`;

interface HairMeshProps {
  styleId: string;
  color: string;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>;
  shape?: string;
}

export default function HairMesh({ styleId, color, trackingRef, shape = 'ovalado' }: HairMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({
    uAlpha: { value: 1.0 },
  }), []);

  useFrame((state) => {
    const { landmarks, matrix, viewport } = trackingRef.current;
    
    // SAFETY CHECK: Must have landmarks and viewport calibrated
    if (groupRef.current && landmarks.length > 10 && viewport.vWidth > 0) {
      
      const forehead = landmarks[10];
      const nose = landmarks[1];
      
      // Calculate screen positions
      const nx = (0.5 - forehead.x) * viewport.vWidth; 
      const ny = -(forehead.y - 0.5) * viewport.vHeight;
      const nz = -nose.z * 5.0; // Base depth

      // POSITION: v4.8 DEBUG
      // We force it slightly in front of the forehead
      groupRef.current.position.set(nx, ny - 0.1, nz + 0.8);
      
      // ROTATION: Fallback to basic tilt if matrix is missing
      if (matrix) {
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(pos, quat, scale);
        const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
        groupRef.current.rotation.set(-euler.x * 0.9, euler.y, -euler.z);
      } else {
        groupRef.current.rotation.set(0, 0, 0);
      }

      // SCALE: Forced visible size
      const baseScale = 2.8; 
      groupRef.current.scale.set(baseScale, baseScale * 0.6, baseScale);
    }
  });

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: hairVertexShader,
      fragmentShader: hairFragmentShader,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: true,
    });
  }, [uniforms]);

  const renderStyle = () => {
    // For v4.8 test, all styles render the same solid green cap
    return (
      <mesh position={[0, 0.4, 0.0]} scale={[1.0, 1.0, 1.0]}>
        <sphereGeometry args={[0.5, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <primitive object={shaderMaterial} attach="material" />
      </mesh>
    );
  };

  return (
    <group ref={groupRef}>
        {renderStyle()}
    </group>
  );
}
