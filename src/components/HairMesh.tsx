"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// PRO ENGINE SHADER v3.0: High-Fidelity Anisotropic + Strand Texture + Rim Light
const hairVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vTangent;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Micro-sway for life-like movement
    float sway = sin(uTime * 1.5 + pos.y * 5.0) * 0.005 * step(0.1, pos.y);
    pos.x += sway;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - vWorldPos);
    vTangent = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const hairFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vTangent;

  uniform vec3 uBaseColor;
  uniform vec3 uRootColor;
  uniform float uAlpha;
  uniform float uBrightness;

  // Pseudo-random noise for strands
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 V = normalize(vViewDir);
    vec3 N = normalize(vNormal);
    vec3 T = normalize(vTangent);
    
    // 1. ANISOTROPIC HIGHLIGHTS (Kajiya-Kay)
    vec3 L = normalize(vec3(0.5, 2.0, 1.0)); // Top-front light
    float dotLT = dot(L, T);
    float dotVT = dot(V, T);
    float highlight = pow(max(0.0, dotLT * dotVT + sqrt(1.0 - dotLT*dotLT) * sqrt(1.0 - dotVT*dotVT)), 40.0);
    
    // 2. STRAND TEXTURE
    float strand = hash(vec2(vUv.x * 250.0, vUv.y * 10.0));
    float grain = mix(0.85, 1.15, strand);

    // 3. COLOR GRADIENT (Root to Tip)
    float mixFactor = clamp(vUv.y * 1.2, 0.0, 1.0);
    vec3 baseColor = mix(uRootColor, uBaseColor, mixFactor);
    
    // 4. RIM LIGHTING (Depth & Separation)
    float rim = 1.0 - max(0.0, dot(V, N));
    rim = pow(rim, 4.0) * 0.4;

    // 5. FEATHERING (Soft edges for scalp blending)
    float feather = smoothstep(0.0, 0.35, vUv.y); 
    
    // Final Composition
    vec3 finalColor = (baseColor * uBrightness * grain) + (highlight * 0.3) + (rim * vec3(1.0));
    
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
    uBrightness: { value: 2.2 }, // Boosted for visibility
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

      // 2. ANATOMICAL ANCHORING (Scalp Center)
      // We use the midpoint between temples (234, 454) as the horizontal center
      // And the forehead (10) as the vertical birth point.
      const forehead = landmarks[10];
      const leftTemple = landmarks[234];
      const rightTemple = landmarks[454];
      
      // Flip X for Mirrored mode
      const nx = (0.5 - forehead.x) * viewport.vWidth; 
      const ny = -(forehead.y - 0.5) * viewport.vHeight;
      
      // Calculate depth from nose (landmark 1) and average forehead Z
      const nose = landmarks[1];
      const nz = -nose.z * 4.5; // Depth factor

      // 3. SMOOTHING (Lerp/Slerp)
      const lerpFactor = 0.25; 
      
      // POSITION: CRITICAL FIX - Much lower to sit ON the hairline
      // We target landmark 10 (top forehead) as the very top of the scalp, 
      // so the hair group must be lowered even more.
      const anchorY = ny - 0.45; // Significantly lower
      const anchorZ = nz - 0.15; // Closer to face
      
      groupRef.current.position.lerp(new THREE.Vector3(nx, anchorY, anchorZ), lerpFactor);
      
      // ROTATION: Sync tilt more naturally
      const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
      const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-euler.x * 0.9, euler.y, -euler.z, 'XYZ')
      );
      groupRef.current.quaternion.slerp(targetQuat, lerpFactor);

      // 4. DYNAMIC SCALE (Anatomical Width)
      const templeDist = Math.sqrt(
        Math.pow(rightTemple.x - leftTemple.x, 2) + 
        Math.pow(rightTemple.y - leftTemple.y, 2)
      );
      
      const headWidthScale = templeDist * viewport.vWidth * 1.52; // Exact width from temples
      
      // Face Shape Modifiers
      let scaleX = 1.0;
      let scaleY = 1.0;
      
      if (shape === 'redondo') { scaleY = 1.08; scaleX = 0.96; }
      else if (shape === 'alargado') { scaleX = 1.05; scaleY = 0.92; }
      else if (shape === 'cuadrado') { scaleX = 1.04; }
      
      const targetScaleX = headWidthScale * scaleX;
      const targetScaleY = headWidthScale * scaleY * 1.15; // More vertical coverage
      const targetScaleZ = headWidthScale * 1.15; // Depth
      
      groupRef.current.scale.lerp(new THREE.Vector3(targetScaleX, targetScaleY, targetScaleZ), lerpFactor);
    }
    if (uniforms) uniforms.uTime.value = state.clock.getElapsedTime();
  });

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: hairVertexShader,
      fragmentShader: hairFragmentShader,
      transparent: true,
      side: THREE.FrontSide, // FrontSide for hair strands
      depthWrite: true,
    });
  }, [uniforms]);

  const renderStyle = () => {
    // SCULPTED GEOMETRY: Compound primitives to avoid "dome" effect
    switch (styleId) {
      case 'fade':
        return (
          <group>
            {/* Top Volume - Sitting lower */}
            <mesh position={[0, 0.28, 0.05]} scale={[0.9, 0.5, 1.2]}>
                <sphereGeometry args={[0.5, 64, 32]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Tapered Sides - More anatomical */}
            <mesh position={[0, 0.12, -0.05]} scale={[1.05, 0.5, 1.05]}>
                <cylinderGeometry args={[0.45, 0.52, 1, 64, 1, true]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Base blending ring */}
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 1.1, 0.1]}>
                <torusGeometry args={[0.5, 0.02, 16, 64]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      case 'buzz':
        return (
          <mesh position={[0, 0.4, 0.0]} scale={[1.05, 0.58, 1.15]}>
            <sphereGeometry args={[0.55, 64, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <primitive object={shaderMaterial} attach="material" />
          </mesh>
        );
      case 'undercut':
        return (
          <group>
            {/* Top Side-Swept Volume */}
            <mesh position={[0.1, 0.62, 0.18]} rotation={[0, 0, -0.2]} scale={[0.9, 0.4, 1.3]}>
                <sphereGeometry args={[0.5, 64, 32]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Tight Sides */}
            <mesh position={[0, 0.35, 0]} scale={[1.02, 0.48, 1.12]}>
                <cylinderGeometry args={[0.5, 0.55, 1, 64, 1, true]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      case 'pompadour':
        return (
          <group>
            {/* Classic Pomp Quiff */}
            <mesh position={[0, 0.75, 0.35]} rotation={[-0.2, 0, 0]} scale={[0.85, 0.8, 1.45]}>
                <sphereGeometry args={[0.5, 64, 64]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Back & Sides tapered */}
            <mesh position={[0, 0.4, 0]} scale={[1.08, 0.5, 1.15]}>
                <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
          </group>
        );
      case 'textured':
        return (
          <mesh position={[0, 0.48, 0.12]} scale={[1.02, 0.65, 1.3]}>
            <sphereGeometry args={[0.55, 64, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <primitive object={shaderMaterial} attach="material" />
          </mesh>
        );
      case 'long':
        return (
          <group>
            <mesh position={[0, 0.44, 0]} scale={[1.08, 0.55, 1.2]}>
                <sphereGeometry args={[0.5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <primitive object={shaderMaterial} attach="material" />
            </mesh>
            {/* Falling hair strands */}
            <mesh position={[0, -0.1, -0.38]} rotation={[1.2, 0, 0]} scale={[1.2, 1.5, 1.4]}>
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
