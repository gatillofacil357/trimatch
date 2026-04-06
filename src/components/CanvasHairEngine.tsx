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
  segmentationRef?: React.RefObject<{
    mask: Float32Array | null,
    width: number,
    height: number
  }>;
  activeStyle: string;
  mirrored?: boolean;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, segmentationRef, activeStyle, mirrored = false }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Create mask canvas offscreen
    if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas');
    }
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas.getContext('2d');

    let animId: number;

    const render = () => {
      const source = webcamRef.current?.video || webcamRef.current; 
      if (source && (source.readyState >= 2 || (source instanceof HTMLImageElement && source.complete))) {
        const srcW = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth;
        const srcH = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight;
        
        if (canvas.width !== srcW || canvas.height !== srcH) {
          canvas.width = srcW;
          canvas.height = srcH;
          maskCanvas.width = srcW;
          maskCanvas.height = srcH;
        }

        const { landmarks, matrix } = trackingRef.current;
        const w = canvas.width;
        const h = canvas.height;

        // 1. Draw Background Video
        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(source, 0, 0, w, h);
        ctx.restore();

        // 2. Hair Erasure (v10.0 Realism)
        const seg = segmentationRef?.current;
        if (seg && seg.mask && maskCtx) {
            // Draw mask to maskCanvas
            const maskData = maskCtx.createImageData(seg.width, seg.height);
            for (let i = 0; i < seg.mask.length; i++) {
                const val = seg.mask[i] * 255;
                maskData.data[i * 4] = 0;
                maskData.data[i * 4 + 1] = 0;
                maskData.data[i * 4 + 2] = 0;
                maskData.data[i * 4 + 3] = val; // Alpha channel is the mask
            }
            
            // Temporary canvas for mask processing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = seg.width;
            tempCanvas.height = seg.height;
            tempCanvas.getContext('2d')?.putImageData(maskData, 0, 0);

            maskCtx.clearRect(0, 0, w, h);
            maskCtx.save();
            if (mirrored) {
                maskCtx.translate(w, 0);
                maskCtx.scale(-1, 1);
            }
            maskCtx.drawImage(tempCanvas, 0, 0, w, h);
            maskCtx.restore();

            // Apply 'destination-out' to erase original hair
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.restore();
        }

        // 3. Face Anchoring & Scalp Reconstruction
        if (landmarks && landmarks.length > 400) {
          const topForehead = landmarks[10];
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];

          const lx = leftTemple.x * w;
          const ly = leftTemple.y * h;
          const rx = rightTemple.x * w;
          const ry = rightTemple.y * h;

          const dx = rx - lx;
          const dy = ry - ly;
          const headWidthPx = Math.sqrt(dx * dx + dy * dy);
          
          const centerX = (lx + rx) / 2;
          const centerY = topForehead.y * h;

          let targetRotZ = 0;
          let targetRotY = 0;
          if (matrix) {
             const pos = new THREE.Vector3();
             const quat = new THREE.Quaternion();
             const scl = new THREE.Vector3();
             matrix.decompose(pos, quat, scl);
             const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
             targetRotZ = euler.z;
             targetRotY = euler.y;
          }

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

          // Scalp Reconstruction: Skin-toned base
          const scalpW = sr.width * 1.1;
          const scalpH = scalpW * 0.6;
          
          ctx.save();
          if (mirrored) {
              ctx.translate(w, 0);
              ctx.scale(-1, 1);
          }
          ctx.translate(sr.x, sr.y - scalpH * 0.2);
          ctx.rotate(-sr.rotZ);
          const yawSquish = Math.cos(sr.rotY);
          ctx.scale(yawSquish, 1.0);

          // Draw skin base
          ctx.beginPath();
          ctx.ellipse(0, 0, scalpW / 2, scalpH / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#e8beac'; // Default skin tone Ref: Conversation 6737
          ctx.fill();
          ctx.restore();

          // 4. Asset Overlay
          const hairImg = imagesRef.current[activeStyle];
          if (hairImg) {
              const aspect = hairImg.height / hairImg.width;
              const drawW = sr.width * 1.55;
              const drawH = drawW * aspect;
              const yOffset = -drawH * 0.75; 

              ctx.save();
              if (mirrored) {
                  ctx.translate(w, 0);
                  ctx.scale(-1, 1);
              }
              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
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
  }, [trackingRef, segmentationRef, activeStyle, imagesLoaded, mirrored]);

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
