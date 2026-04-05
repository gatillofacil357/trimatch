"use client";

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface HairOverlay2DProps {
  styleId: string;
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number }
  }>;
}

// 3. ESTRUCTURA DE DATOS
const ASSETS: Record<string, { front: string, side?: string, back?: string }> = {
  'fade': {
    front: '/assets/hair/fade.png',
  },
  'buzz': {
    front: '/assets/hair/buzz.png',
  },
  'undercut': {
    front: '/assets/hair/undercut.png',
  }
};

export default function HairOverlay2D({ styleId, trackingRef }: HairOverlay2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [assetStatus, setAssetStatus] = useState<'LOADING' | 'VALID' | 'INVALID'>('LOADING');

  // EMA Smoothing State
  const stateRef = useRef({
    x: 0, y: 0, width: 0, 
    rotX: 0, rotY: 0, rotZ: 0,
    initialized: false
  });

  // 1 & 2. FILTRADO Y VALIDACIÓN DE TRANSPARENCIA
  useEffect(() => {
    setAssetStatus('LOADING');
    
    // SOLO MODO AR: usar exclusivamente assets.front
    const src = ASSETS[styleId]?.front;
    if (!src) {
      setAssetStatus('INVALID');
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      // Rechazar imágenes con múltiples vistas (aspect ratio muy ancho)
      const aspect = img.naturalWidth / img.naturalHeight;
      if (aspect > 1.35) {
        console.warn(`[AR Engine] Asset ${src} bloqueado: parece contener múltiples vistas (ratio ${aspect}).`);
        setAssetStatus('INVALID');
        return;
      }

      // Validar canal alpha real (Canvas API)
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        // Muestrear esquinas buscando fondos sólidos / blancos
        const coords = [
          [0, 0], 
          [img.naturalWidth - 1, 0], 
          [0, Math.floor(img.naturalHeight / 2)], 
          [img.naturalWidth - 1, Math.floor(img.naturalHeight / 2)] 
        ];
        
        let hasSolidBg = false;
        for (let [x, y] of coords) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          // Si el pixel es completamente opaco (Alpha = 255)
          if (pixel[3] === 255) {
            hasSolidBg = true;
            break;
          }
        }
        
        if (hasSolidBg) {
          console.warn(`[AR Engine] Asset ${src} bloqueado: detectado fondo sólido (no tiene canal alpha transparente).`);
          setAssetStatus('INVALID');
          return;
        }
      }

      setAssetStatus('VALID');
      if (imgRef.current) imgRef.current.src = src;
    };
    
    img.onerror = () => setAssetStatus('INVALID');
    img.src = src;
    
  }, [styleId]);

  useEffect(() => {
    // 4. BLOQUEO DE ERRORES: Si no es válido, no hacer tracking
    if (assetStatus !== 'VALID') return;

    const smoothing = 0.35; 

    const updatePosition = () => {
      const { landmarks, matrix } = trackingRef.current;
      if (landmarks && landmarks.length > 0 && matrix && containerRef.current && imgRef.current) {
        // POSITION
        const hairline = landmarks[151] || landmarks[10]; 
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        const targetX = hairline.x * 100;
        const targetY = hairline.y * 100;

        // SCALING
        const dx = rightTemple.x - leftTemple.x;
        const dy = rightTemple.y - leftTemple.y;
        const templeDist = Math.sqrt(dx * dx + dy * dy);
        const targetWidth = templeDist * 165; // Ajuste manual para compensar recorte frontal

        // ROTATION
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        matrix.decompose(pos, quat, scl);
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        let targetRotX = euler.x; 
        let targetRotY = euler.y; 
        let targetRotZ = euler.z;

        // EMA SMOOTHING
        if (!stateRef.current.initialized) {
          stateRef.current = { 
            x: targetX, y: targetY, width: targetWidth, 
            rotX: targetRotX, rotY: targetRotY, rotZ: targetRotZ,
            initialized: true 
          };
        } else {
          stateRef.current.x += (targetX - stateRef.current.x) * smoothing;
          stateRef.current.y += (targetY - stateRef.current.y) * smoothing;
          stateRef.current.width += (targetWidth - stateRef.current.width) * smoothing;
          stateRef.current.rotX += (targetRotX - stateRef.current.rotX) * smoothing;
          stateRef.current.rotY += (targetRotY - stateRef.current.rotY) * smoothing;
          stateRef.current.rotZ += (targetRotZ - stateRef.current.rotZ) * smoothing;
        }

        const sr = stateRef.current;

        // APPLICATION
        imgRef.current.style.width = `${sr.width}%`;
        imgRef.current.style.left = `${sr.x}%`;
        imgRef.current.style.top = `${sr.y}%`;
        
        const degX = sr.rotX * (180 / Math.PI);
        const degY = -sr.rotY * (180 / Math.PI); 
        const degZ = -sr.rotZ * (180 / Math.PI);

        imgRef.current.style.transform = `translate(-50%, -75%) perspective(600px) rotateY(${degY}deg) rotateX(${degX}deg) rotateZ(${degZ}deg)`;
      }
      requestAnimationFrame(updatePosition);
    };

    const animId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animId);
  }, [trackingRef, assetStatus]);

  // Si no hay imagen, o está cargando, esperar.
  if (assetStatus === 'LOADING') return null;

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 50, overflow: 'hidden'
      }}
    >
      <img 
        ref={imgRef}
        alt="AR Hair Frontend"
        style={{
          position: 'absolute', transition: 'none', display: 'block',
          mixBlendMode: 'normal',
          WebkitMaskImage: 'linear-gradient(to top, transparent 5%, black 25%)',
          maskImage: 'linear-gradient(to top, transparent 5%, black 25%)',
          // 5. DEBUG VISUAL
          border: assetStatus === 'VALID' ? '3px solid #00ff00' : '3px solid #ff0000',
          boxSizing: 'border-box'
        }}
        // Ocultar si es inválida
        hidden={assetStatus === 'INVALID'}
      />
      {assetStatus === 'INVALID' && (
        <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', color: 'white', background: '#ff0000', padding: '10px', borderRadius: '8px', zIndex: 100, textAlign: 'center', fontWeight: 'bold' }}>
          BLOQUEO AR ACTIVO<br/>El asset contiene fondo sólido o múltiples vistas.
        </div>
      )}
    </div>
  );
}
