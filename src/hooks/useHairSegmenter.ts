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

            // Dedicated Hair Segmenter Model (Float16 for speed)
            globalImageSegmenter = await ImageSegmenter.createFromOptions(globalFilesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float16/1/hair_segmenter.task",
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
            setError("Error al cargar el segmentador de cabello.");
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
