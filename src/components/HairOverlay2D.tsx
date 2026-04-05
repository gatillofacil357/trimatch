"use client";

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface HairOverlay2DProps {
  styleId: string;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number }
  }>;
}

// 3. ESTRUCTURA DE DATOS
const ASSETS: Record<string, { front: string, side?: string, back?: string }> = {
  'fade': {
    front: '/assets/hair/fade_front.png',
  },
  'buzz': {
    front: '/assets/hair/buzz_front.png',
  },
  'undercut': {
    front: '/assets/hair/undercut_front.png',
  }
};

export default function HairOverlay2D({ styleId, trackingRef }: HairOverlay2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // EMA Smoothing State
  const stateRef = useRef({
    x: 0, y: 0, width: 0, 
    rotX: 0, rotY: 0, rotZ: 0,
    initialized: false
  });

  const src = ASSETS[styleId]?.front;

  useEffect(() => {
    if (!src) return;

    const smoothing = 0.35; 

    const updatePosition = () => {
      const { landmarks, matrix } = trackingRef.current;
      if (landmarks && landmarks.length > 0 && matrix && containerRef.current && imgRef.current) {
        // POSITION
        const hairline = landmarks[151] || landmarks[10]; 
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        const targetX = hairline.x * 100;
        const targetY = hairline.y * 100;

        // SCALING
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        const targetWidth = templeDist * 165; // Ajuste manual para compensar recorte frontal

        // ROTATION
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        matrix.decompose(pos, quat, scl);
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        let targetRotX = euler.x; 
        let targetRotY = euler.y; 
        let targetRotZ = euler.z;

        // EMA SMOOTHING
        if (!stateRef.current.initialized) {
          stateRef.current = { 
            x: targetX, y: targetY, width: targetWidth, 
            rotX: targetRotX, rotY: targetRotY, rotZ: targetRotZ,
            initialized: true 
          };
        } else {
          stateRef.current.x += (targetX - stateRef.current.x) * smoothing;
          stateRef.current.y += (targetY - stateRef.current.y) * smoothing;
          stateRef.current.width += (targetWidth - stateRef.current.width) * smoothing;
          stateRef.current.rotX += (targetRotX - stateRef.current.rotX) * smoothing;
          stateRef.current.rotY += (targetRotY - stateRef.current.rotY) * smoothing;
          stateRef.current.rotZ += (targetRotZ - stateRef.current.rotZ) * smoothing;
        }

        const sr = stateRef.current;

        // APPLICATION
        imgRef.current.style.width = `${sr.width}%`;
        imgRef.current.style.left = `${sr.x}%`;
        imgRef.current.style.top = `${sr.y}%`;
        
        const degX = sr.rotX * (180 / Math.PI);
        const degY = -sr.rotY * (180 / Math.PI); 
        const degZ = -sr.rotZ * (180 / Math.PI);

        imgRef.current.style.transform = `translate(-50%, -75%) perspective(600px) rotateY(${degY}deg) rotateX(${degX}deg) rotateZ(${degZ}deg)`;
      }
      requestAnimationFrame(updatePosition);
    };

    const animId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animId);
  }, [trackingRef, src]);

  if (!src) return null;

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 50, overflow: 'hidden'
      }}
    >
      <img 
        ref={imgRef}
        src={src}
        alt="AR Hair Frontend"
        crossOrigin="anonymous"
        style={{
          position: 'absolute', transition: 'none', display: 'block',
          mixBlendMode: 'normal',
          WebkitMaskImage: 'linear-gradient(to top, transparent 5%, black 25%)',
          maskImage: 'linear-gradient(to top, transparent 5%, black 25%)',
        }}
      />
    </div>
  );
}
