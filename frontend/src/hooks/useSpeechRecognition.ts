'use client'

import { useState, useEffect, useRef } from 'react'

interface SpeechRecognitionOptions {
  onTranscriptChanged: (transcript: string) => void;
  onMetricsChanged: (metrics: { wpm: number, fillerCount: number }) => void;
}

// Define the SpeechRecognition interface for type safety
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResultItem[];
  length: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInterface {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: {
    new (): SpeechRecognitionInterface;
  };
  webkitSpeechRecognition?: {
    new (): SpeechRecognitionInterface;
  };
}

// Check for SpeechRecognition interface, which may have vendor prefixes
const SpeechRecognitionConstructor =
  (typeof window !== 'undefined' && (window as WindowWithSpeechRecognition).SpeechRecognition) ||
  (typeof window !== 'undefined' && (window as WindowWithSpeechRecognition).webkitSpeechRecognition)

// Move fillerWords outside component as it's a constant
const FILLER_WORDS = new Set(['um', 'uh', 'like', 'you know', 'so', 'actually']);

export const useSpeechRecognition = ({ onTranscriptChanged, onMetricsChanged }: SpeechRecognitionOptions) => {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const transcriptStartTime = useRef<number>(0);
  const wordCount = useRef<number>(0);
  const fillerCount = useRef<number>(0);

  useEffect(() => {
    if (!SpeechRecognitionConstructor) {
      setIsSupported(false)
      return
    }
    setIsSupported(true)

    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true);
      transcriptStartTime.current = Date.now();
      wordCount.current = 0;
      fillerCount.current = 0;
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onresult = (event) => {
      const fullTranscript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join('')
      
      onTranscriptChanged(fullTranscript);

      // Calculate metrics
      const currentWords = fullTranscript.trim().split(/\s+/);
      const newWordCount = currentWords.length;

      if (newWordCount > wordCount.current) {
          const newWords = currentWords.slice(wordCount.current);
          newWords.forEach(word => {
              if (FILLER_WORDS.has(word.toLowerCase().replace(/[.,]/g, ''))) {
                  fillerCount.current += 1;
              }
          });
      }
      wordCount.current = newWordCount;
      
      const elapsedTimeMinutes = (Date.now() - transcriptStartTime.current) / 60000;
      const wpm = elapsedTimeMinutes > 0 ? Math.round(wordCount.current / elapsedTimeMinutes) : 0;
      
      onMetricsChanged({ wpm, fillerCount: fillerCount.current });
    }

    recognitionRef.current = recognition

    // Cleanup function to abort recognition if component unmounts
    return () => {
      recognitionRef.current?.abort()
    }
  }, [onTranscriptChanged, onMetricsChanged])

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }

  return { isListening, isSupported, startListening, stopListening }
}
