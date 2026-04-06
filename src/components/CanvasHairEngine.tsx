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
  segmentationRef: React.RefObject<{ mask: Float32Array | null, width: number, height: number }>;
  activeStyle: string;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, segmentationRef, activeStyle }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const stateRef = useRef({
    x: 0, y: 0, width: 0, height: 0, 
    rotY: 0, rotZ: 0,
    init: false
  });

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
    const ctx = canvas.getContext('2d', { alpha: false }); // Opaque for performance
    if (!ctx) return;

    // Persistent Mask Canvas to avoid GC thrashing
    if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas');
    }
    const maskCanvas = maskCanvasRef.current;
    const mCtx = maskCanvas.getContext('2d');
    let maskImageData: ImageData | null = null;

    let animId: number;

    const render = () => {
      const video = webcamRef.current.video;
      if (video && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const { landmarks, matrix } = trackingRef.current;
        const w = canvas.width;
        const h = canvas.height;

        ctx.save();
        // Mirroring is handled by the CSS (.cameraWrapper { transform: scaleX(-1) })
        // Drawing normally on the canvas will match the mirrored video.

        // 1. Draw Raw Video
        ctx.drawImage(video, 0, 0, w, h);

        if (landmarks && landmarks.length > 0) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const topForehead = landmarks[10];

          // 2. SOFT ERASURE (Using Confidence Mask)
          const seg = segmentationRef.current;
          if (seg && seg.mask && seg.width > 0 && seg.height > 0) {
              if (maskCanvas.width !== seg.width) {
                  maskCanvas.width = seg.width;
                  maskCanvas.height = seg.height;
                  maskImageData = mCtx!.createImageData(seg.width, seg.height);
              }

              if (maskImageData) {
                  const data = maskImageData.data;
                  const mask = seg.mask;
                  for (let i = 0; i < mask.length; i++) {
                      const alpha = mask[i]; // 0 to 1
                      const idx = i * 4;
                      data[idx + 0] = 0; // Black hole
                      data[idx + 1] = 0;
                      data[idx + 2] = 0;
                      // Confidence mask values: 1.0 = definitely hair (erase), 0.0 = skin/bg (keep)
                      data[idx + 3] = Math.floor(alpha * 255); 
                  }
                  mCtx!.putImageData(maskImageData, 0, 0);

                  // Apply the mask as "destination-out" to erase specifically the hair
                  ctx.globalCompositeOperation = 'destination-out';
                  ctx.drawImage(maskCanvas, 0, 0, w, h);
                  ctx.globalCompositeOperation = 'source-over';
              }
          }

          // 3. DRAW Virtual Hair
          const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
          const anchorY = topForehead.y * h;
          
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx*dx + dy*dy);
          const targetW = headWidthPx * 1.55;

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

          // Smooth tracking
          const sr = stateRef.current;
          const s = 0.4; // Slightly faster for responsiveness
          if (!sr.init) {
             sr.x = anchorX; sr.y = anchorY; sr.width = targetW;
             sr.rotZ = targetRotZ; sr.rotY = targetRotY;
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
              
              const yOffset = -drawH * 0.72; // Adjusted for better scalp fit

              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
              
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);
              
              // Soft landing shadow for realism
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetY = 5;

              ctx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
              
              ctx.shadowColor = 'transparent'; // Cleanup
          }
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
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 20,
        pointerEvents: 'none'
      }}
    />
  );
}
