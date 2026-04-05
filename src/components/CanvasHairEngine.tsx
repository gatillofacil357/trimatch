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
  segmentationRef: React.RefObject<ImageData | null>;
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

        // 1. Draw the Video Feed (Background + Person)
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(video, 0, 0, w, h);

        if (landmarks && landmarks.length > 0) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const topForehead = landmarks[10];

          // We build the physical isolation mask
          const segImg = segmentationRef.current;
          if (segImg && segImg.width > 0 && segImg.height > 0) {
              const segCanvas = document.createElement('canvas');
              segCanvas.width = segImg.width;
              segCanvas.height = segImg.height;
              const sCtx = segCanvas.getContext('2d');
              
              if (sCtx) {
                  // A. Draw natively mapped ImageData directly
                  sCtx.putImageData(segImg, 0, 0);

                  // B. We ONLY want to erase the hair (top of head). 
                  // So we intersect the Selfie Mask with an Upper-Head Polygon!
                  // We draw a bounding box that ONLY covers the top of the monitor down to the forehead.
                  sCtx.globalCompositeOperation = 'destination-in';
                  
                  sCtx.save();
                  sCtx.translate(segImg.width, 0);
                  sCtx.scale(-1, 1);
                  
                  sCtx.beginPath();
                  sCtx.moveTo(segImg.width, 0); // Physical Left Top
                  sCtx.lineTo(segImg.width, leftTemple.y * segImg.height);
                  sCtx.lineTo(leftTemple.x * segImg.width, leftTemple.y * segImg.height);
                  
                  // Smooth Bezier Curve across the forehead
                  const midY = (leftTemple.y + rightTemple.y) / 2;
                  const cpY = 2 * topForehead.y - midY;
                  sCtx.quadraticCurveTo(topForehead.x * segImg.width, cpY * segImg.height, rightTemple.x * segImg.width, rightTemple.y * segImg.height);
                  
                  sCtx.lineTo(0, rightTemple.y * segImg.height); // To Physical Right
                  sCtx.lineTo(0, 0); // To Top Right
                  sCtx.closePath();
                  sCtx.fill();
                  sCtx.restore();

                  // segCanvas now EXACTLY equals the user's physical hair silhouette!
                  // C. Erase the hair silhouette from the LIVE VIDEO
                  ctx.globalCompositeOperation = 'destination-out';
                  ctx.filter = 'blur(4px)'; // Soft blend the erased hole
                  ctx.drawImage(segCanvas, 0, 0, w, h);
                  ctx.filter = 'none';
              }
          }

          // 3. DRAW New Hairstyle PNG over the erased hole
          ctx.globalCompositeOperation = 'source-over';
          
          const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
          const anchorY = topForehead.y * h;
          
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx*dx + dy*dy);
          
          // Scale it to fully cover the erased hair hole
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
              
              // Anchor firmly above the forehead curve
              const yOffset = -drawH * 0.91; 

              ctx.translate(sr.x, sr.y);
              ctx.rotate(-sr.rotZ); 
              
              // Apply Yaw squish perspective
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);
              
              // Subtle physical shadowing to ground the hair to the scalp
              ctx.filter = `drop-shadow(0px 8px 6px rgba(0,0,0,0.6)) grayscale(0.9)`;
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
