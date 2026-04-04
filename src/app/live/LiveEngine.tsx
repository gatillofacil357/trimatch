"use client";

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Canvas } from '@react-three/fiber';
import HairMesh from '@/components/HairMesh';
import FaceOccluder from '@/components/FaceOccluder';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { analyzeFaceShape, AnalysisResult } from '@/utils/FaceShapeAnalyzer';
import styles from './page.module.css';
import * as THREE from 'three';


const HAIRSTYLES = [
  { id: 'fade', name: 'Fade Clásico' },
  { id: 'buzz', name: 'Buzz Cut' },
  { id: 'undercut', name: 'Undercut' },
  { id: 'pompadour', name: 'Pompadour' },
  { id: 'textured', name: 'Corto Texturizado' },
  { id: 'long', name: 'Pelo Largo' }
];

const COLORS = [
  { id: 'black', name: 'Negro', hex: '#222222' },
  { id: 'brown', name: 'Castaño', hex: '#3d2b1f' },
  { id: 'blonde', name: 'Rubio', hex: '#b89765' },
  { id: 'neon', name: 'Neón', hex: '#00ffcc' },
];

export default function LiveEngine() {
  const webcamRef = useRef<Webcam>(null);
  const { faceLandmarker, loading, error: cameraError } = useFaceLandmarker();
  
  const [activeStyle, setActiveStyle] = useState(HAIRSTYLES[0].id);
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // HIGH-PERFORMANCE TRACKING REFS
  // This ref is the source of truth for the AR overlay, bypassing React re-renders.
  const trackingRef = useRef<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>({
    landmarks: [],
    matrix: null,
    viewport: { vWidth: 0, vHeight: 0 },
    lastUpdateTime: 0
  });

  const [mpInitialized, setMpInitialized] = useState(false);


  useEffect(() => {
    let animationFrameId: number;
    let lastVideoTime = -1;
    let frameCount = 0;

    const renderLoop = (time: number) => {
      const video = webcamRef.current?.video;
      if (video && video.readyState === 4 && faceLandmarker) {
        // PERFORMANCE OVERRIDE: Skip every other frame if in performance mode
        frameCount++;
        const shouldProcess = !performanceMode || (frameCount % 2 === 0);

        if (lastVideoTime !== video.currentTime && shouldProcess) {
          lastVideoTime = video.currentTime;
          try {
            const results = faceLandmarker.detectForVideo(video, time);
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const currentLandmarks = results.faceLandmarks[0];
              const matrixArray = results.facialTransformationMatrixes?.[0]?.data;

              // Update Shared Tracking Data (Synchronous)
              trackingRef.current.landmarks = currentLandmarks;
              if (matrixArray) {
                  trackingRef.current.matrix = new THREE.Matrix4().fromArray(matrixArray);
              }

              // Update Viewport Sync
              const fov = 50;
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const vHeight = 2 * Math.tan((fov / 2) * (Math.PI / 180)) * 5;
              const vWidth = vHeight * videoAspectRatio;
              trackingRef.current.viewport = { vWidth, vHeight };
              trackingRef.current.lastUpdateTime = time;

              // Periodic background analysis (doesn't need to be every frame)
              if (!analysis || Math.random() > 0.98) {
                setAnalysis(analyzeFaceShape(currentLandmarks));
              }
              
              if (!mpInitialized) setMpInitialized(true);
            }
          } catch(e) {
              console.error("MP Error:", e);
          }
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    if (faceLandmarker) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }


    return () => cancelAnimationFrame(animationFrameId);
  }, [faceLandmarker, performanceMode]); 

  const handleCapture = async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    setIsCapturing(true);
    
    try {
      const video = webcamRef.current.video;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      // Create a temporary canvas to combine video + 3D
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      const ctx = captureCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw Video (mirrored)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
      ctx.restore();

      // 2. Draw 3D Overlay
      // Three.js canvas matches the container size, we need to scale it to video size
      ctx.drawImage(canvas, 0, 0, video.videoWidth, video.videoHeight);

      // 3. Download
      const link = document.createElement('a');
      link.download = `trimatch-style-${activeStyle}-${Date.now()}.png`;
      link.href = captureCanvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error("Capture error:", e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className={styles.liveContainer}>
      {loading && !cameraError && (
          <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
              Inicializando AR Pro v4.5 (High Performance)...
          </div>
      )}
      
      {cameraError && (
        <div className={styles.errorOverlay}>
           <h2>⚠️ Error de Cámara</h2>
           <p>Permití el acceso para ver el resultado en vivo.</p>
        </div>
      )}

      <div className={styles.cameraWrapper}>
        <div className={styles.versionBadge}>AR Engine v4.5 ✅</div>
        <Webcam 
          ref={webcamRef}
          mirrored={true} 
          audio={false}
          className={styles.webcam}
          onUserMedia={() => console.log("Webcam: Active")}
          videoConstraints={{ facingMode: "user" }}
        />
        
        {analysis && (
            <div className={styles.liveAnalysisBadge}>
                Rostro: <strong>{analysis.shape.toUpperCase()}</strong>
            </div>
        )}

        <div className={styles.captureOverlay}>
            <button 
              className={`${styles.captureBtn} ${isCapturing ? styles.capturing : ''}`}
              onClick={handleCapture}
              disabled={isCapturing}
            >
              {isCapturing ? '📷...' : '📷 Sacar Foto'}
            </button>
        </div>

        <div className={styles.canvasOverlay}>
          <Canvas 
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
            onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
            }}
          >
            <ambientLight intensity={1.5} />
            <spotLight position={[5, 10, 5]} intensity={3.0} angle={0.15} />
            
            {/* PASS TRACKING REF TO COMPONENTS */}
            {mpInitialized && (
                <>
                    <FaceOccluder 
                      trackingRef={trackingRef} 
                    />
                    
                    <HairMesh 
                        styleId={activeStyle} 
                        color={activeColor} 
                        trackingRef={trackingRef}
                        shape={analysis?.shape}
                    />
                </>
            )}
          </Canvas>
        </div>
      </div>


      {!loading && !cameraError && (
        <div className={styles.controlsPanel}>
          <div className={styles.controlGroup}>
            <div className={styles.groupHeader}>
                <h3>Estilos Ideales</h3>
                {analysis && <span className={styles.recBadge}>{analysis.shape} ✨</span>}
                <button 
                  className={`${styles.perfModeBtn} ${performanceMode ? styles.perfActive : ''}`}
                  onClick={() => setPerformanceMode(!performanceMode)}
                >
                  {performanceMode ? '⚡ Modo Ahorro: ON' : '🔋 Modo Ahorro: OFF'}
                </button>
            </div>
            <div className={styles.carousel}>
              {HAIRSTYLES.map(style => {
                const isRecommended = analysis?.recommendations.includes(style.id);
                return (
                    <button 
                      key={style.id} 
                      className={`${styles.styleBtn} ${activeStyle === style.id ? styles.activeStyle : ''} ${isRecommended ? styles.recommendedStyle : ''}`}
                      onClick={() => setActiveStyle(style.id)}
                    >
                      {style.name} {isRecommended && '✨'}
                    </button>
                );
              })}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <h3>Tono AR</h3>
            <div className={styles.colorPalette}>
              {COLORS.map(color => (
                <button 
                  key={color.id}
                  className={`${styles.colorBtn} ${activeColor === color.hex ? styles.activeColor : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setActiveColor(color.hex)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
