export interface FaceMetrics {
  faceAspectRatio: number; // Height / Width
  foreheadToCheekRatio: number;
  jawToCheekRatio: number;
  cheekToFaceLengthRatio: number;
}

export type FaceShape = 'ovalado' | 'redondo' | 'cuadrado' | 'corazon' | 'diamante' | 'alargado';

export interface AnalysisResult {
  shape: FaceShape;
  confidence: number;
  metrics: FaceMetrics;
  recommendations: string[];
}

export const analyzeFaceShape = (landmarks: any[]): AnalysisResult => {
  // Landmarks indices for MediaPipe Face Mesh (478 points)
  const TOP_FOREHEAD = landmarks[10];
  const CHIN_TIP = landmarks[152];
  const LEFT_CHEEKBONE = landmarks[234];
  const RIGHT_CHEEKBONE = landmarks[454];
  const LEFT_FOREHEAD = landmarks[103];
  const RIGHT_FOREHEAD = landmarks[332];
  const LEFT_JAW = landmarks[58];
  const RIGHT_JAW = landmarks[288];

  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const faceHeight = getDistance(TOP_FOREHEAD, CHIN_TIP);
  const cheekWidth = getDistance(LEFT_CHEEKBONE, RIGHT_CHEEKBONE);
  const foreheadWidth = getDistance(LEFT_FOREHEAD, RIGHT_FOREHEAD);
  const jawWidth = getDistance(LEFT_JAW, RIGHT_JAW);

  const faceAspectRatio = faceHeight / cheekWidth;
  const foreheadToCheekRatio = foreheadWidth / cheekWidth;
  const jawToCheekRatio = jawWidth / cheekWidth;
  const cheekToFaceLengthRatio = cheekWidth / faceHeight;

  const metrics: FaceMetrics = {
    faceAspectRatio,
    foreheadToCheekRatio,
    jawToCheekRatio,
    cheekToFaceLengthRatio
  };

  let shape: FaceShape = 'ovalado';
  let confidence = 0.8;
  
  // Logic based on standard facial proportion studies
  if (faceAspectRatio > 1.5) {
    shape = 'alargado';
  } else if (faceAspectRatio < 1.25) {
    if (jawToCheekRatio > 0.85) {
      shape = 'cuadrado';
    } else {
      shape = 'redondo';
    }
  } else {
    // Intermediate aspect ratios
    if (foreheadToCheekRatio > 0.9 && jawToCheekRatio < 0.8) {
      shape = 'corazon';
    } else if (cheekWidth > foreheadWidth && cheekWidth > jawWidth) {
      if (jawToCheekRatio < 0.7) {
        shape = 'diamante';
      } else {
        shape = 'ovalado';
      }
    } else {
      shape = 'ovalado';
    }
  }

  const recommendationsMap: Record<FaceShape, string[]> = {
    ovalado: ['fade', 'textured', 'undercut'],
    redondo: ['fade', 'undercut'], // Estilos con volumen arriba para alargar
    cuadrado: ['textured', 'fade'], // Suavizar la mandíbula
    corazon: ['long', 'textured'], // Volumen en los laterales
    diamante: ['textured', 'long', 'fade'],
    alargado: ['textured', 'long'] // Evitar volumen excesivo arriba
  };

  return {
    shape,
    confidence,
    metrics,
    recommendations: recommendationsMap[shape]
  };
};

// PERSISTENCE HELPERS
const STORAGE_KEY = 'trimatch_last_analysis';

export const saveAnalysis = (result: AnalysisResult) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }
};

export const getStoredAnalysis = (): AnalysisResult | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }
  return null;
};
