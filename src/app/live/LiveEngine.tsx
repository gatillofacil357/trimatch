"use client";

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';

// Components
import CanvasHairEngine from '@/components/CanvasHairEngine';

// Hooks & Utils
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { useHairSegmenter } from '@/hooks/useHairSegmenter';
import { analyzeFaceShape, AnalysisResult } from '@/utils/FaceShapeAnalyzer';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
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
    lastUpdateTime: 0,
    segmenting: false
  });

  const segmentationRef = useRef<ImageData | null>(null);

  const [mpInitialized, setMpInitialized] = useState(false);

  useEffect(() => {
    if (!faceLandmarker || !webcamRef.current) return;

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
          }
          
          // 2. SEGMENTATION (v9.2 TFJS Async)
          if (imageSegmenter && !trackingRef.current.segmenting) {
             trackingRef.current.segmenting = true;
             imageSegmenter.segmentPeople(video).then(async (people) => {
                 if (people && people.length > 0) {
                     // bodySegmentation exposes a helper to convert predictions directly to an ImageData alpha mask
                     try {
                         const imgData = await bodySegmentation.toBinaryMask(people);
                         
                         segmentationRef.current = imgData;
                         trackingRef.current.segmenting = false;
                     } catch(err) {
                         console.error("Mask conversion error:", err);
                         trackingRef.current.segmenting = false;
                     }
                 } else {
                     trackingRef.current.segmenting = false;
                 }
             }).catch(err => {
                 console.error("Segmentation error:", err);
                 trackingRef.current.segmenting = false;
             });
          }

          // VIEWPORT
          const videoAspectRatio = video.videoWidth / video.videoHeight;
          trackingRef.current.viewport = {
            vWidth: 5.0 * videoAspectRatio,
            vHeight: 5.0
          };

          if (!mpInitialized) setMpInitialized(true);
        }
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
  }, [faceLandmarker, imageSegmenter, performanceMode, mpInitialized]);

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

      <div className={styles.cameraWrapper}>
        <div className={styles.versionBadge}>AR Engine v9.1 ✅</div>
        <Webcam 
          ref={webcamRef}
          mirrored={true} 
          audio={false}
          className={styles.webcam}
          videoConstraints={{ facingMode: "user" }}
        />
        
        {analysis && (
          <div className={styles.analysisOverlay}>
             Rostro: <strong>{analysis.shape.toUpperCase()}</strong>
          </div>
        )}

        {mpInitialized && (
          <>
            {/* PURE 2D PIPELINE: ERASES HAIR AND COMPOSITES NEW STYLES NATIVELY */}
            <CanvasHairEngine 
               webcamRef={webcamRef} 
               trackingRef={trackingRef} 
               segmentationRef={segmentationRef} 
               activeStyle={activeStyle}
            />
          </>
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
