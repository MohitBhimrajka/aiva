'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AudioMetrics {
  pitchVariation: number // 0-1 score
  volumeStability: number // 0-1 score
}

interface UseAudioAnalysisReturn {
  metrics: AudioMetrics
  start: (stream: MediaStream) => void
  stop: () => void
}

export function useAudioAnalysis(): UseAudioAnalysisReturn {
  const [metrics, setMetrics] = useState<AudioMetrics>({
    pitchVariation: 0,
    volumeStability: 0,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isAnalyzingRef = useRef(false)

  // Store recent pitch and volume values for analysis
  const pitchHistoryRef = useRef<number[]>([])
  const volumeHistoryRef = useRef<number[]>([])
  const MAX_HISTORY = 100 // Keep last 100 samples

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isAnalyzingRef.current) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    // Calculate volume (RMS)
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / bufferLength)
    const volume = rms / 255 // Normalize to 0-1

    // Calculate pitch (simplified: find dominant frequency)
    let maxIndex = 0
    let maxValue = 0
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i]
        maxIndex = i
      }
    }
    // Convert to frequency (simplified)
    const sampleRate = audioContextRef.current?.sampleRate || 44100
    const pitch = (maxIndex * sampleRate) / (2 * bufferLength)

    // Store in history
    volumeHistoryRef.current.push(volume)
    pitchHistoryRef.current.push(pitch)

    // Keep history size manageable
    if (volumeHistoryRef.current.length > MAX_HISTORY) {
      volumeHistoryRef.current.shift()
    }
    if (pitchHistoryRef.current.length > MAX_HISTORY) {
      pitchHistoryRef.current.shift()
    }

    // Calculate metrics when we have enough data
    if (volumeHistoryRef.current.length >= 10 && pitchHistoryRef.current.length >= 10) {
      // Volume stability: lower variance = more stable
      const volumeMean =
        volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length
      const volumeVariance =
        volumeHistoryRef.current.reduce((sum, v) => sum + Math.pow(v - volumeMean, 2), 0) /
        volumeHistoryRef.current.length
      const volumeStability = Math.max(0, 1 - volumeVariance * 2) // Normalize to 0-1

      // Pitch variation: higher variation = more expressive (good for interviews)
      const pitchMean =
        pitchHistoryRef.current.reduce((a, b) => a + b, 0) / pitchHistoryRef.current.length
      const pitchVariance =
        pitchHistoryRef.current.reduce((sum, p) => sum + Math.pow(p - pitchMean, 2), 0) /
        pitchHistoryRef.current.length
      // Normalize pitch variation (assuming typical speech range 80-300 Hz)
      const normalizedPitchVariation = Math.min(1, Math.sqrt(pitchVariance) / 100)

      setMetrics({
        pitchVariation: normalizedPitchVariation,
        volumeStability: volumeStability,
      })
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [])

  const start = useCallback(
    (stream: MediaStream) => {
      if (isAnalyzingRef.current) return

      // Check if stream has audio tracks
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.warn('MediaStream has no audio tracks, skipping audio analysis')
        return
      }

      try {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) {
          throw new Error('AudioContext not supported')
        }

        const audioContext = new AudioContextClass()
        audioContextRef.current = audioContext

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        sourceRef.current = source
        streamRef.current = stream

        source.connect(analyser)

        isAnalyzingRef.current = true
        analyzeAudio()
      } catch (error) {
        console.error('Error starting audio analysis:', error)
        // Clean up on error
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error)
          audioContextRef.current = null
        }
      }
    },
    [analyzeAudio]
  )

  const stop = useCallback(() => {
    isAnalyzingRef.current = false

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop all audio tracks
    streamRef.current?.getAudioTracks().forEach(track => {
      track.stop()
    })

    sourceRef.current?.disconnect()
    analyserRef.current?.disconnect()
    audioContextRef.current?.close().catch(console.error)

    sourceRef.current = null
    analyserRef.current = null
    audioContextRef.current = null
    streamRef.current = null

    // Reset metrics
    setMetrics({
      pitchVariation: 0,
      volumeStability: 0,
    })

    // Clear history
    pitchHistoryRef.current = []
    volumeHistoryRef.current = []
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    metrics,
    start,
    stop,
  }
}

