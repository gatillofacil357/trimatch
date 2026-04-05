"use client";

import { useState, useEffect, useCallback } from 'react';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

let globalImageSegmenter: bodySegmentation.BodySegmenter | null = null;

export const useHairSegmenter = () => {
    const [imageSegmenter, setImageSegmenter] = useState<bodySegmentation.BodySegmenter | null>(globalImageSegmenter);
    const [loading, setLoading] = useState(!globalImageSegmenter);
    const [error, setError] = useState<string | null>(null);

    const init = useCallback(async () => {
        try {
            if (globalImageSegmenter) {
                setImageSegmenter(globalImageSegmenter);
                setLoading(false);
                return;
            }

            // Using the precise user-provided TS integration but using tfjs runtime to fix Webpack peer dependency crashes
            const segmenter = await bodySegmentation.createSegmenter(
              bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation, 
              { runtime: 'tfjs', modelType: 'general' }
            );

            globalImageSegmenter = segmenter;
            setImageSegmenter(globalImageSegmenter);
            setLoading(false);
        } catch (err) {
            console.error("Error initializing TFJS Body Segmenter:", err);
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
