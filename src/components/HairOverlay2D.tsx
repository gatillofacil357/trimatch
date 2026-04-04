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

  useEffect(() => {
    const updatePosition = () => {
      const { landmarks } = trackingRef.current;
      if (landmarks.length > 0 && containerRef.current && imgRef.current) {
        // Landmarks for anchor: Forehead Center (151) and Temples (234, 454)
        const forehead = landmarks[151] || landmarks[10];
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        // 1. Calculate Pixel Position
        // Webcam is usually mirrored by CSS transform: scaleX(-1) in LiveEngine
        const x = forehead.x * 100;
        const y = forehead.y * 100;

        // 2. Calculate Angle (Rotation)
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 3. Calculate Width (Scale)
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        // Multiplier to cover the head realistically
        const width = templeDist * 165; // Percent of container width

        // 4. APPLY STYLES
        imgRef.current.style.width = `${width}%`;
        imgRef.current.style.left = `${x}%`;
        imgRef.current.style.top = `${y}%`;
        imgRef.current.style.transform = `translate(-50%, -65%) rotate(${angle}deg)`;
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
