"use client";

import { useState, useEffect, useCallback } from 'react';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

let globalImageSegmenter: ImageSegmenter | null = null;
let globalFilesetResolver: any = null;

export const useHairSegmenter = () => {
    const [imageSegmenter, setImageSegmenter] = useState<ImageSegmenter | null>(globalImageSegmenter);
    const [loading, setLoading] = useState(!globalImageSegmenter);
    const [error, setError] = useState<string | null>(null);

    const init = useCallback(async () => {
        try {
            if (globalImageSegmenter) {
                setImageSegmenter(globalImageSegmenter);
                setLoading(false);
                return;
            }

            if (!globalFilesetResolver) {
                globalFilesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );
            }

            // Successfully discovered the true Selfie model URL format (.tflite) avoids 404
            globalImageSegmenter = await ImageSegmenter.createFromOptions(globalFilesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                outputCategoryMask: true,
                outputConfidenceMasks: false
            });

            setImageSegmenter(globalImageSegmenter);
            setLoading(false);
        } catch (err) {
            console.error("Error initializing ImageSegmenter:", err);
            setError("Error al cargar el segmentador de silueta.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!imageSegmenter) {
            init();
        }
    }, [imageSegmenter, init]);

    return { imageSegmenter, loading, error };
};
