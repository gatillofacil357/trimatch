"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHADER: The Hair Eraser (v6.0.1)
// We render the video but "erase" the hair pixels detected by the segmenter.
const maskVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Cover the full viewport (NDC)
    gl_Position = vec4(position.xy, 0.999, 1.0); 
  }
`;

const maskFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVideoTexture;
  uniform sampler2D uMaskTexture;

  void main() {
    // 1. MIRRORED UVs
    // Since the parent container is scaleX(-1), we need to handle the texture accordingly.
    // MediaPipe usually expects mirrored input if the camera is mirrored.
    vec2 flippedUv = vec2(vUv.x, vUv.y); 
    
    vec4 videoColor = texture2D(uVideoTexture, flippedUv);
    
    // Mask texture alignment (MediaPipe masks are often Y-flipped)
    vec2 maskUv = vec2(vUv.x, 1.0 - vUv.y); 
    float mask = texture2D(uMaskTexture, maskUv).r;

    // REPLACEMENT ZONE
    if (mask > 0.45) {
        // High-Quality Erase: Neutral Skin/Dark Shadow
        vec3 skinShadow = vec3(0.12, 0.08, 0.06); 
        float gray = dot(videoColor.rgb, vec3(0.299, 0.587, 0.114));
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
  
  // 1. VIDEO TEXTURE
  const videoTexture = useMemo(() => {
    const video = webcamRef.current?.video;
    if (!video) return new THREE.Texture();
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [webcamRef]);

  // 2. MASK TEXTURE (DataTexture)
  const maskTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      new Uint8Array([0]), 1, 1, THREE.RedFormat
    );
    tex.needsUpdate = true;
    return tex;
  }, []);

  const uniforms = useMemo(() => ({
    uVideoTexture: { value: videoTexture },
    uMaskTexture: { value: maskTexture }
  }), [videoTexture, maskTexture]);

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
