// frontend/src/hooks/useSpeechRecognition.ts

'use client'

import { useState, useEffect, useRef, useCallback } from 'react';

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'so', 'you know', 'actually', 'basically', 'literally'
]);

interface SpeechRecognitionHook {
  text: string;
  interimText: string;
  isListening: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  hasRecognitionSupport: boolean;
  vocalMetrics: {
    speakingPaceWPM: number;
    fillerWordCount: number;
    totalSpeechTime: number; // New metric
  };
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

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs for Web Speech API and Web Audio API ---
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  // --- Refs for tracking speech duration ---
  const speechStartTimeRef = useRef<number>(0);
  const totalSpeechTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  
  // --- Constants for audio analysis ---
  const SILENCE_THRESHOLD = 0.01; // RMS amplitude threshold for silence
  const SPEECH_CONFIRMATION_THRESHOLD = 250; // ms of silence before considering speech "stopped"

  const processAudio = useCallback((event: AudioProcessingEvent) => {
    const inputBuffer = event.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      sum += inputBuffer[i] * inputBuffer[i];
    }
    const rms = Math.sqrt(sum / inputBuffer.length);

    if (rms > SILENCE_THRESHOLD) { // Speaking detected
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        speechStartTimeRef.current = Date.now();
      }
      silenceStartRef.current = 0; // Reset silence timer
    } else { // Silence detected
      if (isSpeakingRef.current) {
        if (silenceStartRef.current === 0) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current > SPEECH_CONFIRMATION_THRESHOLD) {
          // Confirmed end of a speech segment
          const segmentDuration = (silenceStartRef.current - speechStartTimeRef.current);
          totalSpeechTimeRef.current += segmentDuration;
          isSpeakingRef.current = false;
          silenceStartRef.current = 0;
        }
      }
    }
  }, []);
  
  const startAudioProcessing = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = processAudio;
      source.connect(processor);
      processor.connect(context.destination);
      scriptProcessorRef.current = processor;
    } catch (err) {
      console.error("Error starting audio processing:", err);
      setError("Could not access microphone for audio analysis.");
    }
  };

  const stopAudioProcessing = () => {
    // Check if there's a final speech segment that hasn't been added
    if(isSpeakingRef.current) {
        const finalSegmentDuration = (Date.now() - speechStartTimeRef.current);
        totalSpeechTimeRef.current += finalSegmentDuration;
    }

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    audioContextRef.current?.close();
    isSpeakingRef.current = false;
    silenceStartRef.current = 0;
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setText('');
      totalSpeechTimeRef.current = 0; // Reset speech time
      startAudioProcessing();
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      stopAudioProcessing();
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
      setText((prevText) => prevText + finalTranscript);
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

  const calculateMetrics = (finalTranscript: string) => {
    const totalSpeechTimeInSeconds = totalSpeechTimeRef.current / 1000;
    if (totalSpeechTimeInSeconds < 0.5 || !finalTranscript) {
      return { speakingPaceWPM: 0, fillerWordCount: 0, totalSpeechTime: 0 };
    }
    
    const words = finalTranscript.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    const speakingPaceWPM = Math.round((wordCount / totalSpeechTimeInSeconds) * 60);
    
    const fillerWordCount = words.reduce((count, word) => {
      const cleanWord = word.replace(/[.,?!]/g, '');
      return count + (FILLER_WORDS.has(cleanWord) ? 1 : 0);
    }, 0);
    
    return { speakingPaceWPM, fillerWordCount, totalSpeechTime: totalSpeechTimeInSeconds };
  };

  const vocalMetrics = calculateMetrics(text);

  return {
    text,
    interimText,
    isListening,
    error,
    startListening,
    stopListening,
    hasRecognitionSupport: !!SpeechRecognition,
    vocalMetrics,
  };
};
