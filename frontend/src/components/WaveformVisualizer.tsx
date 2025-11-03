// frontend/src/components/WaveformVisualizer.tsx

'use client'

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface WaveformVisualizerProps {
  mediaStream: MediaStream | null;
  isRecording: boolean;
}

export function WaveformVisualizer({ mediaStream, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!mediaStream || !isRecording || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    // Set up canvas dimensions based on container size
    // Account for device pixel ratio for crisp rendering on high-DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Use actual rect width/height or fallback to default if 0
      const displayWidth = Math.max(rect.width || 1000, 100);
      const displayHeight = Math.max(rect.height || 60, 60);
      
      // Set internal size (drawing buffer) accounting for device pixel ratio
      const scaledWidth = displayWidth * dpr;
      const scaledHeight = displayHeight * dpr;
      
      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Reset and scale the drawing context to match the display size
        canvasCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        canvasCtx.scale(dpr, dpr);
        
        // Set CSS size to actual display size
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
      }
      
      return { displayWidth, displayHeight };
    };
    
    // Initial resize
    resizeCanvas();
    
    // Handle window resize
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    // Set up Web Audio API
    interface WindowWithWebkitAudioContext extends Window {
      webkitAudioContext?: typeof AudioContext;
    }
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    if (!AudioContextClass) {
      console.error('AudioContext not supported in this browser');
      return;
    }
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);
    
    source.connect(analyser);

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      // Schedule the next frame
      animationFrameId.current = requestAnimationFrame(draw);
      
      // Resize canvas if needed and get dimensions
      const { displayWidth, displayHeight } = resizeCanvas();

      // Get the time domain data
      analyser.getByteTimeDomainData(dataArray);

      // Clear the canvas - use white/light background instead of CSS variable to avoid black
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.fillRect(0, 0, displayWidth, displayHeight);

      // Set up the line style
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = `hsl(var(--primary))`;
      canvasCtx.beginPath();

      const sliceWidth = displayWidth / bufferLength;
      let x = 0;
      const centerY = displayHeight / 2;

      for (let i = 0; i < bufferLength; i++) {
        // The dataArray values are between 0 and 255. We normalize it to a range of -1 to 1.
        const v = (dataArray[i] / 128.0) - 1.0; // Normalize to -1 to 1 range
        const y = centerY + (v * centerY * 0.8); // Scale amplitude, keeping some margin

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      canvasCtx.lineTo(displayWidth, centerY);
      canvasCtx.stroke();
    };

    draw();

    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('resize', handleResize);
      source.disconnect();
      audioContext.close();
    };
  }, [mediaStream, isRecording]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: '60px' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full"
    >
      <canvas 
        ref={canvasRef} 
        width={1000} 
        height={60} 
        className="w-full h-full rounded-md border bg-background"
      />
    </motion.div>
  );
}

