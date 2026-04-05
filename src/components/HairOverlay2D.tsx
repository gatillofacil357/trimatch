"use client";

import React, { useRef, useEffect } from 'react';

interface HairOverlay2DProps {
  styleId: string;
  trackingRef: React.RefObject<{
    landmarks: any[],
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
  
  // Smoothing state
  const stateRef = useRef({
    x: 0, y: 0, width: 0, angle: 0,
    initialized: false
  });

  useEffect(() => {
    const smoothing = 0.25; // EMA factor: slightly lower = smoother follow

    const updatePosition = () => {
      const { landmarks, viewport } = trackingRef.current;
      if (landmarks && landmarks.length > 0 && containerRef.current && imgRef.current) {
        
        // 1. LANDMARKS
        // 10: Topmost point of head (approx)
        // 151: Forehead Center (Hairline anchor)
        // 234: Left Temple
        // 454: Right Temple
        const hairline = landmarks[151] || landmarks[10]; 
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        // 2. COORDINATES (Percentage of viewport)
        const targetX = hairline.x * 100;
        const targetY = hairline.y * 100;

        // 3. DYNAMIC SCALING
        // Distance between temples handles depth (Z-distance) and face width
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        
        // The hair asset needs to be slightly wider than the temples.
        // Adjust this multiplier based on the crop of the generated assets.
        const targetWidth = templeDist * 220; 

        // 4. ROTATION
        // Roll of the head
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 5. MOTION SMOOTHING (EMA)
        if (!stateRef.current.initialized) {
          stateRef.current = { x: targetX, y: targetY, width: targetWidth, angle: targetAngle, initialized: true };
        } else {
          stateRef.current.x += (targetX - stateRef.current.x) * smoothing;
          stateRef.current.y += (targetY - stateRef.current.y) * smoothing;
          stateRef.current.width += (targetWidth - stateRef.current.width) * smoothing;
          stateRef.current.angle += (targetAngle - stateRef.current.angle) * smoothing;
        }

        // 6. OFFSET ADJUSTMENT
        // Hair assets usually have the hair centered. 
        // We want the BOTTOM of the hair (which in the image might be around 80% down) to touch the hairline.
        // By translating -85% on Y, the bottom-center of the image sits exactly on landmark 151.
        const offsetY = -80; 

        // 7. PROFESSIONAL AR STYLES
        imgRef.current.style.width = `${stateRef.current.width}%`;
        imgRef.current.style.left = `${stateRef.current.x}%`;
        imgRef.current.style.top = `${stateRef.current.y}%`;
        
        // Transformation: Center X horizontally, shift Y up so hair sits ON TOP of hairline, rotate by angle
        imgRef.current.style.transform = `translate(-50%, ${offsetY}%) rotate(${stateRef.current.angle}deg)`;
        
        // Visual Integration:
        imgRef.current.style.mixBlendMode = 'multiply'; // Makes white bg perfectly transparent, blends hair to skin
        imgRef.current.style.opacity = '0.90'; // Less artificial, blends perfectly
        imgRef.current.style.maskImage = 'radial-gradient(ellipse at center, black 65%, transparent 100%)';
        imgRef.current.style.webkitMaskImage = 'radial-gradient(ellipse at center, black 65%, transparent 100%)';
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
