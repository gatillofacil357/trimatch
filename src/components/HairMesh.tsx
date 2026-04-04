"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHADERS: Sculpting Engine v7.0
const hairVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  
  uniform float uSideSqueeze;
  uniform float uTopVolume;

  void main() {
    vUv = uv;
    
    // SCULPTING LOGIC: Transform generic sphere into haircut silhouette
    // sideFactor: 1.0 at temple level, 0.0 at top
    float sideFactor = 1.0 - smoothstep(0.0, 1.1, position.y);
    // topFactor: 1.0 at the crown, 0.0 at face level
    float topFactor = smoothstep(0.2, 1.0, position.y);
    
    vec3 sculptedPos = position;
    // 1. Squeeze sides (The Fade effect)
    sculptedPos.x *= mix(1.0, uSideSqueeze, sideFactor);
    // 2. Extrude/Flatten top (The Volume effect)
    sculptedPos.y *= mix(1.0, uTopVolume, topFactor);
    // 3. Flatten back (to avoid dome depth)
    sculptedPos.z *= mix(1.0, 0.85, 1.0 - topFactor);

    vec4 worldPosition = modelMatrix * vec4(sculptedPos, 1.0);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(sculptedPos, 1.0);
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
      float feather = smoothstep(0.0, 0.15, vUv.y); 
      float hairStrands = noise(vUv * vec2(100.0, 250.0)) * 0.5 + 0.75;
      
      vec3 hairColor = mix(uRootColor, uBaseColor, vUv.y);
      hairColor *= hairStrands; 
      
      float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
      vec3 rimLight = vec3(1.0, 1.0, 0.95) * fresnel * 0.4;
      
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

  // SCULPTING PRESETS (v7.0)
  const sculptingProps = useMemo(() => {
    switch (styleId) {
      case 'fade':
        return { sideSqueeze: 0.82, topVolume: 1.35 };
      case 'buzz':
        return { sideSqueeze: 0.96, topVolume: 1.05 };
      case 'undercut':
        return { sideSqueeze: 0.78, topVolume: 1.55 };
      default:
        return { sideSqueeze: 1.0, topVolume: 1.0 };
    }
  }, [styleId]);

  const uniforms = useMemo(() => ({
    uBaseColor: { value: colors.main },
    uRootColor: { value: colors.root },
    uAlpha: { value: 0.96 }, 
    uBrightness: { value: 2.3 }, 
    uSideSqueeze: { value: sculptingProps.sideSqueeze },
    uTopVolume: { value: sculptingProps.topVolume },
  }), [colors, sculptingProps]);

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

      // v7.0 Precision Landing
      const lerpFactor = 0.25;
      const targetPos = new THREE.Vector3(nx, ny - 0.8, nz + 0.6); 
      groupRef.current.position.lerp(targetPos, lerpFactor);
      
      if (matrix) {
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          matrix.decompose(pos, quat, scl);
          groupRef.current.quaternion.slerp(quat, lerpFactor);
      }

      // v7.0 Adaptive Width
      const templeDist = Math.sqrt(
        Math.pow(rightTemple.x - leftTemple.x, 2) + 
        Math.pow(rightTemple.y - leftTemple.y, 2)
      );
      const baseScale = templeDist * viewport.vWidth * 1.5; 
      const targetScale = new THREE.Vector3(baseScale, baseScale * 0.6, baseScale * 1.1);
      groupRef.current.scale.lerp(targetScale, lerpFactor);
      
      // Sync Uniforms
      uniforms.uSideSqueeze.value = sculptingProps.sideSqueeze;
      uniforms.uTopVolume.value = sculptingProps.topVolume;
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
      <mesh position={[0, 0.65, 0.0]}>
        <sphereGeometry args={[0.55, 128, 64, 0, Math.PI * 2, 0, Math.PI / 2.0]} />
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
