'use client'

import { useState, useEffect, useCallback, KeyboardEvent, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from "sonner"
import { Loader2, Mic, MicOff } from "lucide-react" 
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import AnimatedPage from '@/components/AnimatedPage'
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

  // --- NEW STATE FOR REAL-TIME TRANSCRIPTION ---
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalVocalMetrics, setFinalVocalMetrics] = useState({ speakingPaceWPM: 0, fillerWordCount: 0 });
  const [recordingWarning, setRecordingWarning] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioProcessorRef = useRef<{ stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const streamNumberRef = useRef(0);
  // ---------------------------------------------

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // --- NEW: WebSocket recording functions ---
  const startRecording = async () => {
    if (!accessToken) return;

    // Reset state
    setUserAnswer('');
    setInterimTranscript('');
    setIsRecording(true);
    setFinalVocalMetrics({ speakingPaceWPM: 0, fillerWordCount: 0 });

    const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/api/ws/transcribe/${sessionId}?token=${accessToken}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = async () => {
      toast.info("Microphone connected. Start speaking.");
      setRecordingWarning(null);
      try {
        // Request microphone with specific constraints
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        mediaStreamRef.current = stream;
        
        // Create AudioContext with explicit sample rate (some browsers may ignore constraints)
        interface WindowWithWebkitAudioContext extends Window {
          webkitAudioContext?: typeof AudioContext;
        }
        const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('AudioContext not supported in this browser');
        }
        const audioContext = new AudioContextClass({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        
        // Verify actual sample rate matches expected
        const actualSampleRate = audioContext.sampleRate;
        if (actualSampleRate !== 16000) {
          console.warn(`Sample rate mismatch: expected 16000, got ${actualSampleRate}. Resampling may be needed.`);
          // For now, we'll proceed but this should ideally trigger resampling
        }
        
        const source = audioContext.createMediaStreamSource(stream);
        
        // Use ScriptProcessorNode (deprecated but widely supported)
        // For modern browsers, consider AudioWorklet for better performance
        const bufferSize = 4096; // Optimal balance between latency and processing
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        processor.onaudioprocess = (e) => {
          if (socket.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32 [-1, 1] to Int16 LINEAR16 little-endian PCM
            const int16Buffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              // Clamp to [-1, 1] and convert to 16-bit signed integer
              const sample = Math.max(-1, Math.min(1, inputData[i]));
              int16Buffer[i] = sample < 0 
                ? Math.max(-0x8000, sample * 0x8000) 
                : Math.min(0x7FFF, sample * 0x7FFF);
            }
            
            // Send binary data
            socket.send(int16Buffer.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        audioProcessorRef.current = {
          stop: () => {
            stream.getTracks().forEach(track => {
              track.stop();
              track.enabled = false;
            });
            processor.disconnect();
            source.disconnect();
            audioContext.close().catch(err => {
              console.error("Error closing audio context:", err);
            });
          }
        };
      } catch (err) {
        console.error("Error accessing microphone:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        
        if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
          toast.error("Microphone access denied. Please enable microphone permissions in your browser settings.");
        } else if (errorMessage.includes("not found") || errorMessage.includes("no device")) {
          toast.error("No microphone found. Please connect a microphone and try again.");
        } else {
          toast.error("Could not access microphone. Please check your device settings.");
        }
        stopRecording();
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle errors
      if (data.error) {
        if (data.error === "limit_exceeded") {
          toast.error(data.message || "Maximum recording duration exceeded. Please stop recording.");
          stopRecording();
        } else if (data.error === "stream_error" && data.reconnect) {
          toast.warning("Connection issue. Reconnecting...");
          setRecordingWarning("Reconnecting to transcription service...");
          // Connection will be re-established automatically by backend
        } else {
          toast.error(data.message || "Transcription error occurred");
          stopRecording();
        }
        return;
      }
      
      // Handle warnings
      if (data.warning) {
        if (data.warning === "time_limit_approaching") {
          setRecordingWarning(data.message);
          toast.warning(data.message, { duration: 5000 });
        } else if (data.warning === "stream_reconnect") {
          setRecordingWarning(null); // Clear any previous warnings
          toast.info("Stream reconnected successfully");
          streamNumberRef.current = data.stream_number || 0;
        }
        return;
      }
      
      // Track stream number
      if (data.stream_number) {
        streamNumberRef.current = data.stream_number;
      }

      // Handle transcription results
      if (data.is_final) {
        setUserAnswer(prev => {
          const newText = prev + (prev && !prev.endsWith(' ') ? ' ' : '') + data.transcript;
          
          // Calculate metrics from word timings (only available in final results)
          if (data.words && data.words.length > 0) {
            const words = data.words;
            const firstWord = words[0];
            const lastWord = words[words.length - 1];
            const totalTime = lastWord.end_time - firstWord.start_time;
            
            if (totalTime > 0) {
              // Calculate WPM for this segment
              const segmentWordCount = words.length;
              const segmentWPM = Math.round((segmentWordCount / totalTime) * 60);
              
              // Update metrics (average across all segments)
              setFinalVocalMetrics(prev => {
                // Count filler words in entire transcript
                const FILLER_WORDS = new Set(['um', 'uh', 'er', 'ah', 'like', 'so', 'you know', 'actually', 'basically', 'literally']);
                const allWords = newText.toLowerCase().split(/\s+/);
                const fillerCount = allWords.reduce((count, word) => {
                  const cleanWord = word.replace(/[.,?!]/g, '');
                  return count + (FILLER_WORDS.has(cleanWord) ? 1 : 0);
                }, 0);
                
                // Calculate overall WPM based on total words and time
                // For now, use segment WPM as approximation (better would be to track total time)
                return { 
                  speakingPaceWPM: segmentWPM || prev.speakingPaceWPM, 
                  fillerWordCount: fillerCount 
                };
              });
            }
          }
          return newText;
        });
        setInterimTranscript(''); // Clear interim when final arrives
      } else {
        // Interim result - show as temporary text
        setInterimTranscript(data.transcript);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      // Don't immediately stop - let onclose handle cleanup
      // Error details will be handled by onclose event
    };

    socket.onclose = (event) => {
      setIsRecording(false);
      setRecordingWarning(null);
      
      if (event.code === 1008) {
        // Policy violation (auth failure)
        toast.error("Authentication failed. Please log in again.");
        logout();
        router.push('/login');
      } else if (event.code === 1011) {
        // Internal error
        toast.error("Transcription service unavailable. Please try again later.");
      } else if (event.wasClean) {
        // Clean close (user stopped recording)
        toast.info("Recording stopped.");
      } else {
        // Unexpected close
        toast.warning("Connection closed unexpectedly.");
      }
    };
  };

  const stopRecording = () => {
    audioProcessorRef.current?.stop();
    socketRef.current?.close();
    setIsRecording(false);
    audioProcessorRef.current = null;
    socketRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Clear answer when starting to record
  useEffect(() => {
    if (isRecording) {
      // Answer is already cleared in startRecording, but we keep this for safety
    }
  }, [isRecording]);
  // ------------------------------------------

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
    // Disable submission while recording
    if (!accessToken || !question || !userAnswer.trim() || isSubmitting || isRecording) return;
    
    setIsSubmitting(true);
    // CHANGE: We no longer show a toast here, we will show it upon response
    
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
          answer_text: userAnswer,
          speaking_pace_wpm: finalVocalMetrics.speakingPaceWPM,
          filler_word_count: finalVocalMetrics.fillerWordCount,
        })
      });
      
      if (response.status === 401) {
        // Unauthorized - token expired or invalid
        toast.error("Session expired. Please log in again.");
        logout();
        router.push('/login');
        return;
      }
      
      if (!response.ok) throw new Error("Failed to save your answer.");
      
      // NEW LOGIC TO HANDLE THE RESPONSE
      const responseData = await response.json();
      
      // Show the one-liner feedback as a success toast
      if (responseData.oneLiner) {
        toast.success("Feedback Snapshot", {
          description: responseData.oneLiner,
          duration: 6000, // Keep it on screen a bit longer
        });
      }
      
      setUserAnswer('');

      // Fetch next question slightly faster, as the user is reading the feedback
      setTimeout(async () => {
          await fetchNextQuestion(accessToken);
      }, 500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit answer';
      // Use a standard error toast
      toast.error(errorMessage);
      // If submission fails, re-fetch the current question to show it again
      setQuestion(originalQuestion);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Disable submit shortcut while recording or while avatar is speaking
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !isRecording && !isAvatarSpeaking) {
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
            isListening={isRecording && !isAvatarSpeaking} // Only "listen" when the avatar isn't speaking
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
            : isRecording ? "I'm listening..." : "Ready for your answer"}
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
                    {recordingWarning && (
                      <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        ⚠️ {recordingWarning}
                      </div>
                    )}
                    <Textarea
                        placeholder="Type or record your answer here... (Ctrl+Enter to submit)"
                        // The value is now a combination of final and interim text
                        value={userAnswer + interimTranscript}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={8}
                        className="text-base focus:ring-2 ring-offset-2 focus:ring-primary"
                        // Disable textarea while avatar is speaking
                        disabled={isSubmitting || isRecording || isAvatarSpeaking}
                    />
                    {interimTranscript && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Listening... {interimTranscript}
                      </p>
                    )}
                    {/* --- Button container --- */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSubmitAnswer}
                        // Disable submit button while avatar is speaking
                        disabled={!userAnswer.trim() || isSubmitting || isRecording || isAvatarSpeaking}
                        className="w-full sm:w-auto"
                      >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Processing...' : 'Submit Answer'}
                      </Button>
                      
                      {/* --- Record Button --- */}
                      <Button
                        variant={isRecording ? "destructive" : "outline"}
                        onClick={isRecording ? stopRecording : startRecording}
                        className="w-full sm:w-auto"
                        // Disable record button while avatar is speaking
                        disabled={isSubmitting || isAvatarSpeaking}
                      >
                        {isRecording ? (
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
                    </div>
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
