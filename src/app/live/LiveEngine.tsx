"use client";

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';

// Components
import CanvasHairEngine from '@/components/CanvasHairEngine';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';

// Hooks & Utils
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { useHairSegmenter } from '@/hooks/useHairSegmenter';
import { analyzeFaceShape, AnalysisResult } from '@/utils/FaceShapeAnalyzer';
import styles from './page.module.css';

const HAIRSTYLES = [
  { id: 'fade', name: 'Fade Clásico' },
  { id: 'buzz', name: 'Buzz Cut' },
  { id: 'undercut', name: 'Undercut' }
];

const COLORS = [
  { id: 'black', hex: '#222222', name: 'Negro' },
  { id: 'brown', hex: '#3d2b26', name: 'Marrón' },
  { id: 'blonde', hex: '#c2a371', name: 'Rubio' }
];

export default function LiveEngine() {
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { faceLandmarker, loading: flLoading } = useFaceLandmarker();
  const { imageSegmenter, loading: segLoading } = useHairSegmenter();
  
  const [activeStyle, setActiveStyle] = useState(HAIRSTYLES[0].id);
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // TRACKING REFS
  const trackingRef = useRef({
    landmarks: [] as any[],
    matrix: null as THREE.Matrix4 | null,
    viewport: { vWidth: 0, vHeight: 0 },
    lastUpdateTime: 0
  });

  const segmentationRef = useRef<{ mask: Float32Array | null, width: number, height: number }>({
    mask: null, width: 0, height: 0
  });

  const [mpInitialized, setMpInitialized] = useState(false);
  const dummyWebcamRef = useRef<any>(null); // For FaceOccluder strict typing

  useEffect(() => {
    if (!faceLandmarker || !imageSegmenter || !webcamRef.current) return;

    let animationFrameId: number;
    const video = webcamRef.current.video!;

    const renderLoop = () => {
      if (video.readyState === 4) {
        const time = performance.now();
        
        // 1. LANDMARKS
        const results = faceLandmarker.detectForVideo(video, time);
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          trackingRef.current.landmarks = results.faceLandmarks[0];
          
          if (results.facialTransformationMatrixes?.[0]) {
            trackingRef.current.matrix = new THREE.Matrix4().fromArray(results.facialTransformationMatrixes[0].data);
          } else {
            trackingRef.current.matrix = new THREE.Matrix4().identity();
          }
          
          // VIEWPORT (Use pixels to match FaceOccluder logic in TryOnStudio)
          if (containerRef.current) {
            trackingRef.current.viewport = {
              vWidth: containerRef.current.clientWidth,
              vHeight: containerRef.current.clientHeight
            };
          }

          if (!mpInitialized) setMpInitialized(true);
        }

        // 2. SEGMENTATION (Re-enabled for v10.0 Realism)
        imageSegmenter.segmentForVideo(video, time, (result) => {
            if (result.confidenceMasks) {
                const mask = result.confidenceMasks[0].getAsFloat32Array();
                segmentationRef.current = {
                    mask,
                    width: result.confidenceMasks[0].width,
                    height: result.confidenceMasks[0].height
                };
            }
        });
      }
      
      const delay = performanceMode ? 1000 / 15 : 0;
      if (delay > 0) {
        setTimeout(() => { animationFrameId = requestAnimationFrame(renderLoop); }, delay);
      } else {
        animationFrameId = requestAnimationFrame(renderLoop);
      }
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [faceLandmarker, performanceMode, mpInitialized]);

  const handleCapture = async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    setIsCapturing(true);
    try {
      const results = faceLandmarker?.detect(webcamRef.current.video);
      if (results && results.faceLandmarks.length > 0) {
        const result = analyzeFaceShape(results.faceLandmarks[0]);
        setAnalysis(result);
      }
    } catch (e) {
      console.error("Capture analysis error:", e);
    }
    setIsCapturing(false);
  };

  const isLoading = flLoading || segLoading;

  return (
    <div className={styles.container}>
      {isLoading && (
          <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
              Inicializando AR v9.1 (Deep Refresh)...
          </div>
      )}

      <div className={styles.cameraWrapper} ref={containerRef}>
        <div className={styles.versionBadge}>AR Engine v11.1 (Refined Geometry) ✅</div>
        <Webcam 
          ref={webcamRef}
          mirrored={false} 
          audio={false}
          className={styles.webcam}
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
          videoConstraints={{ facingMode: "user" }}
        />
        
        {analysis && (
          <div className={styles.analysisOverlay}>
             Rostro: <strong>{analysis.shape.toUpperCase()}</strong>
          </div>
        )}

        {mpInitialized && (
          <CanvasHairEngine
            webcamRef={webcamRef}
            trackingRef={trackingRef}
            segmentationRef={segmentationRef}
            activeStyle={activeStyle}
          />
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.section}>
          <h3>ESTILOS IDEALES</h3>
          <div className={styles.grid}>
            {HAIRSTYLES.map(s => (
              <button 
                key={s.id} 
                className={`${styles.btn} ${activeStyle === s.id ? styles.active : ''}`}
                onClick={() => setActiveStyle(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <button 
            className={`${styles.captureBtn} ${isCapturing ? styles.loading : ''}`}
            onClick={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? 'Analizando...' : '📸 Sacar Foto'}
          </button>
          
          <button 
            className={`${styles.perfBtn} ${performanceMode ? styles.active : ''}`}
            onClick={() => setPerformanceMode(!performanceMode)}
          >
            {performanceMode ? '🔋 Modo Ahorro: ON' : '⚡ Modo Ahorro: OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
