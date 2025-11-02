// frontend/src/hooks/useSpeechRecognition.ts

'use client'

import { useState, useEffect, useRef } from 'react';

// Define the shape of the hook's return value for type safety
interface SpeechRecognitionHook {
  text: string;
  interimText: string;
  isListening: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  hasRecognitionSupport: boolean;
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

  // Use a ref to hold the recognition instance. This is important because we don't want
  // re-renders to create a new instance.
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening even after a pause
    recognition.interimResults = true; // Get live, in-progress results
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
    
    recognition.onstart = () => {
      setIsListening(true);
      setInterimText(''); // Clear interim text on new start
    };
    
    recognition.onend = () => {
      setIsListening(false);
      setInterimText(''); // Clear interim text on stop
    };
    
    recognitionRef.current = recognition;

    // Cleanup function to abort recognition if the component unmounts
    return () => {
      recognition.abort();
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setText(''); // Clear previous final text
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return {
    text,
    interimText,
    isListening,
    error,
    startListening,
    stopListening,
    hasRecognitionSupport: !!SpeechRecognition,
  };
};

