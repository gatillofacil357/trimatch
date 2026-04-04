"use client";

import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHADER: The Hair Eraser (v6.1.1)
// Corrects UVs, Mirroring and Hair Replacement.
const maskVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0); 
  }
`;

const maskFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVideoTexture;
  uniform sampler2D uMaskTexture;

  void main() {
    // 1. MIRRORED UVs (Parent is scaleX(-1))
    vec2 flippedUv = vec2(vUv.x, vUv.y); 
    vec4 videoColor = texture2D(uVideoTexture, flippedUv);
    
    // 2. MASK ALIGNMENT (MediaPipe is Y-flipped)
    vec2 maskUv = vec2(vUv.x, 1.0 - vUv.y); 
    float mask = texture2D(uMaskTexture, maskUv).r;

    // 3. REPLACEMENT (ERASE)
    if (mask > 0.45) {
        // High-Quality Erase Foundation
        vec3 skinShadow = vec3(0.12, 0.08, 0.06); 
        gl_FragColor = vec4(mix(skinShadow, videoColor.rgb * 0.1, 0.7), 1.0);
    } else {
        gl_FragColor = videoColor;
    }
  }
`;

interface HairMaskerProps {
  webcamRef: React.RefObject<any>;
  segmentationRef: React.RefObject<{
    mask: Uint8Array | null,
    width: number,
    height: number
  }>;
}

export default function HairMasker({ webcamRef, segmentationRef }: HairMaskerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Data Textures
  const videoTexture = useMemo(() => new THREE.VideoTexture(document.createElement('video')), []);
  const maskTexture = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const uniforms = useMemo(() => ({
    uVideoTexture: { value: videoTexture },
    uMaskTexture: { value: maskTexture }
  }), [videoTexture, maskTexture]);

  // Sync Video
  useEffect(() => {
    const interval = setInterval(() => {
      const video = webcamRef.current?.video;
      if (video && video.readyState >= 2 && uniforms.uVideoTexture.value.image !== video) {
         const vTex = new THREE.VideoTexture(video);
         vTex.colorSpace = THREE.SRGBColorSpace;
         uniforms.uVideoTexture.value = vTex;
         console.log("HairMasker: Video Ready");
         clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [webcamRef, uniforms]);

  useFrame(() => {
    const { mask, width, height } = segmentationRef.current;
    if (mask && width > 0 && height > 0) {
      if (maskTexture.image.width !== width || maskTexture.image.height !== height) {
         maskTexture.image = { data: mask, width, height };
      } else {
         maskTexture.image.data = mask;
      }
      maskTexture.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial 
        vertexShader={maskVertexShader}
        fragmentShader={maskFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
