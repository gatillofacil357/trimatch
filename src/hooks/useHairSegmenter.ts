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

            // Discovered the ultimate Hair Segmentation model directly on MediaPipe CDN exactly replacing the PyTorch model
            globalImageSegmenter = await ImageSegmenter.createFromOptions(globalFilesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite"
                },
                runningMode: "VIDEO",
                outputCategoryMask: false,
                outputConfidenceMasks: true
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
