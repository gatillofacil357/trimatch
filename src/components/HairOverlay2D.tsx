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
  
  // Smoothing values
  const stateRef = useRef({
    x: 0, y: 0, width: 0, angle: 0,
    initialized: false
  });

  useEffect(() => {
    const smoothing = 0.35; // EMA factor (lower = smoother/slower, higher = snappier)

    const updatePosition = () => {
      const { landmarks } = trackingRef.current;
      if (landmarks && landmarks.length > 0 && containerRef.current && imgRef.current) {
        // 1. LANDMARKS (MediaPipe Indices)
        // 151: Forehead Center (Baseline for hair)
        // 10: Top of Head (Upper limit)
        // 234, 454: Temples (Rotation/Scale)
        const forehead = landmarks[151] || landmarks[10];
        const topHead = landmarks[10];
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        // 2. COORDINATES
        const targetX = forehead.x * 100;
        const targetY = forehead.y * 100;

        // 3. SCALE (Based on Temple Distance)
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        const targetWidth = templeDist * 180; // Adjusted multiplier for new assets

        // 4. ROTATION (Z-axis roll)
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 5. SMOOTHING (EMA)
        if (!stateRef.current.initialized) {
          stateRef.current = { x: targetX, y: targetY, width: targetWidth, angle: targetAngle, initialized: true };
        } else {
          stateRef.current.x += (targetX - stateRef.current.x) * smoothing;
          stateRef.current.y += (targetY - stateRef.current.y) * smoothing;
          stateRef.current.width += (targetWidth - stateRef.current.width) * smoothing;
          stateRef.current.angle += (targetAngle - stateRef.current.angle) * smoothing;
        }

        // 6. APPLY STYLES (v9.2 Anchor)
        // Offset Y slightly based on forehead-to-top distance for anatomical fit
        const foreheadScale = Math.abs(topHead.y - forehead.y) * 100;
        const dynamicOffsetY = -75 - (foreheadScale * 0.5); // Nudges up based on forehead size

        imgRef.current.style.width = `${stateRef.current.width}%`;
        imgRef.current.style.left = `${stateRef.current.x}%`;
        imgRef.current.style.top = `${stateRef.current.y}%`;
        imgRef.current.style.transform = `translate(-50%, ${dynamicOffsetY}%) rotate(${stateRef.current.angle}deg)`;
        imgRef.current.style.opacity = '0.94'; // Subtle blend
        imgRef.current.style.filter = 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'; // Depth
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
