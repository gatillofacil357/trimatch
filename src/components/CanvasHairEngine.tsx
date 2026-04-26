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
  activeColor?: string;
  mirrored?: boolean;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, segmentationRef, activeStyle, activeColor, mirrored = false }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const stateRef = useRef({
    x: 0, y: 0, width: 0, height: 0, 
    rotY: 0, rotZ: 0, rotX: 0,
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
    if (!tintCanvasRef.current) tintCanvasRef.current = document.createElement('canvas');
    
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas.getContext('2d');
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas.getContext('2d');
    const tintCanvas = tintCanvasRef.current;
    const tintCtx = tintCanvas.getContext('2d');

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
            const eyeLine = landmarks[159].y; 

            for (let i = 0; i < seg.mask.length; i++) {
                const row = Math.floor(i / seg.width);
                const normY = row / seg.height;
                
                // v11.3 Check: Protect eyes and below
                let val = seg.mask[i] * 255;
                if (normY > eyeLine) {
                    val = 0; // Force-protect face
                }

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

        // 3. Perfect Geometric Anchoring & Scaling (v12.0)
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
          let targetRotX = 0;
          if (matrix) {
             const pos = new THREE.Vector3();
             const quat = new THREE.Quaternion();
             const scl = new THREE.Vector3();
             matrix.decompose(pos, quat, scl);
             const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
             targetRotZ = euler.z;
             targetRotY = euler.y;
             targetRotX = euler.x; 
          }

          // 3.4 Double-Buffered EMA Smoothing
          const sr = stateRef.current;
          const sPos = 0.45;
          const sSize = 0.25;
          const sRot = 0.35;

          if (!sr.init) {
             sr.x = centerX; sr.y = centerY; sr.width = headWidthPx;
             sr.rotZ = targetRotZ; sr.rotY = targetRotY; sr.rotX = targetRotX;
             sr.init = true;
          } else {
             sr.x += (centerX - sr.x) * sPos;
             sr.y += (centerY - sr.y) * sPos;
             sr.width += (headWidthPx - sr.width) * sSize;
             sr.rotZ += (targetRotZ - sr.rotZ) * sRot;
             sr.rotY += (targetRotY - sr.rotY) * sRot;
             sr.rotX += (targetRotX - sr.rotX) * sRot;
          }

          const yawSquish = Math.cos(sr.rotY);
          
          // 4. Scalp Realism (v12.0 Bald Cap) - Essential for both Bald filter and realistic hair gaps
          ctx.save();
          if (mirrored) {
              ctx.translate(w, 0);
              ctx.scale(-1, 1);
          }
          
          // Anchor scalp dome based on pitch (rotX)
          // As head tilts down (positive rotX), we pull the dome UP
          const pitchOffset = sr.rotX * (sr.width * 0.4);
          ctx.translate(sr.x, sr.y - sr.width * 0.3 + pitchOffset);
          ctx.rotate(-sr.rotZ);
          ctx.scale(yawSquish, 1.4); // Skull is taller than wide

          const scalpGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sr.width * 0.7);
          scalpGrad.addColorStop(0, '#e8beac'); // Base skin tone (approximate)
          scalpGrad.addColorStop(0.7, '#d1a390');
          scalpGrad.addColorStop(1.0, 'rgba(160, 120, 100, 0)'); // Fade to nothing at edges
          
          ctx.fillStyle = scalpGrad;
          ctx.beginPath();
          ctx.arc(0, 0, sr.width * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 5. Hair Asset Physical Attachment (v12.0)
          if (activeStyle !== 'bald') {
              const hairImg = imagesRef.current[activeStyle];
              if (hairImg && tintCtx) {
                  const aspect = hairImg.height / hairImg.width;
                  const drawW = sr.width * 2.2; 
                  const drawH = drawW * aspect;
                  
                  // Pitch-aware positioning: Pull hair down when looking down, up when looking up
                  const pitchY = sr.rotX * (sr.width * 0.5);
                  const offsetY = sr.width * 0.6 + pitchY; 
                  const finalY = sr.y - offsetY;
                  
                  const yOffset = -drawH * 0.35;

                  // Apply Color Tint (v12.0)
                  if (activeColor && tintCanvas) {
                      if (tintCanvas.width !== hairImg.width || tintCanvas.height !== hairImg.height) {
                          tintCanvas.width = hairImg.width;
                          tintCanvas.height = hairImg.height;
                      }
                      tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
                      tintCtx.drawImage(hairImg, 0, 0);
                      
                      // Tint logic: Use color as overlay or multiply
                      tintCtx.globalCompositeOperation = 'source-atop';
                      tintCtx.fillStyle = activeColor;
                      tintCtx.globalAlpha = 0.5; // Blend factor
                      tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
                      tintCtx.globalAlpha = 1.0;
                      tintCtx.globalCompositeOperation = 'source-over';
                  }

                  ctx.save();
                  if (mirrored) {
                      ctx.translate(w, 0);
                      ctx.scale(-1, 1);
                  }
                  ctx.translate(sr.x, finalY);
                  ctx.rotate(-sr.rotZ); 
                  ctx.scale(yawSquish, 1.0);
                  
                  ctx.drawImage(activeColor ? tintCanvas : hairImg, -drawW / 2, yOffset, drawW, drawH);
                  ctx.restore();
              }
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
