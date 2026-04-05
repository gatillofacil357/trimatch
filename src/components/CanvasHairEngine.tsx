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
          // Forehead geometry mapping
          const foreheadIndices = [234, 227, 116, 111, 117, 118, 101, 100, 109, 10, 338, 330, 331, 340, 346, 347, 447, 454];
          
          // 3. REMOVE ORIGINAL HAIR
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          
          // We start at the left temple
          const startPt = landmarks[foreheadIndices[0]];
          ctx.moveTo(startPt.x * w, startPt.y * h);
          
          // Go UP to top left corner of screen
          ctx.lineTo(0, startPt.y * h);
          ctx.lineTo(0, 0); // Top Left
          ctx.lineTo(w, 0); // Top Right
          
          // Go to Right Temple
          const endPt = landmarks[foreheadIndices[foreheadIndices.length - 1]];
          ctx.lineTo(w, endPt.y * h);
          ctx.lineTo(endPt.x * w, endPt.y * h);

          // Trace backwards across the hairline to connect
          for (let i = foreheadIndices.length - 1; i >= 0; i--) {
             const pt = landmarks[foreheadIndices[i]];
             ctx.lineTo(pt.x * w, pt.y * h);
          }
          
          // Apply blur to the erasure edge to blend naturally
          ctx.filter = 'blur(4px)';
          ctx.fill();
          ctx.filter = 'none';

          // 4. DRAW NEW HAIRSTYLE
          const leftTemple = landmarks[234];
          const rightTemple = landmarks[454];
          const nose = landmarks[1];
          const topForehead = landmarks[10];

          // Compute anchor (midpoint of temples for X, forehead for Y)
          const anchorX = ((leftTemple.x + rightTemple.x) / 2) * w;
          const anchorY = topForehead.y * h;

          // Compute dynamic scale
          const dx = (rightTemple.x - leftTemple.x) * w;
          const dy = (rightTemple.y - leftTemple.y) * h;
          const headWidthPx = Math.sqrt(dx*dx + dy*dy);
          
          // The hair needs to be slightly wider than the face
          const targetW = headWidthPx * 1.5;

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
              
              // Lift the image so 95% of it is ABOVE the forehead line,
              // leaving only 5% of overlap to blend into the skin edge.
              // This strictly prevents the image from covering the eyes.
              const yOffset = -drawH * 0.95;

              // 5. BLENDING & SKEW (Canvas transform)
              ctx.globalCompositeOperation = 'source-over';
              
              // We want to tint it slightly to match room lighting. We can't do complex shaders in 2D,
              // but we can adjust globalAlpha or drop shadow if needed.
              
              const moveX = sr.x;
              const moveY = sr.y;

              ctx.translate(moveX, moveY);
              
              // Apply Roll
              ctx.rotate(-sr.rotZ); 

              // Simulate 3D Yaw by squishing X scale based on rotY
              // If rotY is positive, head turned right. We compress width.
              const yawSquish = Math.cos(sr.rotY);
              ctx.scale(yawSquish, 1.0);

              // Draw
              ctx.drawImage(hairImg, -drawW / 2, yOffset, drawW, drawH);
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
