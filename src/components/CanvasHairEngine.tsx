"use client";

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const ASSETS: Record<string, string> = {
  'fade': '/assets/hair/fade_front.png',
  'buzz': '/assets/hair/buzz_front.png',
  'undercut': '/assets/hair/undercut_front.png'
};

interface CanvasHairEngineProps {
  webcamRef: React.RefObject<any>;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null
  }>;
  segmentationRef: React.RefObject<{ mask: any }>;
  activeStyle: string;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, segmentationRef, activeStyle }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // EMA State for smooth tracking
  const stateRef = useRef({
    x: 0, y: 0, width: 0, height: 0, 
    rotY: 0, rotZ: 0,
    init: false
  });

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const keys = Object.keys(ASSETS);
    keys.forEach(key => {
      const img = new Image();
      img.src = ASSETS[key];
      img.onload = () => {
        imagesRef.current[key] = img;
        loadedCount++;
        if (loadedCount === keys.length) setImagesLoaded(true);
      };
    });
  }, []);

  // Main 2D Render Loop
  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || !webcamRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const video = webcamRef.current.video;
      if (video && video.readyState >= 2) {
        // Resize canvas to match video natively
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const { landmarks, matrix } = trackingRef.current;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        
        ctx.save();
        // Mirror the canvas to match the user camera preview
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        // 1. DRAW VIDEO FEED
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(video, 0, 0, w, h);

        if (landmarks && landmarks.length > 0) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const topForehead = landmarks[10];

          // 2. FOREHEAD CLIPPING PATH
          // We define a polygon that starts at left temple, goes across the upper forehead,
          // to right temple, and wraps entirely around the TOP of the canvas.
          // By clipping to this, the hair PNG cannot render over the face/eyes.
          const hairlineCurve = [
            234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454 
          ];

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, 0); // Top Left
          ctx.lineTo(0, leftTemple.y * h); // Down to left temple height at screen edge
          ctx.lineTo(leftTemple.x * w, leftTemple.y * h); // In to left temple
          
          // Trace up and across forehead
          for (let idx of hairlineCurve) {
              const pt = landmarks[idx];
              if (pt) {
                  ctx.lineTo(pt.x * w, pt.y * h);
              }
          }
          
          ctx.lineTo(rightTemple.x * w, rightTemple.y * h); // Right temple
          ctx.lineTo(w, rightTemple.y * h); // Out to screen edge
          ctx.lineTo(w, 0); // Top Right
          ctx.closePath();
          
          // Apply strict clipping mask so hair physically cannot drop below this forehead line
          ctx.clip();


          // 3. DRAW NEW HAIRSTYLE PNG
          // Compute anchor (forehead apex)
          const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
          const anchorY = topForehead.y * h;

          // Compute dynamic scale
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx*dx + dy*dy);
          
          // Expand width to occlude natural side-hair
          const targetW = headWidthPx * 1.6;

          // Compute rotation 
          let targetRotZ = 0;
          let targetRotY = 0;
          if (matrix) {
             const pos = new THREE.Vector3();
             const quat = new THREE.Quaternion();
             const scl = new THREE.Vector3();
             matrix.decompose(pos, quat, scl);
             const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
             targetRotZ = euler.z; // Roll
             targetRotY = euler.y; // Yaw
          }

          // EMA Smoothing
          const sr = stateRef.current;
          const s = 0.35;
          if (!sr.init) {
             sr.x = anchorX;
             sr.y = anchorY;
             sr.width = targetW;
             sr.rotZ = targetRotZ;
             sr.rotY = targetRotY;
             sr.init = true;
          } else {
             sr.x += (anchorX - sr.x) * s;
             sr.y += (anchorY - sr.y) * s;
             sr.width += (targetW - sr.width) * s;
             sr.rotZ += (targetRotZ - sr.rotZ) * s;
             sr.rotY += (targetRotY - sr.rotY) * s;
          }

          const hairImg = imagesRef.current[activeStyle];
          if (hairImg) {
              const aspect = hairImg.height / hairImg.width;
              const drawW = sr.width;
              const drawH = sr.width * aspect;
              
              // Shift the image down over the anchor slightly so it has room to be clipped
              // visually creating a hard edge at the hairline perfectly tailored to their skull.
              const yOffset = -drawH * 0.70;

              // Move drawing context to cranial anchor
              ctx.translate(sr.x, sr.y);
              
              // Roll
              ctx.rotate(-sr.rotZ); 

              // Simulated Yaw via scaling squish
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);

              // Draw PNG
              ctx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
          }
          
          // Restore from clipping
          ctx.restore();
        }
        
        ctx.restore();
      }
      
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [trackingRef, activeStyle, imagesLoaded]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
        pointerEvents: 'none'
      }}
    />
  );
}
