'use client'

import { useState, useEffect, useCallback, KeyboardEvent, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useMediaStream } from '@/contexts/MediaStreamContext'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { toast } from "sonner"
import { Loader2, Mic, MicOff, X, Volume2, MessageSquareQuote, Camera } from "lucide-react" 
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import AnimatedPage from '@/components/AnimatedPage'
import { AnimatedAiva } from '@/components/AnimatedAiva'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import { WaveformVisualizer } from '@/components/WaveformVisualizer'
import CodingChallengeUI from '@/components/interview/CodingChallengeUI'
import { FeedbackHUD } from '@/components/interview/FeedbackHUD'

interface Question {
  id: number;
  content: string;
}

// NEW: Update the question response interface
interface CodingProblem {
  id: number;
  title: string;
  description: string;
  starter_code: string | null;
  test_cases: Array<{ stdin: string; expected_output: string }>;
}

interface QuestionWithAudio extends Question {
  audio_content: string;
  speech_marks: Array<{ timeSeconds: number; value: string }>;
  question_type: 'behavioral' | 'coding';
  coding_problem?: CodingProblem | null;
}

const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="h-8 bg-muted rounded w-1/4 animate-pulse"></div>
      <div className="h-40 bg-muted rounded animate-pulse"></div>
      <div className="h-24 bg-muted rounded animate-pulse"></div>
      <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
    </div>
);

// --- NEW component for better visual feedback during recording ---
const RecordingIndicator = () => (
    <div className="flex items-center space-x-2 text-destructive">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
        <span className="text-sm font-medium">Recording</span>
    </div>
);

// Language interface for API response
interface Language {
  name: string;
  code: string;
}

export default function InterviewPage() {
  const { accessToken, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  // UPDATE the question state to hold the new, richer object
  const [question, setQuestion] = useState<QuestionWithAudio | null>(null)
  const [isManuallyTyping, setIsManuallyTyping] = useState(false)
  const [interviewState, setInterviewState] = useState<'loading' | 'in-progress' | 'completed'>('loading')
  const [error, setError] = useState<string | null>(null)
  
  const [questionCount, setQuestionCount] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(1) // Start with 1 to avoid divide-by-zero
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- ADD NEW STATE FOR LANGUAGE DISPLAY ---
  const [sessionLanguageCode, setSessionLanguageCode] = useState('en-US');
  const [languages, setLanguages] = useState<Language[]>([]);
  // ------------------------------------------

  // NEW: State to control when user can start answering
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false)

  // --- NEW state for quit confirmation dialog ---
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);

  // --- NEW STATE FOR REAL-TIME TRANSCRIPTION ---
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [deliveryMetrics, setDeliveryMetrics] = useState({ wpm: 0, fillerCount: 0 });
  const [recordingWarning, setRecordingWarning] = useState<string | null>(null);
  
  // --- NEW: Refs for video element ---
  const userVideoRef = useRef<HTMLVideoElement>(null);
  
  // --- NEW: MediaStream and Analysis Hooks ---
  const { startAnalysis, stopAnalysis, metrics: videoMetrics, videoStream, isCameraReady, requestPermissions } = useMediaStream();
  const { metrics: audioMetrics, start: startAudioAnalysis, stop: stopAudioAnalysis } = useAudioAnalysis();
  
  // --- NEW: Speech Recognition Hook ---
  const { 
    text: speechText, 
    interimText, 
    isListening, 
    isSupported: isSpeechSupported,
    startListening, 
    stopListening 
  } = useSpeechRecognition({
    onTranscriptChanged: setTranscript,
    onMetricsChanged: setDeliveryMetrics
  });
  
  // Legacy WebSocket refs (kept for backward compatibility if needed)
  const socketRef = useRef<WebSocket | null>(null);
  const audioProcessorRef = useRef<{ stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const streamNumberRef = useRef(0);
  // ---------------------------------------------

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // --- DYNAMIC HELPER FUNCTION (Uses fetched languages for all language display names) ---
  const getLanguageDisplayName = (code: string) => {
    const language = languages.find(lang => lang.code === code);
    return language ? language.name : code; // Fallback to code if not found
  };
  // -------------------------------------------------------------------------------------

  // --- NEW: Analysis Orchestration ---
  useEffect(() => {
    if (videoStream && userVideoRef.current && isCameraReady) {
      const videoElement = userVideoRef.current;
      
      // Assign the stream to the visible video element
      videoElement.srcObject = videoStream;
      videoElement.play().catch((error) => {
        console.error("Error playing video:", error);
      });
      
      // Start MediaPipe analysis using the same video element
      // Note: Video stream doesn't have audio, so we only do video analysis here
      startAnalysis(videoElement);
      // Audio analysis will be started separately when user starts recording (has microphone audio)
    }
    
    // Cleanup function to stop analysis when the component unmounts
    return () => {
      stopAnalysis();
      stopAudioAnalysis();
    };
  }, [videoStream, isCameraReady, startAnalysis, stopAnalysis, stopAudioAnalysis]);

  // Ensure video element gets the stream when it becomes available
  useEffect(() => {
    if (videoStream && userVideoRef.current) {
      const videoElement = userVideoRef.current;
      // Always update if stream changes
      videoElement.srcObject = videoStream;
      videoElement.play().catch((error) => {
        console.error("Error playing video:", error);
      });
    } else if (userVideoRef.current && !videoStream) {
      // Clear video if stream is removed
      userVideoRef.current.srcObject = null;
    }
  }, [videoStream]);


  // --- NEW: Handle microphone click ---
  const handleMicClick = async () => {
    if (isListening) {
      stopListening();
      stopAudioAnalysis(); // Stop audio analysis when stopping recording
    } else {
      // Start speech recognition
      startListening();
      
      // Also start audio analysis with microphone stream
      try {
        // Request microphone access for audio analysis
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        startAudioAnalysis(audioStream);
      } catch (error) {
        console.warn('Could not access microphone for audio analysis:', error);
        // Continue without audio analysis - speech recognition will still work
      }
    }
  };

  // --- LEGACY: WebSocket recording functions (kept for reference, but we'll use Web Speech API) ---
  const startRecording = async () => {
    if (!accessToken) return;

    // Reset state (legacy function - kept for compatibility)
    setTranscript('');
    setTextInput('');
    setIsManuallyTyping(false);

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
        
        // Legacy WebSocket code - stream handling removed (not used with Web Speech API)
        mediaStreamRef.current = stream; // Keep the ref for direct access in cleanup
        
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

      // Legacy WebSocket transcription handling - not used with new Web Speech API
      // The new implementation uses useSpeechRecognition hook which handles transcription
      if (data.is_final) {
        // Legacy code - Web Speech API handles this now
        console.log('Legacy WebSocket transcription:', data.transcript);
      } else {
        // Legacy interim results - Web Speech API handles this now
        console.log('Legacy WebSocket interim:', data.transcript);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      // Don't immediately stop - let onclose handle cleanup
      // Error details will be handled by onclose event
    };

    socket.onclose = (event) => {
      // Legacy WebSocket code - not used with new Web Speech API
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
    // Legacy WebSocket cleanup function
    audioProcessorRef.current?.stop();
    socketRef.current?.close();
    audioProcessorRef.current = null;
    socketRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Clear answer when starting to listen (using new Web Speech API)
  useEffect(() => {
    if (isListening) {
      // Transcript is managed by useSpeechRecognition hook
    }
  }, [isListening]);
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
        // --- STORE THE LANGUAGE CODE ---
        setSessionLanguageCode(data.language_code || 'en-US');
        // -------------------------------
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
        // Debug logging
        console.log('Question data received:', {
          id: data.id,
          question_type: data.question_type,
          has_coding_problem: !!data.coding_problem,
          coding_problem: data.coding_problem
        });
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

  // --- FETCH LANGUAGES FOR DYNAMIC DISPLAY ---
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/languages`);
        if (response.ok) {
          const languagesData: Language[] = await response.json();
          setLanguages(languagesData);
        }
      } catch (err) {
        console.warn('Failed to fetch languages:', err);
        // Continue with empty array - will fallback to language codes
      }
    };
    
    fetchLanguages();
  }, [apiUrl]);

  const handleSubmitAnswer = async () => {
    // Combine transcript (from speech) and textInput (manual typing)
    const combinedAnswer = (transcript.trim() + " " + textInput.trim()).trim();
    
    // Disable submission while recording
    if (!accessToken || !question || !combinedAnswer || isSubmitting || isListening) return;
    
    setIsSubmitting(true);
    
    try {
      // Calculate vocal confidence as a combined metric
      const vocalConfidence = (audioMetrics.pitchVariation + audioMetrics.volumeStability) / 2;
      
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          question_id: question.id,
          answer_text: combinedAnswer,
          eye_contact_score: videoMetrics.eyeContactPercentage / 100,
          speaking_pace_wpm: deliveryMetrics.wpm,
          filler_word_count: deliveryMetrics.fillerCount,
          pitch_variation_score: audioMetrics.pitchVariation,
          volume_stability_score: audioMetrics.volumeStability,
          posture_stability_score: videoMetrics.postureScore / 100,
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
      
      setTranscript('');
      setTextInput('');
      setIsManuallyTyping(false); // Reset manual typing for next question

      // We still fetch the next question, but the UI will smoothly transition
      // instead of waiting for a full component unmount/remount.
      await fetchNextQuestion(accessToken);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit answer';
      // Use a standard error toast
      toast.error(errorMessage);
    } finally {
      // We'll set isSubmitting to false AFTER the new question has been fetched
      // The fetchNextQuestion function already handles setting the interview state
      setIsSubmitting(false); 
    }
  };

  // --- ADD THIS NEW HANDLER ---
  const handleCodingSubmit = async (code: string, results: Record<string, unknown>) => {
    if (!accessToken || !question) return;
    
    setIsSubmitting(true);
    try {
      // For coding problems, the answer_text is the code itself.
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          question_id: question.id,
          answer_text: code,
          coding_results: results
        })
      });

      if (response.status === 401) {
        toast.error("Session expired. Please log in again.");
        logout();
        router.push('/login');
        return;
      }

      if (!response.ok) throw new Error("Failed to save coding submission.");

      await fetchNextQuestion(accessToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // --- END ADD ---

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

  // --- NEW function to handle quitting the interview ---
  const handleQuitInterview = () => {
    setIsQuitConfirmOpen(false);
    toast.info("Interview session ended.");
    router.push('/dashboard');
  };
  
  return (
    <>
      <AnimatedPage className="flex h-screen bg-gray-50">
        {/* --- NEW Quit button in the top right corner --- */}
        <div className="absolute top-4 right-4 z-20">
            <Button variant="outline" size="sm" onClick={() => setIsQuitConfirmOpen(true)}>
                <X className="h-4 w-4 mr-2" />
                Quit Interview
            </Button>
        </div>

        <aside className="hidden md:flex flex-col items-center justify-center w-1/3 bg-gradient-to-b from-gray-900 to-gray-800 p-8 text-white relative border-r border-gray-700">
          <div className="absolute top-6 left-6 text-left">
            <h2 className="text-2xl font-bold tracking-tight">AIVA</h2>
            <p className="text-gray-400 text-sm">AI Virtual Assistant</p>
          </div>
          
          {/* Aiva Avatar and status text - Centered */}
          <div className="flex flex-col items-center justify-center space-y-4 w-full">
            <div className="w-48 h-48 flex items-center justify-center">
              <AnimatedAiva
                  audioContent={question?.audio_content || null}
                  speechMarks={question?.speech_marks || []}
                  isListening={isListening && !isAvatarSpeaking}
                  onPlaybackComplete={handlePlaybackComplete}
              />
            </div>
            
            {/* Language Display */}
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Language</p>
              <p className="text-sm font-medium text-gray-300">
                {getLanguageDisplayName(sessionLanguageCode)}
              </p>
            </div>
            
            {/* Status Display */}
            <div className="text-center mt-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isAvatarSpeaking ? "speaking" : isListening ? "listening" : "ready"}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center gap-2"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    isAvatarSpeaking ? 'bg-blue-500 animate-pulse' : 
                    isListening ? 'bg-green-500 animate-pulse' : 
                    'bg-gray-500'
                  }`} />
                  <p className="text-sm text-gray-400">
                    {isAvatarSpeaking 
                      ? "Listen to the question..." 
                      : isListening ? "I'm listening..." : "Ready for your answer"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </aside>

      <main className="w-full md:w-2/3 p-6 md:p-8 flex flex-col overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto w-full space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-destructive font-medium">Error: {error}</p>
              </div>
            )}
            
            {/* 1. Full Page Loading Skeleton (on initial load) */}
            {interviewState === 'loading' && (
              <LoadingSkeleton />
            )}
            
            {/* 2. Main Interview UI (persistent structure) */}
            {interviewState === 'in-progress' && (
              <>
                {question && question.question_type === 'coding' && question.coding_problem ? (
                  // RENDER CODING UI
                  <motion.div key="coding-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
                          Question {questionCount} of {totalQuestions}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Coding Challenge
                        </Badge>
                      </div>
                      <Progress value={(questionCount / totalQuestions) * 100} className="h-2" />
                    </div>
                    <CodingChallengeUI 
                      problem={question.coding_problem}
                      onSubmit={handleCodingSubmit}
                    />
                  </motion.div>
                ) : (
                  // RENDER BEHAVIORAL UI - Clean, organized layout
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
                          Question {questionCount} of {totalQuestions}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Behavioral
                        </Badge>
                      </div>
                      <Progress value={(questionCount / totalQuestions) * 100} className="h-2" />
                    </div>

                    {/* Question Card - Prominent */}
                    <Card className="border-2 shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <MessageSquareQuote className="h-5 w-5 text-primary" />
                          Question
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg leading-relaxed text-foreground">
                          {question?.content || 'Loading question...'}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Main Content Grid - Video and Answer */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* User Video Panel */}
                      <Card className="lg:order-2">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            Your Video
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="w-full aspect-video bg-gray-900 rounded-b-lg overflow-hidden border-t relative">
                            <video
                              ref={userVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                            {!videoStream && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-sm text-gray-300 p-6 z-10">
                                <div className="text-center space-y-4 max-w-xs">
                                  <div className="mx-auto w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700">
                                    <Camera className="h-8 w-8 opacity-60" />
                                  </div>
                                  <div>
                                    <p className="text-base font-semibold mb-1 text-white">Camera Not Active</p>
                                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                                      Enable your camera to see your video feed and enable real-time analysis
                                    </p>
                                    <Button
                                      onClick={async () => {
                                        try {
                                          const granted = await requestPermissions()
                                          if (granted) {
                                            toast.success('Camera access granted! Video feed will appear shortly.')
                                          } else {
                                            toast.error('Camera permission denied. Please enable it in your browser settings.')
                                          }
                                        } catch (error) {
                                          console.error('Error requesting camera:', error)
                                          toast.error('Failed to access camera. Please check your browser settings.')
                                        }
                                      }}
                                      size="lg"
                                      className="bg-primary hover:bg-primary/90 text-white w-full"
                                    >
                                      <Camera className="h-4 w-4 mr-2" />
                                      Enable Camera
                                    </Button>
                                    <p className="text-xs text-gray-500 mt-3">
                                      Or go back to the <a href={`/interview/${sessionId}/ready`} className="underline hover:text-gray-400">setup screen</a>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Answer Panel */}
                      <Card className="lg:order-1">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquareQuote className="h-4 w-4" />
                            Your Answer
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea
                            placeholder="Type or record your answer here... (Ctrl+Enter to submit)"
                            value={transcript.trim() 
                              ? (transcript.trim() + (textInput.trim() ? ' ' + textInput.trim() : ''))
                              : textInput.trim()}
                            onChange={(e) => {
                              const newValue = e.target.value
                              if (!newValue.startsWith(transcript.trim())) {
                                setTextInput(newValue)
                              } else {
                                setTextInput(newValue.slice(transcript.trim().length).trim())
                              }
                            }}
                            onKeyDown={handleKeyDown}
                            rows={10}
                            className="text-base resize-none"
                            disabled={interviewState !== 'in-progress' || isAvatarSpeaking}
                          />
                          
                          {transcript && (
                            <p className="text-xs text-muted-foreground italic">
                              💬 Voice transcription active
                            </p>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              onClick={handleMicClick}
                              variant={isListening ? 'destructive' : 'outline'}
                              disabled={!isSpeechSupported || interviewState !== 'in-progress' || isAvatarSpeaking}
                              className="flex-1"
                              size="lg"
                            >
                              {isListening ? (
                                <>
                                  <MicOff className="mr-2 h-4 w-4" />
                                  Stop Recording
                                </>
                              ) : (
                                <>
                                  <Mic className="mr-2 h-4 w-4" />
                                  Start Recording
                                </>
                              )}
                            </Button>

                            <Button
                              onClick={handleSubmitAnswer}
                              disabled={!transcript.trim() && !textInput.trim() || interviewState !== 'in-progress' || isListening || isAvatarSpeaking}
                              className="flex-1"
                              size="lg"
                              variant="default"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                'Submit Answer'
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Feedback HUD - only show when listening */}
                    {isListening && (
                      <FeedbackHUD
                        wpm={deliveryMetrics.wpm}
                        fillerCount={deliveryMetrics.fillerCount}
                        vocalConfidence={(audioMetrics.pitchVariation + audioMetrics.volumeStability) / 2}
                        postureScore={videoMetrics.postureScore}
                        opennessScore={videoMetrics.opennessScore}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {/* 3. Interview Complete UI */}
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
        </div>
      </main>
    </AnimatedPage>

    {/* --- NEW Confirmation Dialog component --- */}
    <ConfirmationDialog
      isOpen={isQuitConfirmOpen}
      onClose={() => setIsQuitConfirmOpen(false)}
      onConfirm={handleQuitInterview}
      title="Are you sure you want to quit?"
      description="Your progress in this interview session will be lost. This action cannot be undone."
      confirmText="Quit Interview"
    />
    </>
  )
}
