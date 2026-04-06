"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import CanvasHairEngine from '@/components/CanvasHairEngine';
import StyleSearch from '@/components/StyleSearch';
import { useFaceLandmarker } from '@/hooks/useFaceLandmarker';
import { analyzeFaceShape, AnalysisResult, FaceMetrics, saveAnalysis, getStoredAnalysis } from '@/utils/FaceShapeAnalyzer';
import { supabase, Barber } from '@/utils/supabase';
import styles from './page.module.css';

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

function TryOnStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Iniciando...');
  const [faceData, setFaceData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(getStoredAnalysis());
  const [activeStyle, setActiveStyle] = useState(HAIRSTYLES[0].id);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [compareMode, setCompareMode] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showSearch, setShowSearch] = useState(false);
  const [referenceStyle, setReferenceStyle] = useState<{name: string, url: string} | null>(null);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const trackingRef = useRef<any>({
    landmarks: [],
    matrix: new THREE.Matrix4(),
    viewport: { vWidth: 0, vHeight: 0 },
    lastUpdateTime: 0
  });

  const { faceLandmarker, loading: mpLoading } = useFaceLandmarker();
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dummyWebcamRef = useRef<any>(null); // For FaceOccluder strict typing

  useEffect(() => {
    trackingRef.current.viewport = containerSize;
  }, [containerSize]);

  useEffect(() => {
    const savedImg = sessionStorage.getItem('trimatch_image');
    if (savedImg) {
      setImageSrc(savedImg);
    } else {
      setLoadingMsg('No se encontró la foto. Por favor, subí una nuevamente.');
    }
  }, []);

  // Detection
  useEffect(() => {
    if (!imageSrc || !faceLandmarker || !imgRef.current) return;
    
    const analyze = async () => {
        const img = imgRef.current!;
        if (!img.complete) {
            img.onload = () => analyze();
            return;
        }

        try {
            const results = faceLandmarker.detect(img);
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const currentLandmarks = results.faceLandmarks[0];
                setLandmarks(currentLandmarks);
                
                // Update Ref for engine
                trackingRef.current.landmarks = currentLandmarks;
                trackingRef.current.lastUpdateTime = Date.now();
                
                // If there's a transformation matrix (assuming identity for static image if not provided)
                // In Conversation 2710ffc9 it was about ref-driven graphics, so I'll ensure matrix exists
                if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
                   const m = results.facialTransformationMatrixes[0].data;
                   trackingRef.current.matrix.fromArray(m);
                } else {
                   trackingRef.current.matrix.identity();
                }

                const result = analyzeFaceShape(currentLandmarks);
                setAnalysis(result);
                saveAnalysis(result); // Persist for session recovery
                setActiveStyle(result.recommendations[0]);
                
                // (Previous faceData logic omitted if redundant with ref, but keeping for compatibility if used elsewhere)
                const leftEar = currentLandmarks[234];
                const rightEar = currentLandmarks[454];
                const nose = currentLandmarks[1];
                const forehead = currentLandmarks[10];
                const faceWidth = Math.abs(rightEar.x - leftEar.x);
                const roll = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x);

                setFaceData({
                    x: nose.x,
                    y: forehead.y,
                    roll: roll,
                    scale: faceWidth
                });
                
                setLoadingMsg('');
            } else {
                setLoadingMsg('Error: Intentá con otra foto de frente.');
            }
        } catch (err) {
            console.error(err);
            setLoadingMsg('Error de análisis.');
        }
    };

    analyze();
  }, [imageSrc, faceLandmarker]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleBookingClick = () => {
    const selectedStyleName = HAIRSTYLES.find(s => s.id === activeStyle)?.name || activeStyle;
    sessionStorage.setItem('trimatch_selected_style', selectedStyleName);
    if (referenceStyle) {
        sessionStorage.setItem('trimatch_reference_style', JSON.stringify(referenceStyle));
    }
    router.push('/barbers');
  };

  const renderHairOverlay = () => {
    if (!faceData || compareMode || loadingMsg || containerSize.width === 0 || landmarks.length === 0) return null;
    
    return (
      <div className={styles.canvasOverlay}>
        <CanvasHairEngine
          webcamRef={imgRef as any}
          trackingRef={trackingRef}
          activeStyle={activeStyle}
          segmentationRef={{ current: { mask: null, width: 0, height: 0 } } as any}
          mirrored={false}
        />
      </div>
    );
  };

  return (
    <div className={styles.studioContainer}>
      <div className={styles.imageWrapper} ref={containerRef}>
        {imageSrc && (
          <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Tu foto" 
            className={styles.userImage} 
            style={{ opacity: 0 }}
            crossOrigin="anonymous"
          />
        )}
        {loadingMsg && (
          <div className={styles.overlayLoading}>
            <div className={styles.spinner}></div>
            <p>{loadingMsg}</p>
          </div>
        )}
        {renderHairOverlay()}
        
        {referenceStyle && (
            <div className={styles.referenceBadge}>
                <img src={referenceStyle.url} alt="Referencia" />
                <span>Referencia: {referenceStyle.name}</span>
                <button onClick={() => setReferenceStyle(null)}>×</button>
            </div>
        )}
      </div>

      {!loadingMsg && analysis && (
        <div className={styles.controlsPanel}>
          <div className={styles.recommendationAlert}>
             <strong>Rostro {analysis.shape.toUpperCase()} ✨</strong>
          </div>

          <button className={styles.searchInspirationBtn} onClick={() => setShowSearch(true)}>
            🌐 Inspiración en la Web
          </button>

          <div className={styles.controlsHeader}>
            <div className={styles.titleCol}>
                <h2>Simulador Realista 4.0</h2>
                <div className={styles.badgeAR}>Oclusión Facial Activa 🛡️</div>
            </div>
            <button 
              className={styles.compareBtn}
              onPointerDown={() => setCompareMode(true)}
              onPointerUp={() => setCompareMode(false)}
              onPointerLeave={() => setCompareMode(false)}
            >
              Antes
            </button>
          </div>

          <div className={styles.controlGroup}>
            <h3>Catálogo IA</h3>
            <div className={styles.carousel}>
              {HAIRSTYLES.map(style => {
                const isRecommended = analysis.recommendations.includes(style.id);
                return (
                  <button 
                    key={style.id} 
                    className={`${styles.styleBtn} ${activeStyle === style.id ? styles.activeStyle : ''} ${isRecommended ? styles.recommendedStyle : ''}`}
                    onClick={() => setActiveStyle(style.id)}
                  >
                    {style.name} {isRecommended && '✨'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <h3>Tono AR</h3>
            <div className={styles.colorPalette}>
              {COLORS.map(color => (
                <button 
                  key={color.id}
                  className={`${styles.colorBtn} ${activeColor.id === color.id ? styles.activeColor : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setActiveColor(color)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
          
           <div className={styles.actions}>
              <button onClick={handleBookingClick} className={styles.bookBtn}>Agendar Turno</button>
              <Link href="/upload" className={styles.secondaryBtn}>Nueva Foto</Link>
           </div>

           <BarberRecommendations styleId={activeStyle} />
        </div>
      )}

      {showSearch && (
        <StyleSearch 
            onSelect={(style) => {
                setReferenceStyle(style);
                setShowSearch(false);
            }} 
            onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

function BarberRecommendations({ styleId }: { styleId: string }) {
  const [recommendations, setRecommendations] = useState<Barber[]>([]);
  const styleName = HAIRSTYLES.find(s => s.id === styleId)?.name || styleId;

  useEffect(() => {
    const fetchRecommendations = async () => {
      // Fetch barbers specializing in this style
      const { data } = await supabase
        .from('barbers')
        .select('*')
        .contains('specialties', [styleId])
        .limit(3);
      
      if (data) setRecommendations(data);
    };

    fetchRecommendations();
  }, [styleId]);

  if (recommendations.length === 0) return null;

  return (
    <div className={styles.recommendationSection}>
       <h4 className={styles.recommendationTitle}>📍 Expertos en {styleName}</h4>
       <div className={styles.barberList}>
          {recommendations.map(barber => (
            <Link key={barber.id} href={`/b/${barber.slug}`} className={styles.barberRecCard}>
               <img src={barber.image_url} alt={barber.name} className={styles.barberRecImage} />
               <div className={styles.barberRecInfo}>
                  <div className={styles.barberRecName}>{barber.name}</div>
                  <div className={styles.barberRecMeta}>
                     <span className={styles.barberRecRating}>⭐ {barber.location.split(',')[0]}</span>
                     <span>{barber.average_price}</span>
                  </div>
               </div>
            </Link>
          ))}
       </div>
       <Link href="/barbers" className={styles.allBarbersBtn}>Ver todos los barberos →</Link>
    </div>
  );
}

export default function TryOnStudio() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <TryOnStudioContent />
        </Suspense>
    );
}
