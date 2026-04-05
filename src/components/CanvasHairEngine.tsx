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
  segmentationRef: React.RefObject<{ mask: Uint8Array | null, width: number, height: number }>;
  activeStyle: string;
}

export default function CanvasHairEngine({ webcamRef, trackingRef, segmentationRef, activeStyle }: CanvasHairEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        // 1. Draw the Video Feed
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(video, 0, 0, w, h);

        // 2. Extract Person from Background via MediaPipe Selfie Segmentation
        const seg = segmentationRef.current;
        if (seg && seg.mask && seg.width > 0 && seg.height > 0) {
            // Convert Uint8Array [0, 1] to ImageData alpha mask
            const imgData = new ImageData(seg.width, seg.height);
            for (let i = 0; i < seg.mask.length; i++) {
                imgData.data[i * 4 + 0] = 0;
                imgData.data[i * 4 + 1] = 0;
                imgData.data[i * 4 + 2] = 0;
                imgData.data[i * 4 + 3] = seg.mask[i] > 0.5 ? 255 : 0; 
            }
            
            // Draw mask to offscreen canvas
            const segCanvas = document.createElement('canvas');
            segCanvas.width = seg.width;
            segCanvas.height = seg.height;
            const sCtx = segCanvas.getContext('2d');
            if (sCtx) {
                sCtx.putImageData(imgData, 0, 0);
                
                // Mask the main canvas
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(segCanvas, 0, 0, w, h);
            }
        }

        // We now have the ISOLATED PERSON with transparent background on screen.
        if (landmarks && landmarks.length > 0) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const topForehead = landmarks[10];

          // 3. REMOVE Original Hair (Erase pixels above hairline)
          const hairlineCurve = [
            234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454 
          ];

          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.moveTo(w, 0); // Top Left (mirrored)
          ctx.lineTo(w, leftTemple.y * h); 
          ctx.lineTo(leftTemple.x * w, leftTemple.y * h); 

          for (let idx of hairlineCurve) {
              const pt = landmarks[idx];
              if (pt) ctx.lineTo(pt.x * w, pt.y * h);
          }

          ctx.lineTo(rightTemple.x * w, rightTemple.y * h);
          ctx.lineTo(0, rightTemple.y * h); 
          ctx.lineTo(0, 0); 
          ctx.closePath();
          
          // Apply blur at edges for blending as specifically requested
          ctx.filter = 'blur(5px)';
          ctx.fill();
          ctx.filter = 'none';

          // 4. DRAW New Hairstyle
          ctx.globalCompositeOperation = 'source-over';
          
          const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
          const anchorY = topForehead.y * h;
          
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx*dx + dy*dy);
          
          // Dynamic scaling
          const targetW = headWidthPx * 1.5;

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
              
              // Anchor to forehead (do not center). Image mostly sits upwards.
              const yOffset = -drawH * 0.91; 

              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
              
              // Perspective skew
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);
              
              // Blur at edges slightly as requested (requires Canvas 2D filters, or we just rely on scaling)
              ctx.filter = `drop-shadow(0px 10px 10px rgba(0,0,0,0.5))`;
              ctx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
              ctx.filter = 'none';
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
