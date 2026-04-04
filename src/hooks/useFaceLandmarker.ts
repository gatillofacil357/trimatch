import { useState, useEffect, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let globalFaceLandmarker: FaceLandmarker | null = null;
let globalFilesetResolver: any = null;

export const useFaceLandmarker = () => {
    const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(globalFaceLandmarker);
    const [loading, setLoading] = useState(!globalFaceLandmarker);
    const [error, setError] = useState<string | null>(null);

    const init = useCallback(async () => {
        try {
            if (globalFaceLandmarker) {
                setFaceLandmarker(globalFaceLandmarker);
                setLoading(false);
                return;
            }

            if (!globalFilesetResolver) {
                globalFilesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );
            }

            globalFaceLandmarker = await FaceLandmarker.createFromOptions(globalFilesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });

            setFaceLandmarker(globalFaceLandmarker);
            setLoading(false);
        } catch (err) {
            console.error("Error initializing FaceLandmarker:", err);
            setError("Error al cargar los modelos de visión facial.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!faceLandmarker) {
            init();
        }
    }, [faceLandmarker, init]);

    return { faceLandmarker, loading, error };
};
