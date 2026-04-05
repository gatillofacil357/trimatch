"use client";

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface HairOverlay2DProps {
  styleId: string;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number }
  }>;
}

const HAIR_ASSETS: Record<string, string> = {
  'fade': '/assets/hair/fade.png',
  'buzz': '/assets/hair/buzz.png',
  'undercut': '/assets/hair/undercut.png'
};

export default function HairOverlay2D({ styleId, trackingRef }: HairOverlay2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // EMA Smoothing State
  const stateRef = useRef({
    x: 0, y: 0, width: 0, 
    rotX: 0, rotY: 0, rotZ: 0, // Using 3D Euler angles
    initialized: false
  });

  useEffect(() => {
    const smoothing = 0.35; 

    const updatePosition = () => {
      const { landmarks, matrix } = trackingRef.current;
      if (landmarks && landmarks.length > 0 && matrix && containerRef.current && imgRef.current) {
        
        // 1. POSITION (Landmark 151 = Forehead Center / Hairline)
        const hairline = landmarks[151] || landmarks[10]; 
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        const targetX = hairline.x * 100;
        const targetY = hairline.y * 100;

        // 2. DYNAMIC SCALING (Distance between temples)
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        const targetWidth = templeDist * 190; 

        // 3. 3D ROTATION (Extract from MediaPipe Transformation Matrix)
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        matrix.decompose(pos, quat, scl);
        
        // Convert to Euler angles (YXZ order matches typical head rotations)
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        
        // Extract raw radians
        let targetRotX = euler.x; 
        let targetRotY = euler.y; 
        let targetRotZ = euler.z;

        // 4. EMA SMOOTHING
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

        // 5. APPLY 2.5D MODELING EFFECTS
        imgRef.current.style.width = `${sr.width}%`;
        imgRef.current.style.left = `${sr.x}%`;
        imgRef.current.style.top = `${sr.y}%`;
        
        // CSS 3D Transform
        // We use perspective to give it depth when rotating.
        // translate(-50%, -70%) sets the anchor point roughly at the forehead.
        // rotY needs to be flipped for mirroring, same with rotZ, depending on MediaPipe coordinate system
        const degX = sr.rotX * (180 / Math.PI);
        const degY = -sr.rotY * (180 / Math.PI); 
        const degZ = -sr.rotZ * (180 / Math.PI);

        imgRef.current.style.transform = `
          translate(-50%, -75%) 
          perspective(600px) 
          rotateY(${degY}deg) 
          rotateX(${degX}deg) 
          rotateZ(${degZ}deg)
        `;
        
        // 6. INTEGRATION / HEAD MASKING
        // Removing mix-blend-mode because assets are truly transparent now
        imgRef.current.style.mixBlendMode = 'normal'; 
        
        // Soft gradient mask to hide any hair that invades the face below the hairline
        imgRef.current.style.webkitMaskImage = 'linear-gradient(to top, transparent 10%, black 30%)';
        imgRef.current.style.maskImage = 'linear-gradient(to top, transparent 10%, black 30%)';
      }
      requestAnimationFrame(updatePosition);
    };

    const animId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animId);
  }, [trackingRef]);

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden'
      }}
    >
      <img 
        ref={imgRef}
        src={HAIR_ASSETS[styleId] || HAIR_ASSETS['fade']}
        alt="Hair Overlay"
        style={{
          position: 'absolute',
          transition: 'none',
          display: 'block',
          // Mirroring: Since container is scaleX(-1), 
          // the image must also be scaleX(-1) or handled accordingly.
          // In this case, we let it inherid the mirror.
        }}
      />
    </div>
  );
}
