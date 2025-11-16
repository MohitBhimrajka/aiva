'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

// Lazy import MediaPipe types to avoid module loading issues
type FaceLandmarker = any
type PoseLandmarker = any
type FaceLandmarkerResult = any
type PoseLandmarkerResult = any
type FilesetOptions = any

interface MediaStreamContextType {
  videoStream: MediaStream | null
  isCameraReady: boolean
  requestPermissions: () => Promise<boolean>
  startAnalysis: (videoElement: HTMLVideoElement) => void
  stopAnalysis: () => void
  metrics: {
    eyeContactPercentage: number
    postureScore: number
    opennessScore: number
  }
}

const MediaStreamContext = createContext<MediaStreamContextType | undefined>(undefined)

export function MediaStreamProvider({ children }: { children: ReactNode }) {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [metrics, setMetrics] = useState({
    eyeContactPercentage: 0,
    postureScore: 0,
    opennessScore: 0,
  })

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isAnalyzingRef = useRef(false)

  // Initialize MediaPipe models (lazy loaded to avoid module loading issues)
  useEffect(() => {
    let loadHandler: (() => void) | null = null
    let isMounted = true
    
    const initializeModels = async () => {
      // Only initialize in browser environment
      if (typeof window === 'undefined' || !isMounted) return
      
      try {
        // Dynamically import MediaPipe to avoid module loading issues
        const vision = await import('@mediapipe/tasks-vision')
        const { FaceLandmarker, PoseLandmarker } = vision
        
        if (!isMounted) return
        
        // Use CPU delegate for better browser compatibility
        const baseOptions = {
          modelAssetPath: '/face_landmarker.task',
          delegate: 'CPU' as const,
        }

        // Initialize Face Landmarker with error handling
        try {
          const faceLandmarker = await FaceLandmarker.createFromOptions({
            baseOptions,
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO' as const,
          })
          if (isMounted) {
            faceLandmarkerRef.current = faceLandmarker
            console.log('Face Landmarker initialized successfully')
          }
        } catch (faceError) {
          console.warn('Face Landmarker initialization failed:', faceError)
          // Continue without face detection
        }

        // Initialize Pose Landmarker with error handling
        try {
          const poseLandmarker = await PoseLandmarker.createFromOptions({
            baseOptions: {
              modelAssetPath: '/pose_landmarker_lite.task',
              delegate: 'CPU' as const,
            },
            runningMode: 'VIDEO' as const,
          })
          if (isMounted) {
            poseLandmarkerRef.current = poseLandmarker
            console.log('Pose Landmarker initialized successfully')
          }
        } catch (poseError) {
          console.warn('Pose Landmarker initialization failed:', poseError)
          // Continue without pose detection
        }
      } catch (error) {
        console.warn('MediaPipe import or initialization error (non-critical):', error)
        // Models will be null if initialization fails, but app can still function
      }
    }

    // Wait for DOM to be fully ready, then initialize
    if (document.readyState === 'complete') {
      // DOM is ready, initialize after a short delay
      const timer = setTimeout(() => {
        initializeModels()
      }, 500)
      return () => {
        isMounted = false
        clearTimeout(timer)
      }
    } else {
      // Wait for load event
      loadHandler = () => {
        setTimeout(() => {
          initializeModels()
        }, 500)
      }
      window.addEventListener('load', loadHandler)
      return () => {
        isMounted = false
        if (loadHandler) {
          window.removeEventListener('load', loadHandler)
        }
      }
    }
  }, [])

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false, // Audio is handled separately
      })
      setVideoStream(stream)
      setIsCameraReady(true)
      return true
    } catch (error) {
      console.error('Error requesting camera permission:', error)
      setIsCameraReady(false)
      return false
    }
  }, [])

  const calculateEyeContact = useCallback((faceResult: FaceLandmarkerResult | null): number => {
    if (!faceResult || faceResult.faceLandmarks.length === 0) return 0

    // Use face landmarks to estimate eye contact
    // Simplified: check if face is centered and looking forward
    const landmarks = faceResult.faceLandmarks[0]
    if (!landmarks || landmarks.length < 10) return 0

    // Calculate face center and eye positions
    const noseTip = landmarks[4] // Approximate nose tip index
    const leftEye = landmarks[33] // Approximate left eye index
    const rightEye = landmarks[263] // Approximate right eye index

    if (!noseTip || !leftEye || !rightEye) return 0

    // Calculate if face is centered (simplified heuristic)
    const faceCenterX = (leftEye.x + rightEye.x) / 2
    const centerDeviation = Math.abs(faceCenterX - 0.5) // 0.5 is center of frame

    // Calculate eye contact score (0-100)
    // Lower deviation = better eye contact
    const eyeContactScore = Math.max(0, 100 - centerDeviation * 200)
    return Math.min(100, eyeContactScore)
  }, [])

  const calculatePosture = useCallback((poseResult: PoseLandmarkerResult | null): number => {
    if (!poseResult || poseResult.landmarks.length === 0) return 0

    const landmarks = poseResult.landmarks[0]
    if (!landmarks || landmarks.length < 33) return 0

    // Key points for posture analysis
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]
    const leftHip = landmarks[23]
    const rightHip = landmarks[24]
    const nose = landmarks[0]

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !nose) return 0

    // Calculate shoulder alignment
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2
    const hipY = (leftHip.y + rightHip.y) / 2
    const shoulderHipDistance = Math.abs(shoulderY - hipY)

    // Calculate if person is sitting upright (simplified)
    // Good posture: shoulders and hips are aligned horizontally, person is upright
    const shoulderAlignment = Math.abs(leftShoulder.y - rightShoulder.y)
    const uprightScore = 100 - (shoulderAlignment * 500) // Penalize slouching

    return Math.max(0, Math.min(100, uprightScore))
  }, [])

  const calculateOpenness = useCallback((faceResult: FaceLandmarkerResult | null): number => {
    if (!faceResult || faceResult.faceLandmarks.length === 0) return 0

    // Use face blendshapes if available to detect openness/engagement
    // Simplified: check if face is visible and not too close/far
    const landmarks = faceResult.faceLandmarks[0]
    if (!landmarks || landmarks.length < 10) return 0

    // Calculate face size (distance between key points)
    const leftEye = landmarks[33]
    const rightEye = landmarks[263]
    const nose = landmarks[4]

    if (!leftEye || !rightEye || !nose) return 0

    const eyeDistance = Math.sqrt(
      Math.pow(leftEye.x - rightEye.x, 2) + Math.pow(leftEye.y - rightEye.y, 2)
    )

    // Normalize based on expected face size (heuristic)
    // Face too small = far away, too large = too close
    const optimalDistance = 0.15 // Normalized distance
    const distanceScore = 100 - Math.abs(eyeDistance - optimalDistance) * 200

    return Math.max(0, Math.min(100, distanceScore))
  }, [])

  const analyzeFrame = useCallback(async () => {
    if (!videoElementRef.current || !isAnalyzingRef.current) return

    const video = videoElementRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame)
      return
    }

    // Only analyze if models are initialized
    if (!faceLandmarkerRef.current && !poseLandmarkerRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame)
      return
    }

    try {
      // Run face detection
      let faceResult: FaceLandmarkerResult | null = null
      if (faceLandmarkerRef.current) {
        try {
          faceResult = faceLandmarkerRef.current.detectForVideo(video, performance.now())
        } catch (err) {
          console.warn('Face detection error:', err)
        }
      }

      // Run pose detection
      let poseResult: PoseLandmarkerResult | null = null
      if (poseLandmarkerRef.current) {
        try {
          poseResult = poseLandmarkerRef.current.detectForVideo(video, performance.now())
        } catch (err) {
          console.warn('Pose detection error:', err)
        }
      }

      // Calculate metrics
      const eyeContact = calculateEyeContact(faceResult)
      const posture = calculatePosture(poseResult)
      const openness = calculateOpenness(faceResult)

      setMetrics({
        eyeContactPercentage: eyeContact,
        postureScore: posture,
        opennessScore: openness,
      })
    } catch (error) {
      console.error('Error analyzing frame:', error)
    }

    animationFrameRef.current = requestAnimationFrame(analyzeFrame)
  }, [calculateEyeContact, calculatePosture, calculateOpenness])

  const startAnalysis = useCallback(
    (videoElement: HTMLVideoElement) => {
      videoElementRef.current = videoElement
      isAnalyzingRef.current = true
      analyzeFrame()
    },
    [analyzeFrame]
  )

  const stopAnalysis = useCallback(() => {
    isAnalyzingRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    videoElementRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis()
      videoStream?.getTracks().forEach((track) => track.stop())
    }
  }, [stopAnalysis, videoStream])

  return (
    <MediaStreamContext.Provider
      value={{
        videoStream,
        isCameraReady,
        requestPermissions,
        startAnalysis,
        stopAnalysis,
        metrics,
      }}
    >
      {children}
    </MediaStreamContext.Provider>
  )
}

export function useMediaStream() {
  const context = useContext(MediaStreamContext)
  if (context === undefined) {
    throw new Error('useMediaStream must be used within a MediaStreamProvider')
  }
  return context
}

