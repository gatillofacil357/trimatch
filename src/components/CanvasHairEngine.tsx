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
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
      img.onerror = () => {
          console.error(`Failed to load hair asset: ${key} at ${ASSETS[key]}`);
          loadedCount++;
      };
    });
  }, []);

  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || !webcamRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
    if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
    
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas.getContext('2d');
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas.getContext('2d');

    let animId: number;

    const render = () => {
      const source = webcamRef.current?.video || webcamRef.current; 
      if (source && (source.readyState >= 2 || (source instanceof HTMLImageElement && source.complete))) {
        const srcW = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth;
        const srcH = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight;
        
        if (srcW === 0 || srcH === 0) {
            animId = requestAnimationFrame(render);
            return;
        }

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
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(source, 0, 0, w, h);
        ctx.restore();

        const hasLandmarks = landmarks && landmarks.length > 400;

        // 2. Hair Erasure (Geometric Foundation Only)
        const seg = segmentationRef?.current;
        if (hasLandmarks && seg && seg.mask && maskCtx && tempCtx) {
            if (tempCanvas.width !== seg.width || tempCanvas.height !== seg.height) {
                tempCanvas.width = seg.width;
                tempCanvas.height = seg.height;
            }

            const maskData = tempCtx.createImageData(seg.width, seg.height);
            for (let i = 0; i < seg.mask.length; i++) {
                const val = seg.mask[i] * 255;
                const idx = i * 4;
                maskData.data[idx] = 0;
                maskData.data[idx + 1] = 0;
                maskData.data[idx + 2] = 0;
                maskData.data[idx + 3] = val; 
            }
            tempCtx.putImageData(maskData, 0, 0);

            maskCtx.clearRect(0, 0, w, h);
            maskCtx.save();
            if (mirrored) {
                maskCtx.translate(w, 0);
                maskCtx.scale(-1, 1);
            }
            maskCtx.drawImage(tempCanvas, 0, 0, w, h);
            maskCtx.restore();

            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.restore();
        }

        // 3. Perfect Geometric Anchoring & Scaling (v11.0)
        if (hasLandmarks) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];

          // 3.1 Stable Midpoint Anchoring
          const centerX = (leftTemple.x + rightTemple.x) / 2 * w;
          const centerY = (leftTemple.y + rightTemple.y) / 2 * h;

          // 3.2 Pure Euclidean Scaling
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx * dx + dy * dy);

          // 3.3 Precise Rotation
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

          // 3.4 Double-Buffered EMA Smoothing
          const sr = stateRef.current;
          const sPos = 0.45; // Position is highly responsive
          const sSize = 0.25; // Size is more stable
          const sRot = 0.35; // Rotation is balanced

          if (!sr.init) {
             sr.x = centerX; sr.y = centerY; sr.width = headWidthPx;
             sr.rotZ = targetRotZ; sr.rotY = targetRotY;
             sr.init = true;
          } else {
             sr.x += (centerX - sr.x) * sPos;
             sr.y += (centerY - sr.y) * sPos;
             sr.width += (headWidthPx - sr.width) * sSize;
             sr.rotZ += (targetRotZ - sr.rotZ) * sRot;
             sr.rotY += (targetRotY - sr.rotY) * sRot;
          }

          const yawSquish = Math.cos(sr.rotY);
          const scalpW = sr.width * 1.1;
          const scalpH = scalpW * 0.6;
          
          // Scalp Base (No effects/gradients, just raw geometry)
          ctx.save();
          if (mirrored) {
              ctx.translate(w, 0);
              ctx.scale(-1, 1);
          }
          ctx.translate(sr.x, sr.y - scalpH * 0.18);
          ctx.rotate(-sr.rotZ);
          ctx.scale(yawSquish, 1.0);

          ctx.beginPath();
          ctx.ellipse(0, 0, scalpW / 2, scalpH / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#e8beac'; 
          ctx.fill();
          ctx.restore();

          // 4. Hair Asset Physical Attachment
          const hairImg = imagesRef.current[activeStyle];
          if (hairImg) {
              const aspect = hairImg.height / hairImg.width;
              // Precise Coverage Constant (1.62x)
              const drawW = sr.width * 1.62; 
              const drawH = drawW * aspect;
              const yOffset = -drawH * 0.82; // Attached deep to temples midpoint

              ctx.save();
              if (mirrored) {
                  ctx.translate(w, 0);
                  ctx.scale(-1, 1);
              }
              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
              ctx.scale(yawSquish, 1.0);
              
              // Raw source-over drawing, no shadows/effects
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
