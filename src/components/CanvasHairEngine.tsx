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

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(video, 0, 0, w, h);

        if (landmarks && landmarks.length > 0) {
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const topForehead = landmarks[10];

          const offCanvas = document.createElement('canvas');
          offCanvas.width = w;
          offCanvas.height = h;
          const octx = offCanvas.getContext('2d');
          
          if (octx) {
              octx.translate(w, 0);
              octx.scale(-1, 1);

              const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
              const anchorY = topForehead.y * h;
              
              const dx = (rightTemple.x - leftTemple.x) * w;
              const dy = (rightTemple.y - leftTemple.y) * h;
              const headWidthPx = Math.sqrt(dx*dx + dy*dy);
              const targetW = headWidthPx * 1.6;

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
                  const yOffset = -drawH * 0.90; 

                  octx.save();
                  octx.translate(sr.x, sr.y);
                  octx.rotate(-sr.rotZ); 
                  octx.scale(Math.cos(sr.rotY), 1.0);
                  octx.filter = `brightness(0.9) contrast(1.1)`;
                  octx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
                  octx.restore();

                  const hairlineCurve = [
                    234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454 
                  ];

                  octx.globalCompositeOperation = 'destination-out';
                  octx.filter = 'blur(6px)'; 

                  octx.beginPath();
                  octx.moveTo(w, h); 
                  octx.lineTo(w, leftTemple.y * h); 
                  octx.lineTo(leftTemple.x * w, leftTemple.y * h); 

                  for (let idx of hairlineCurve) {
                      const pt = landmarks[idx];
                      if (pt) octx.lineTo(pt.x * w, pt.y * h);
                  }

                  octx.lineTo(rightTemple.x * w, rightTemple.y * h);
                  octx.lineTo(0, rightTemple.y * h); 
                  octx.lineTo(0, h); 
                  octx.closePath();
                  octx.fill();
              }

              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0); 
              ctx.drawImage(offCanvas, 0, 0);
              ctx.restore();
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
