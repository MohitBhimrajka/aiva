'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

// Define the possible states of the interview UI
export enum InterviewState {
  LOADING,
  IDLE, // Waiting for user to start speaking
  LISTENING,
  PROCESSING, // User finished speaking, processing answer
  SPEAKING, // AI Avatar is speaking (future phase)
  FINISHED,
}

// Define the shape of our data objects
interface Question {
  id: number;
  content: string;
}

interface SessionDetails {
  id: number;
  difficulty: string;
  role: {
    id: number;
    name: string;
    category: string;
  };
  total_questions: number;
}

interface SubmitMetrics {
  eyeContactScore?: number;
  speaking_pace_wpm?: number;
  filler_word_count?: number;
  pitch_variation_score?: number;
  volume_stability_score?: number;
  posture_stability_score?: number;
  posture_score?: number;
  openness_score?: number;
}

export const useInterviewManager = () => {
  const [interviewState, setInterviewState] = useState<InterviewState>(InterviewState.LOADING)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const { sessionId } = useParams()
  const router = useRouter()
  const { accessToken } = useAuth()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Helper function to make authenticated API requests
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error('No access token available')
    }

    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }

    return response
  }, [accessToken, apiUrl])

  // Fetch initial session details and the first question
  useEffect(() => {
    const initializeSession = async () => {
      if (!sessionId || !accessToken) return
      
      try {
        setInterviewState(InterviewState.LOADING)
        
        // Fetch session details in parallel with the first question
        const detailsPromise = apiRequest(`/api/sessions/${sessionId}/details`).then(r => r.json())
        const questionPromise = apiRequest(`/api/sessions/${sessionId}/question`)

        const [detailsData, questionResponse] = await Promise.all([detailsPromise, questionPromise])

        setSessionDetails(detailsData)

        if (questionResponse.status === 204) {
          // Interview was already completed
          setInterviewState(InterviewState.FINISHED)
          toast.info("This interview is already complete. Redirecting to report.")
          router.push(`/report/${sessionId}`)
        } else {
          const questionData = await questionResponse.json()
          setCurrentQuestion(questionData)
          setInterviewState(InterviewState.IDLE)
        }
      } catch (err: unknown) {
        console.error("Initialization failed:", err)
        setError("Failed to load interview session. Please try again.")
        const errorMessage = err instanceof Error ? err.message : "Failed to load session."
        toast.error(errorMessage)
        setInterviewState(InterviewState.LOADING) // Keep it loading to show error
      }
    }
    initializeSession()
  }, [sessionId, accessToken, apiRequest, router])

  // Function to submit an answer and fetch the next question
  const submitAnswerAndGetNext = useCallback(async (answerText: string, metrics: SubmitMetrics = {}) => {
    if (!currentQuestion || !sessionId) return

    try {
      setInterviewState(InterviewState.PROCESSING)
      
      const payload = {
        question_id: currentQuestion.id,
        answer_text: answerText,
        eye_contact_score: metrics.eyeContactScore,
        speaking_pace_wpm: metrics.speaking_pace_wpm,
        filler_word_count: metrics.filler_word_count,
        pitch_variation_score: metrics.pitch_variation_score,
        volume_stability_score: metrics.volume_stability_score,
        posture_stability_score: metrics.posture_stability_score,
        posture_score: metrics.posture_score,
        openness_score: metrics.openness_score,
      }
      
      // Submit the answer. We don't need to wait for its full processing,
      // we just need to fire it off.
      await apiRequest(`/api/sessions/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      
      // Update progress
      setAnsweredCount(prev => prev + 1);

      // Fetch the next question
      const response = await apiRequest(`/api/sessions/${sessionId}/question`)
      
      if (response.status === 204) {
        // No more questions, the interview is over
        setInterviewState(InterviewState.FINISHED)
        toast.success("Interview complete! Generating your report...")
        router.push(`/report/${sessionId}`)
      } else {
        const questionData = await response.json()
        setCurrentQuestion(questionData)
        setInterviewState(InterviewState.IDLE)
      }
    } catch (err: unknown) {
      console.error("Failed to submit answer:", err)
      const errorMessage = err instanceof Error ? err.message : "An error occurred while submitting your answer."
      toast.error(errorMessage)
      setInterviewState(InterviewState.IDLE) // Revert to IDLE on error
    }
  }, [currentQuestion, sessionId, apiRequest, router])

  return {
    interviewState,
    setInterviewState,
    currentQuestion,
    sessionDetails,
    answeredCount,
    error,
    submitAnswerAndGetNext,
  }
}
