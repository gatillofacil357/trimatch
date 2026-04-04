"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// PRO ENGINE SHADER: High-Fidelity Anisotropic + Ambient Occlusion integration
const hairVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vTangent;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Smooth procedural sway
    float sway = sin(uTime * 2.0 + pos.y * 3.0) * 0.008 * step(0.2, pos.y);
    pos.x += sway;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    vTangent = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
    
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const hairFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vTangent;

  uniform vec3 uBaseColor;
  uniform vec3 uRootColor;
  uniform float uAlpha;
  uniform float uBrightness;

  void main() {
    // 1. Root-to-Tip Gradient
    float mixFactor = clamp(vUv.y * 1.5, 0.0, 1.0);
    vec3 baseColor = mix(uRootColor, uBaseColor, mixFactor);

    // 2. Kajiya-Kay Anisotropy (Highlights)
    vec3 L = normalize(vec3(0.5, 1.5, 0.5)); 
    vec3 V = normalize(vViewDir);
    vec3 T = normalize(vTangent);
    float dotLT = dot(L, T);
    float dotVT = dot(V, T);
    float sinLT = sqrt(1.0 - dotLT * dotLT);
    float sinVT = sqrt(1.0 - dotVT * dotVT);
    float strandSpec = pow(max(0.0, dotLT * dotVT + sinLT * sinVT), 35.0);
    
    // 3. Hair Texture Grain
    float noise = fract(sin(dot(vUv.xy * 20.0, vec2(12.9898, 78.233))) * 43758.5453);
    
    // 4. Soft Transparency for better skin blending
    float edgeAlpha = smoothstep(0.0, 0.25, vUv.y); 
    
    // 5. Ambient Occlusion (Darken the hairline contact)
    float ao = smoothstep(0.1, 0.45, vUv.y);

    vec3 litColor = (baseColor * 1.6 * uBrightness * ao) + (strandSpec * 0.25);
    litColor += noise * 0.05;

    gl_FragColor = vec4(litColor, uAlpha * edgeAlpha);
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

  // Deep Espresso Mahogany Default
  const meshColor = color === '#222222' ? '#3d2b26' : color;

  const colors = useMemo(() => {
    const main = new THREE.Color(meshColor);
    const root = main.clone().multiplyScalar(0.1);
    return { main, root };
  }, [meshColor]);

  const uniforms = useMemo(() => ({
    uBaseColor: { value: colors.main },
    uRootColor: { value: colors.root },
    uAlpha: { value: 1.0 },
    uBrightness: { value: 1.35 },
    uTime: { value: 0 }
  }), [colors]);

  useFrame((state) => {
    const { landmarks, matrix, viewport } = trackingRef.current;
    if (groupRef.current && landmarks.length > 0 && matrix && viewport.vWidth > 0) {
      // 1. EXTRACT TRANSFORMATION FROM MATRIX
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, quat, scale);

      // 2. MIRRORING & POSITIONING (Using Forehead Anchor 10)
      const forehead = landmarks[10];
      const nose = landmarks[1];
      
      // Flip X for Mirrored mode
      const nx = (0.5 - forehead.x) * viewport.vWidth; 
      const ny = -(forehead.y - 0.5) * viewport.vHeight;
      const nz = -nose.z * 5.0;

      // 3. SMOOTHING (Lerp/Slerp)
      const lerpFactor = 0.3; // Responsive smoothing
      
      // Update Position
      groupRef.current.position.lerp(new THREE.Vector3(nx, ny - 0.05, nz), lerpFactor);
      
      // Update Rotation (Extract and flip Y rotation for mirrored mode)
      const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
      const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-euler.x, euler.y, -euler.z, 'XYZ')
      );
      groupRef.current.quaternion.slerp(targetQuat, lerpFactor);

      // 4. DYNAMIC SCALE (Temple Dist: 234 to 454)
      const leftTemple = landmarks[234];
      const rightTemple = landmarks[454];
      const templeDist = Math.sqrt(
        Math.pow(rightTemple.x - leftTemple.x, 2) + 
        Math.pow(rightTemple.y - leftTemple.y, 2)
      );
      const worldScale = templeDist * viewport.vWidth * 1.35;
      
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, worldScale, lerpFactor));
    }
    if (uniforms) uniforms.uTime.value = state.clock.getElapsedTime();
  });

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: hairVertexShader,
      fragmentShader: hairFragmentShader,
      transparent: true,
      side: THREE.FrontSide
    });
  }, [uniforms]);

  const renderStyle = () => {
    // PRO COMPOSITE GEOMETRIES: Multiple parts to follow the skull 3D surface
    switch (styleId) {
      case 'fade':
      case 'buzz':
        return (
          <mesh position={[0, 0.48, 0.05]} scale={[1.08, 0.52, 1.25]}>
            <sphereGeometry args={[0.55, 64, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <primitive object={shaderMaterial} attach="material" />
          </mesh>
        );
      case 'undercut':
        return (
          <group>
            {/* Top Volume */}
            <mesh position={[0, 0.65, 0.1]} scale={[0.88, 0.42, 1.25]}>
               <sphereGeometry args={[0.5, 64, 32]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Side Taper */}
            <mesh position={[0, 0.38, 0]} scale={[1.15, 0.48, 1.15]}>
               <sphereGeometry args={[0.55, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      case 'pompadour':
        return (
          <group>
            {/* Massive Front Volume */}
            <mesh position={[0, 0.72, 0.15]} scale={[0.85, 0.75, 1.35]}>
               <sphereGeometry args={[0.55, 64, 64]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Scalp Hugger */}
            <mesh position={[0, 0.46, 0]} scale={[1.08, 0.52, 1.15]}>
               <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      case 'textured':
        return (
          <mesh position={[0, 0.52, 0.1]} scale={[1.05, 0.68, 1.22]}>
            <sphereGeometry args={[0.55, 64, 32, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <primitive object={shaderMaterial} attach="material" />
          </mesh>
        );
      case 'long':
        return (
          <group>
            <mesh position={[0, 0.48, 0]} scale={[1.1, 0.55, 1.15]}>
               <sphereGeometry args={[0.5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
            <mesh position={[0, 0.15, -0.32]} rotation={[1.15, 0, 0]} scale={[1.15, 1.35, 1.45]}>
               <coneGeometry args={[0.5, 1.8, 64]} />
               <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={groupRef}>
        {renderStyle()}
    </group>
  );
}
