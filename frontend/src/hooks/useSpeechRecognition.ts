// frontend/src/hooks/useSpeechRecognition.ts

'use client'

import { useState, useEffect, useRef, useCallback } from 'react';

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'so', 'you know', 'actually', 'basically', 'literally'
]);

interface UseSpeechRecognitionOptions {
  onTranscriptChanged?: (transcript: string) => void;
  onMetricsChanged?: (metrics: { wpm: number; fillerCount: number }) => void;
}

interface SpeechRecognitionHook {
  text: string;
  interimText: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

// Define the SpeechRecognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Check for the SpeechRecognition API, handling browser prefixes
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): SpeechRecognitionHook => {
  const { onTranscriptChanged, onMetricsChanged } = options;
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs for Web Speech API ---
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // --- Refs for tracking speech metrics ---
  const speechStartTimeRef = useRef<number>(0);
  const totalSpeechTimeRef = useRef<number>(0);
  const wordCountRef = useRef<number>(0);
  const fillerCountRef = useRef<number>(0);

  const calculateMetrics = useCallback(() => {
    const currentText = text.trim();
    if (!currentText) {
      return { wpm: 0, fillerCount: 0 };
    }

    const words = currentText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    wordCountRef.current = words.length;

    // Count filler words
    fillerCountRef.current = words.reduce((count, word) => {
      const cleanWord = word.replace(/[.,?!]/g, '');
      return count + (FILLER_WORDS.has(cleanWord) ? 1 : 0);
    }, 0);

    // Calculate WPM based on speech time
    const speechTimeInSeconds = totalSpeechTimeRef.current / 1000;
    let wpm = 0;
    if (speechTimeInSeconds > 0.5) {
      wpm = Math.round((wordCountRef.current / speechTimeInSeconds) * 60);
    } else if (speechStartTimeRef.current > 0) {
      // Fallback: estimate based on elapsed time
      const elapsedSeconds = (Date.now() - speechStartTimeRef.current) / 1000;
      if (elapsedSeconds > 0.5) {
        wpm = Math.round((wordCountRef.current / elapsedSeconds) * 60);
      }
    }

    return { wpm, fillerCount: fillerCountRef.current };
  }, [text]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setText('');
      setInterimText('');
      totalSpeechTimeRef.current = 0;
      wordCountRef.current = 0;
      fillerCountRef.current = 0;
      speechStartTimeRef.current = Date.now();
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };
  
  // Setup for the Web Speech API (mostly unchanged)
  useEffect(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        setText((prevText) => {
          const newText = prevText + (prevText && !prevText.endsWith(' ') ? ' ' : '') + finalTranscript;
          // Update speech time when we get final results
          if (speechStartTimeRef.current > 0) {
            const segmentTime = Date.now() - speechStartTimeRef.current;
            totalSpeechTimeRef.current += segmentTime;
            speechStartTimeRef.current = Date.now();
          }
          // Notify transcript change
          if (onTranscriptChanged) {
            onTranscriptChanged(newText);
          }
          return newText;
        });
      }
      
      setInterimText(interimTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        // This isn't a critical error, so we can ignore it or handle it silently.
      } else if (event.error === 'not-allowed') {
        setError('Microphone access was denied. Please enable it in your browser settings.');
      } else {
        setError(`An error occurred with speech recognition: ${event.error}`);
      }
    };
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognitionRef.current = recognition;

    return () => recognition.abort();
  }, []);

  // Update metrics whenever text changes
  useEffect(() => {
    if (onMetricsChanged) {
      const metrics = calculateMetrics();
      onMetricsChanged(metrics);
    }
  }, [text, calculateMetrics, onMetricsChanged]);

  return {
    text,
    interimText,
    isListening,
    isSupported: !!SpeechRecognition,
    error,
    startListening,
    stopListening,
  };
};
