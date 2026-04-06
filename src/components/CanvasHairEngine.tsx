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
  activeStyle: string;
  mirrored?: boolean;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, activeStyle, mirrored = false }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const stateRef = useRef({
    x: 0, y: 0, width: 0, height: 0, 
    rotY: 0, rotZ: 0,
    init: false
  });

  // Load assets
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

  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || !webcamRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Source is the webcam video
      const source = webcamRef.current?.video || webcamRef.current; 
      if (source && (source.readyState >= 2 || (source instanceof HTMLImageElement && source.complete))) {
        const srcW = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth;
        const srcH = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight;
        
        // Phase 1: Match resolution exactly
        if (canvas.width !== srcW || canvas.height !== srcH) {
          canvas.width = srcW;
          canvas.height = srcH;
        }

        const { landmarks, matrix } = trackingRef.current;
        const w = canvas.width;
        const h = canvas.height;

        // Phase 1: Clear and Draw Video FIRST
        ctx.clearRect(0, 0, w, h);
        
        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(source, 0, 0, w, h);
        ctx.restore();

        // Phase 2: Correct Face Anchoring
        if (landmarks && landmarks.length > 400) {
          const topForehead = landmarks[10]; // Top of forehead
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];

          // Compute width and center based on temples (in pixels)
          const lx = leftTemple.x * w;
          const ly = leftTemple.y * h;
          const rx = rightTemple.x * w;
          const ry = rightTemple.y * h;

          const dx = rx - lx;
          const dy = ry - ly;
          const headWidthPx = Math.sqrt(dx * dx + dy * dy);
          
          // Center between temples
          const centerX = (lx + rx) / 2;
          const centerY = topForehead.y * h; // Anchor at forehead landmark

          // Rotation from matrix
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

          // Smooth tracking (Phased smoothing)
          const sr = stateRef.current;
          const s = 0.35; 
          if (!sr.init) {
             sr.x = centerX; sr.y = centerY; sr.width = headWidthPx;
             sr.rotZ = targetRotZ; sr.rotY = targetRotY;
             sr.init = true;
          } else {
             sr.x += (centerX - sr.x) * s;
             sr.y += (centerY - sr.y) * s;
             sr.width += (headWidthPx - sr.width) * s;
             sr.rotZ += (targetRotZ - sr.rotZ) * s;
             sr.rotY += (targetRotY - sr.rotY) * s;
          }

          // Phase 3: Basic Overlay (No segmentation/shadows)
          const hairImg = imagesRef.current[activeStyle];
          if (hairImg) {
              const aspect = hairImg.height / hairImg.width;
              // Scaling factor (1.55x headWidth for natural coverage)
              const drawW = sr.width * 1.55;
              const drawH = drawW * aspect;
              
              // Anatomical offset (Anchor hair slightly ABOVE forehead)
              const yOffset = -drawH * 0.75; 

              ctx.save();
              // If mirrored, we need to handle coordinates correctly
              // The drawImage source was mirrored, let's keep hair consistent 
              if (mirrored) {
                  ctx.translate(w, 0);
                  ctx.scale(-1, 1);
              }

              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
              
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);
              
              ctx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
              ctx.restore();
          }
        }
      }
      
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [trackingRef, activeStyle, imagesLoaded, mirrored]);

  return (
    <canvas 
      ref={canvasRef} 
      className="ar-pipeline-canvas"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 20,
        pointerEvents: 'none'
      }}
    />
  );
}
