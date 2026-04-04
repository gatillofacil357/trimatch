"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { analyzeFaceShape, AnalysisResult, FaceShape } from '@/utils/FaceShapeAnalyzer';
import styles from './page.module.css';

const ANALYSIS_DURATION = 3000; // 3 seconds to stabilize

export default function AnalyzePage() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const { faceLandmarker, loading, error } = useFaceLandmarker();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando cámara...');
  const [resultsBuffer, setResultsBuffer] = useState<AnalysisResult[]>([]);

  const handleAnalysisComplete = useCallback((finalResult: AnalysisResult) => {
    // Save identifying info to session storage for the results page
    const metricsStr = encodeURIComponent(JSON.stringify(finalResult.metrics));
    router.push(`/results?shape=${finalResult.shape}&metrics=${metricsStr}`);
  }, [router]);

  useEffect(() => {
    if (!faceLandmarker || loading) return;
    setIsAnalyzing(true);
    setStatus('Detectando proporciones...');
    
    let startTime = Date.now();
    let animationFrameId: number;

    const runAnalysis = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const currentProgress = Math.min((elapsed / ANALYSIS_DURATION) * 100, 100);
        setProgress(currentProgress);

        if (webcamRef.current?.video?.readyState === 4) {
            const video = webcamRef.current.video;
            const results = faceLandmarker.detectForVideo(video, now);
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const analysis = analyzeFaceShape(results.faceLandmarks[0]);
                setResultsBuffer(prev => [...prev, analysis].slice(-10)); // Keep last 10 samples
                setStatus(`Analizando: ${analysis.shape.charAt(0).toUpperCase() + analysis.shape.slice(1)}`);
            } else {
                setStatus('Buscando rostro...');
            }
        }

        if (elapsed < ANALYSIS_DURATION) {
            animationFrameId = requestAnimationFrame(runAnalysis);
        } else {
            // End of analysis - find most frequent shape in buffer
            if (resultsBuffer.length > 0) {
                const counts: Record<string, number> = {};
                resultsBuffer.forEach(r => counts[r.shape] = (counts[r.shape] || 0) + 1);
                const mostFrequentShape = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) as FaceShape;
                const finalResult = resultsBuffer.find(r => r.shape === mostFrequentShape) || resultsBuffer[0];
                handleAnalysisComplete(finalResult);
            } else {
                // Retry if no face found
                startTime = Date.now();
                animationFrameId = requestAnimationFrame(runAnalysis);
            }
        }
    };

    animationFrameId = requestAnimationFrame(runAnalysis);
    return () => cancelAnimationFrame(animationFrameId);
  }, [faceLandmarker, loading, handleAnalysisComplete, resultsBuffer]);

  if (error) {
    return (
        <div className={styles.container}>
            <div className={styles.errorCard}>
                <h2>Huston, tenemos un problema</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className={styles.retryBtn}>Reintentar</button>
            </div>
        </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.webcamContainer}>
            <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className={styles.webcam}
                videoConstraints={{ facingMode: "user" }}
            />
            <div className={styles.overlay}>
                <div className={styles.scannerLine} style={{ top: `${progress}%` }}></div>
                <div className={styles.faceGuideline}></div>
            </div>
        </div>

        <div className={styles.infoPanel}>
            <h2 className={styles.title}>{status}</h2>
            <div className={styles.progressBarWrapper}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
            </div>
            <p className={styles.subtitle}>Mantené el rostro centrado y una expresión neutra</p>
        </div>
      </main>
    </div>
  );
}
