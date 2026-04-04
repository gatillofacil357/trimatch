"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHADERS: Professional Hair Shader v5.2
const hairVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const hairFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uBaseColor;
  uniform vec3 uRootColor;
  uniform float uAlpha;
  uniform float uBrightness;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec2 x) {
      vec2 p = floor(x); vec2 f = fract(x);
      f = f*f*(3.0-2.0*f);
      float n = p.x + p.y*57.0;
      return mix(mix(hash(n+0.0), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
  }

  void main() {
      // 1. ANATOMICAL BLENDING
      float feather = smoothstep(0.0, 0.15, vUv.y); 
      
      // 2. HAIR STRAND TEXTURE (Stronger for realism)
      float hairStrands = noise(vUv * vec2(80.0, 220.0)) * 0.5 + 0.75;
      
      // 3. COLOR GRADIENT
      vec3 hairColor = mix(uRootColor, uBaseColor, vUv.y);
      hairColor *= hairStrands; 
      
      // 4. RIM LIGHTING
      float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
      vec3 rimLight = vec3(1.0, 1.0, 0.95) * fresnel * 0.45;
      
      vec3 finalColor = hairColor * uBrightness + rimLight;
      gl_FragColor = vec4(finalColor, uAlpha * feather);
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

  const meshColor = color === '#222222' ? '#3d2b26' : color;
  const colors = useMemo(() => {
    const main = new THREE.Color(meshColor);
    const root = main.clone().multiplyScalar(0.1);
    return { main, root };
  }, [meshColor]);

  const uniforms = useMemo(() => ({
    uBaseColor: { value: colors.main },
    uRootColor: { value: colors.root },
    uAlpha: { value: 0.96 }, 
    uBrightness: { value: 2.2 }, 
  }), [colors]);

  useFrame(() => {
    const { landmarks, matrix, viewport } = trackingRef.current;
    
    if (groupRef.current && landmarks.length > 10 && viewport.vWidth > 0) {
      const forehead = landmarks[10];
      const nose = landmarks[1];
      const leftTemple = landmarks[234];
      const rightTemple = landmarks[454];

      const nx = (0.5 - forehead.x) * viewport.vWidth; 
      const ny = -(forehead.y - 0.5) * viewport.vHeight;
      const nz = -nose.z * 4.8;

      // POSITION: v6.2 LOW LANDING
      const lerpFactor = 0.25;
      // Bringing the hair much lower to the forehead level (near eyebrows)
      const targetPos = new THREE.Vector3(nx, ny - 0.75, nz + 0.65); 
      groupRef.current.position.lerp(targetPos, lerpFactor);
      
      // ROTATION
      if (matrix) {
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          matrix.decompose(pos, quat, scl);
          groupRef.current.quaternion.slerp(quat, lerpFactor);
      }

      // SCALE: v6.2 WIDER & FLATTER (Fade Profile)
      const templeDist = Math.sqrt(
        Math.pow(rightTemple.x - leftTemple.x, 2) + 
        Math.pow(rightTemple.y - leftTemple.y, 2)
      );
      const baseScale = templeDist * viewport.vWidth * 1.45; 
      const targetScale = new THREE.Vector3(baseScale * 1.15, baseScale * 0.55, baseScale * 1.15);
      groupRef.current.scale.lerp(targetScale, lerpFactor);
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
      polygonOffset: true,
      polygonOffsetFactor: -4, 
    });
  }, [uniforms]);

  const renderStyle = () => {
    return (
      <mesh position={[0, 0.55, 0.0]}>
        <sphereGeometry args={[0.55, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
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
