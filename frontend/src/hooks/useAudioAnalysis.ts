'use client'

import { useState, useRef, useCallback } from 'react';

interface AudioMetrics {
    pitchVariation: number;
    volumeStability: number;
}

export const useAudioAnalysis = () => {
    const [metrics, setMetrics] = useState<AudioMetrics>({ pitchVariation: 0, volumeStability: 0 });
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameId = useRef<number>(0);
    const pitchHistory = useRef<number[]>([]);
    const volumeHistory = useRef<number[]>([]);
    
    const analyze = useCallback(() => {
        if (!analyserRef.current || !audioContextRef.current) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        analyser.getByteFrequencyData(dataArray);

        // Simple volume calculation (RMS)
        let sum = 0;
        for (const amplitude of dataArray) {
            sum += amplitude * amplitude;
        }
        const volume = Math.sqrt(sum / bufferLength);
        volumeHistory.current.push(volume);
        if(volumeHistory.current.length > 100) volumeHistory.current.shift();

        // Simple pitch detection (find dominant frequency)
        let maxVal = -1;
        let maxIndex = -1;
        for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > maxVal) {
                maxVal = dataArray[i];
                maxIndex = i;
            }
        }
        const pitch = maxIndex * (audioContextRef.current.sampleRate / analyser.fftSize);
        if (pitch > 80 && pitch < 300) { // Filter for typical human voice range
            pitchHistory.current.push(pitch);
            if(pitchHistory.current.length > 100) pitchHistory.current.shift();
        }

        // Calculate metrics
        if (pitchHistory.current.length > 10 && volumeHistory.current.length > 10) {
            const pitchMean = pitchHistory.current.reduce((a, b) => a + b) / pitchHistory.current.length;
            const pitchVariance = pitchHistory.current.reduce((sum, val) => sum + Math.pow(val - pitchMean, 2), 0) / pitchHistory.current.length;
            const pitchStdDev = Math.sqrt(pitchVariance);
            
            const volumeMean = volumeHistory.current.reduce((a, b) => a + b) / volumeHistory.current.length;
            const volumeVariance = volumeHistory.current.reduce((sum, val) => sum + Math.pow(val - volumeMean, 2), 0) / volumeHistory.current.length;
            const volumeStdDev = Math.sqrt(volumeVariance);

            // Normalize scores (these are heuristics and can be tuned)
            const pitchVariationScore = Math.min(1, pitchStdDev / 50);
            const volumeStabilityScore = Math.max(0, 1 - (volumeStdDev / 30));
            
            setMetrics({ pitchVariation: pitchVariationScore, volumeStability: volumeStabilityScore });
        }

        animationFrameId.current = requestAnimationFrame(analyze);
    }, []);

    const start = useCallback((stream: MediaStream) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new window.AudioContext();
        }
        const audioContext = audioContextRef.current;
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048;

        sourceRef.current = audioContext.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        analyze();
    }, [analyze]);

    const stop = useCallback(() => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = 0;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        pitchHistory.current = [];
        volumeHistory.current = [];
    }, []);

    return { metrics, start, stop };
}

