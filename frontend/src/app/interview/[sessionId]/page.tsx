'use client'

import { useState, useEffect, useCallback, KeyboardEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from "sonner"
// IMPORT MicOff and update lucide-react import
import { Loader2, Mic, MicOff } from "lucide-react" 
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import AnimatedPage from '@/components/AnimatedPage'
// IMPORT THE NEW HOOK
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
// NEW: Import the animated avatar component
import { AnimatedAiva } from '@/components/AnimatedAiva'

interface Question {
  id: number;
  content: string;
}

// NEW: Update the question response interface
interface QuestionWithAudio extends Question {
  audio_content: string;
  speech_marks: Array<{ timeSeconds: number; value: string }>;
}

const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-24 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
    </div>
);

export default function InterviewPage() {
  const { accessToken, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  // UPDATE the question state to hold the new, richer object
  const [question, setQuestion] = useState<QuestionWithAudio | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [interviewState, setInterviewState] = useState<'loading' | 'in-progress' | 'completed'>('loading')
  const [error, setError] = useState<string | null>(null)
  
  const [questionCount, setQuestionCount] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(1) // Start with 1 to avoid divide-by-zero
  const [isSubmitting, setIsSubmitting] = useState(false)

  // NEW: State to control when user can start answering
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false)

  // --- NEW: Instantiate the speech recognition hook ---
  const {
    text,
    interimText,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
    error: speechError
  } = useSpeechRecognition();

  // --- NEW: Effect to clear answer when starting to listen ---
  useEffect(() => {
    if (isListening) {
      setUserAnswer(''); // Clear previous answer when starting a new recording
    }
  }, [isListening]);

  // --- NEW: Effect to sync hook's final text with our component's state ---
  useEffect(() => {
    // Only update if not currently listening to allow for manual edits
    if (!isListening && text) {
      setUserAnswer(text);
    }
  }, [text, isListening]);

  // --- NEW: Effect to show toast on speech recognition error ---
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchSessionDetails = useCallback(async (token: string) => {
    try {
        const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) {
          logout();
          router.push('/login');
          return;
        }
        if (!response.ok) throw new Error('Could not load session details.');
        const data = await response.json();
        setTotalQuestions(data.total_questions > 0 ? data.total_questions : 1);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error');
    }
  }, [sessionId, apiUrl, logout, router]);
  
  const fetchNextQuestion = useCallback(async (token: string) => {
    setIsAvatarSpeaking(true); // Avatar will start speaking on fetch
    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/question`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 204) {
        setInterviewState('completed');
        setIsAvatarSpeaking(false);
      } else if (response.ok) {
        // UPDATE to handle the new response shape
        const data: QuestionWithAudio = await response.json();
        setQuestion(data);
        setQuestionCount(prev => prev + 1);
        setInterviewState('in-progress');
        // If no audio content, avatar won't speak (will show in idle state)
        if (!data.audio_content) {
          setIsAvatarSpeaking(false);
        }
      } else if (response.status === 401) {
        // Unauthorized - token expired or invalid
        logout();
        router.push('/login');
        return;
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch the next question.' }));
        throw new Error(errorData.detail || 'Failed to fetch the next question.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setInterviewState('in-progress');
      setIsAvatarSpeaking(false); // Allow user to proceed on error
    }
  }, [sessionId, apiUrl, logout, router]);

  useEffect(() => {
    if (accessToken) {
        setInterviewState('loading');
        Promise.all([
            fetchSessionDetails(accessToken),
            fetchNextQuestion(accessToken)
        ]);
    }
  }, [accessToken, fetchSessionDetails, fetchNextQuestion]);

  const handleSubmitAnswer = async () => {
    // Disable submission while listening
    if (!accessToken || !question || !userAnswer.trim() || isSubmitting || isListening) return;
    
    setIsSubmitting(true);
    const toastId = toast.loading("Saving your answer...");
    
    // Save original question before hiding it
    const originalQuestion = question;

    try {
      // Hide current question while submitting to create a clean transition
      setQuestion(null);

      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          question_id: originalQuestion.id,
          answer_text: userAnswer
        })
      });
      
      if (response.status === 401) {
        // Unauthorized - token expired or invalid
        toast.error("Session expired. Please log in again.", { id: toastId });
        logout();
        router.push('/login');
        return;
      }
      
      if (!response.ok) throw new Error("Failed to save your answer.");
      toast.loading("Analyzing your answer...", { id: toastId });
      setUserAnswer('');

      // Fetch next question AFTER a small delay to make the transition feel smoother
      setTimeout(async () => {
          await fetchNextQuestion(accessToken);
          toast.success("Ready for your next question!", { id: toastId });
      }, 500); // 500ms delay

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit answer';
      toast.error(errorMessage, { id: toastId });
      // If submission fails, re-fetch the current question to show it again
      setQuestion(originalQuestion);
    } finally {
        // We will set isSubmitting to false inside the fetchNextQuestion flow
        setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Disable submit shortcut while listening or while avatar is speaking
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !isListening && !isAvatarSpeaking) {
      event.preventDefault(); 
      handleSubmitAnswer();
    }
  };

  const handlePlaybackComplete = () => {
    setIsAvatarSpeaking(false);
    // CRITICAL: Clear the audio/speech data so the avatar can transition to idle/listening
    setQuestion(q => q ? { ...q, audio_content: '', speech_marks: [] } : null);
  };
  
  return (
    <AnimatedPage className="flex h-screen bg-gray-50">
      <aside className="hidden md:flex flex-col items-center justify-center w-1/3 bg-gray-900 p-8 text-white">
        {/* Always show avatar, it handles its own states */}
        {interviewState === 'in-progress' || interviewState === 'completed' ? (
          <AnimatedAiva
            audioContent={question?.audio_content || null}
            speechMarks={question?.speech_marks || []}
            isListening={isListening && !isAvatarSpeaking} // Only "listen" when the avatar isn't speaking
            onPlaybackComplete={handlePlaybackComplete}
          />
        ) : (
          // Placeholder for loading state
          <div className="w-48 h-48 rounded-full bg-gray-700 flex items-center justify-center">
             <MicOff className="w-20 h-20 text-white opacity-50" />
          </div>
        )}
        <h2 className="text-2xl font-semibold mt-6">AIVA</h2>
        <p className="text-center text-gray-400 mt-2">Your AI Virtual Assistant</p>
        <p className="text-center text-gray-500 text-sm mt-1">
          {isAvatarSpeaking 
            ? "Listen to the question..." 
            : isListening ? "I'm listening..." : "Ready for your answer"}
        </p>
      </aside>

      <main className="w-full md:w-2/3 p-8 flex flex-col justify-center overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">
            {error && <p className="text-red-500 mb-4">Error: {error}</p>}
            
            {/* --- ANIMATED TRANSITIONS for interview states --- */}
            <AnimatePresence mode="wait">
              {(interviewState === 'loading' || (isSubmitting && !question)) && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <LoadingSkeleton />
                </motion.div>
              )}

              {interviewState === 'in-progress' && question && (
                <motion.div
                  key={question.id} // Use question.id as key to re-trigger animation
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Question {questionCount} of {totalQuestions}</p>
                        <Progress value={(questionCount / totalQuestions) * 100} className="w-full" />
                    </div>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Question:</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg text-gray-800">{question.content}</p>
                        </CardContent>
                    </Card>
                    <Textarea
                        placeholder="Type or record your answer here... (Ctrl+Enter to submit)"
                        // The value is now a combination of final and interim text
                        value={userAnswer + interimText}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={8}
                        className="text-base focus:ring-2 ring-offset-2 focus:ring-primary"
                        // Disable textarea while avatar is speaking
                        disabled={isSubmitting || isListening || isAvatarSpeaking}
                    />
                    {/* --- NEW: Button container --- */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSubmitAnswer}
                        // Disable submit button while avatar is speaking
                        disabled={!userAnswer.trim() || isSubmitting || isListening || isAvatarSpeaking}
                        className="w-full sm:w-auto"
                      >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Processing...' : 'Submit Answer'}
                      </Button>
                      
                      {/* --- NEW: Record Button --- */}
                      {hasRecognitionSupport && (
                        <Button
                          variant={isListening ? "destructive" : "outline"}
                          onClick={isListening ? stopListening : startListening}
                          className="w-full sm:w-auto"
                          // Disable record button while avatar is speaking
                          disabled={isSubmitting || isAvatarSpeaking}
                        >
                          {isListening ? (
                            <>
                              <MicOff className="mr-2 h-4 w-4" />
                              Stop Recording
                            </>
                          ) : (
                            <>
                              <Mic className="mr-2 h-4 w-4" />
                              Record Answer
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {/* --- NEW: Status message for unsupported browsers --- */}
                    {!hasRecognitionSupport && (
                      <p className="text-sm text-red-600">
                        Voice recording is not supported on your browser. Please try Chrome or Edge.
                      </p>
                    )}
                </motion.div>
              )}

              {interviewState === 'completed' && (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4"
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl">Interview Complete!</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>You&apos;ve answered all the questions. Well done!</p>
                            <Button
                                onClick={() => router.push(`/report/${sessionId}`)}
                                className="mt-6"
                            >
                                Finish & View Report
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </main>
    </AnimatedPage>
  )
}
