'use client'

import { useState, useEffect, useCallback, KeyboardEvent, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useMediaStream } from '@/contexts/MediaStreamContext'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { toast } from "sonner"
import { Loader2, Mic, MicOff, X, MessageSquareQuote, Camera, RotateCcw } from "lucide-react" 
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import AnimatedPage from '@/components/AnimatedPage'
import { AnimatedAiva } from '@/components/AnimatedAiva'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import CodingChallengeUI from '@/components/interview/CodingChallengeUI'
import { FeedbackHUD } from '@/components/interview/FeedbackHUD'

interface Question {
  id: number;
  content: string;
}

// Combined interface supporting both HeyGen video and coding challenges
interface CodingProblem {
  id: number;
  title: string;
  description: string;
  starter_code: string | null;
  test_cases: Array<{ stdin: string; expected_output: string }>;
}

interface QuestionWithHybrid extends Question {
  video_url: string | null;
  audio_content: string | null;
  speech_marks: Array<{ timeSeconds: number; value: string }> | null;
  use_video: boolean;
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

  // Combined state to hold the hybrid object (video AND/OR audio + coding support)
  const [question, setQuestion] = useState<QuestionWithHybrid | null>(null)
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
  const [canReplay, setCanReplay] = useState(false)

  // --- NEW state for quit confirmation dialog ---
  const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
  
  // --- NEW: Refs for replay functionality ---
  const heygenVideoRef = useRef<HTMLVideoElement>(null);

  // --- STATE FOR REAL-TIME TRANSCRIPTION ---
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [deliveryMetrics, setDeliveryMetrics] = useState({ wpm: 0, fillerCount: 0 });
  
  // --- NEW: Refs for video element ---
  const userVideoRef = useRef<HTMLVideoElement>(null);
  
  // --- NEW: MediaStream and Analysis Hooks ---
  const { startAnalysis, stopAnalysis, metrics: videoMetrics, videoStream, isCameraReady, requestPermissions } = useMediaStream();
  const { metrics: audioMetrics, start: startAudioAnalysis, stop: stopAudioAnalysis } = useAudioAnalysis();
  
  // --- Speech Recognition Hook ---
  const { 
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
    if (
      interviewState === 'in-progress' &&
      videoStream &&
      userVideoRef.current &&
      isCameraReady
    ) {
      const videoElement = userVideoRef.current;
      
      // Check if stream has active video tracks
      const videoTracks = videoStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.warn('Video stream has no video tracks');
        return;
      }
      
      // Check if tracks are active
      const activeTracks = videoTracks.filter(track => track.readyState === 'live');
      if (activeTracks.length === 0) {
        console.warn('Video stream tracks are not active');
        return;
      }
      
      // Assign the stream to the visible video element
      videoElement.srcObject = videoStream;
      
      // Ensure video plays - handle autoplay restrictions
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Video is playing');
            // Start MediaPipe analysis using the same video element
            // Note: Video stream doesn't have audio, so we only do video analysis here
            startAnalysis(videoElement);
          })
          .catch((error) => {
            console.error("Error playing video:", error);
            // Try to play again after a short delay
            setTimeout(() => {
              videoElement.play().catch((err) => {
                console.error("Retry play failed:", err);
              });
            }, 100);
          });
      }
    }
    
    // Cleanup function to stop analysis when the component unmounts
    return () => {
      stopAnalysis();
      stopAudioAnalysis();
    };
  }, [videoStream, isCameraReady, interviewState, startAnalysis, stopAnalysis, stopAudioAnalysis]);

  // Ensure video element gets the stream when it becomes available
  useEffect(() => {
    console.log('Video stream effect triggered', { 
      hasStream: !!videoStream, 
      hasVideoRef: !!userVideoRef.current,
      isCameraReady 
    });
    
    if (
      interviewState === 'in-progress' &&
      videoStream &&
      userVideoRef.current
    ) {
      const videoElement = userVideoRef.current;
      
      // Check if stream has active video tracks
      const videoTracks = videoStream.getVideoTracks();
      console.log('Video tracks check', {
        trackCount: videoTracks.length,
        tracks: videoTracks.map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
          settings: t.getSettings()
        }))
      });
      
      if (videoTracks.length > 0) {
        // Always update if stream changes
        console.log('Setting video srcObject');
        videoElement.srcObject = videoStream;
        
        // Force video to be visible
        videoElement.style.display = 'block';
        videoElement.style.visibility = 'visible';
        
        // Ensure video plays
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('✅ Video stream is playing', {
                paused: videoElement.paused,
                readyState: videoElement.readyState,
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight
              });
            })
            .catch((error) => {
              console.error("❌ Error playing video stream:", error);
              // Retry play after a short delay
              setTimeout(() => {
                videoElement.play()
                  .then(() => console.log('✅ Retry play succeeded'))
                  .catch((err) => {
                    console.error("❌ Retry play failed:", err);
                  });
              }, 100);
            });
        }
        
        // Add event listeners for debugging
        videoElement.onloadedmetadata = () => {
          console.log('Video metadata loaded', {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            duration: videoElement.duration
          });
        };
        
        videoElement.oncanplay = () => {
          console.log('Video can play');
          if (videoElement.paused) {
            videoElement.play().catch(err => console.error('Play on canplay failed:', err));
          }
        };
        
        videoElement.onplay = () => {
          console.log('✅ Video started playing');
        };
        
        videoElement.onerror = (e) => {
          console.error('❌ Video element error:', e, videoElement.error);
        };
      } else {
        console.warn('No video tracks in stream');
      }
    } else if (userVideoRef.current && !videoStream) {
      // Clear video if stream is removed
      console.log('Clearing video srcObject');
      userVideoRef.current.srcObject = null;
    }
  }, [videoStream, isCameraReady, interviewState]);


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
    setCanReplay(false); // Reset replay state for new question
    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/question`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 204) {
        setInterviewState('completed');
        setIsAvatarSpeaking(false);
      } else if (response.ok) {
        // Handle the combined response (video + audio + coding support)
        const data: QuestionWithHybrid = await response.json();
        // Debug logging
        console.log('Question data received:', {
          id: data.id,
          question_type: data.question_type,
          use_video: data.use_video,
          has_video: !!data.video_url,
          has_audio: !!data.audio_content,
          has_coding_problem: !!data.coding_problem,
          coding_problem: data.coding_problem
        });
        setQuestion(data);
        setQuestionCount(prev => prev + 1);
        setInterviewState('in-progress');
        // Avatar speaks if video available OR audio content available
        if (!data.video_url && !data.audio_content) {
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

  // Auto-request camera permissions on page load
  useEffect(() => {
    const initCamera = async () => {
      if (!videoStream && !isCameraReady) {
        try {
          console.log('Auto-initializing camera...');
          const granted = await requestPermissions();
          if (granted) {
            console.log('Camera initialized successfully');
            // Give the stream a moment to propagate
            setTimeout(() => {
              if (userVideoRef.current && videoStream) {
                const video = userVideoRef.current;
                if (video.paused) {
                  video.play().catch(err => console.warn('Auto-play failed:', err));
                }
              }
            }, 200);
          } else {
            console.warn('Camera permission not granted, user can enable manually');
          }
        } catch (error) {
          console.warn('Camera initialization skipped:', error);
          // Don't show error - user can enable manually later
        }
      }
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(initCamera, 100);
    return () => clearTimeout(timer);
  }, [videoStream, isCameraReady, requestPermissions]);

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

  // Removed unused handlePlaybackComplete - now handled inline in AnimatedAiva component

  // --- NEW function to handle replaying avatar question ---
  const handleReplayQuestion = () => {
    if (!question) return;
    
    setIsAvatarSpeaking(true);
    setCanReplay(false);
    
    if (question.use_video && question.video_url && heygenVideoRef.current) {
      // Replay HeyGen video
      const video = heygenVideoRef.current;
      video.currentTime = 0;
      video.play().catch(error => {
        console.error('Error replaying video:', error);
        toast.error('Failed to replay video');
        setIsAvatarSpeaking(false);
        setCanReplay(true);
      });
    } else if (question.audio_content && question.speech_marks) {
      // Replay AnimatedAiva - trigger by temporarily clearing and restoring audio
      const audioContent = question.audio_content;
      const speechMarks = question.speech_marks;
      
      // Clear audio to reset AnimatedAiva
      setQuestion(q => q ? { ...q, audio_content: null, speech_marks: [] } : null);
      
      // Restore audio after a brief moment to trigger replay
      setTimeout(() => {
        setQuestion(q => q ? { ...q, audio_content: audioContent, speech_marks: speechMarks } : null);
      }, 100);
    }
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
          
          {/* AIVA Hybrid Avatar and status text - Centered */}
          <div className="flex flex-col items-center justify-center space-y-4 w-full">
            {/* Avatar - Video (HeyGen) OR SVG Animation */}
            <div className="w-48 h-48 flex items-center justify-center relative">
              {question?.use_video && question?.video_url ? (
                // HeyGen Video Avatar for supported languages
                <video 
                  ref={heygenVideoRef}
                  key={question.id} // Force re-render for new questions
                  src={question.video_url}
                  autoPlay
                  muted={false}
                  className="w-full h-full rounded-lg shadow-lg object-cover"
                  onEnded={() => {
                    setIsAvatarSpeaking(false);
                    setCanReplay(true);
                  }}
                  onError={(e) => {
                    console.error('Video playback failed:', e);
                    setIsAvatarSpeaking(false);
                    setCanReplay(true);
                  }}
                  onLoadStart={() => setIsAvatarSpeaking(true)}
                  onCanPlay={() => setIsAvatarSpeaking(true)}
                  preload="auto"
                  controls={false}
                  playsInline
                />
              ) : (
                // SVG Avatar with Google TTS for other languages
                <AnimatedAiva
                  audioContent={question?.audio_content || null}
                  speechMarks={question?.speech_marks || []}
                  isListening={isListening && !isAvatarSpeaking}
                  onPlaybackComplete={() => {
                    setIsAvatarSpeaking(false);
                    setCanReplay(true);
                    // Clear the audio/speech data so avatar can transition to idle/listening
                    setQuestion(q => q ? { ...q, audio_content: null, speech_marks: [] } : null);
                  }}
                />
              )}
            </div>
            
            {/* Replay Button */}
            <AnimatePresence>
              {canReplay && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Button
                    onClick={handleReplayQuestion}
                    variant="outline"
                    size="sm"
                    className="bg-gray-800/50 hover:bg-gray-700 border-gray-600 text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Replay Question
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            
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
                              style={{ display: 'block', visibility: 'visible' }}
                              onLoadedMetadata={(e) => {
                                // Ensure video plays when metadata is loaded
                                const video = e.currentTarget;
                                console.log('onLoadedMetadata triggered', {
                                  videoWidth: video.videoWidth,
                                  videoHeight: video.videoHeight,
                                  srcObject: !!video.srcObject
                                });
                                video.play().catch((error) => {
                                  console.warn('Autoplay prevented, will retry:', error);
                                });
                              }}
                              onCanPlay={(e) => {
                                // Ensure video plays when it can play
                                const video = e.currentTarget;
                                console.log('onCanPlay triggered', {
                                  paused: video.paused,
                                  readyState: video.readyState
                                });
                                if (video.paused) {
                                  video.play().catch((error) => {
                                    console.warn('Play failed on canPlay:', error);
                                  });
                                }
                              }}
                              onPlay={() => {
                                console.log('✅ Video onPlay event fired');
                              }}
                              onError={(e) => {
                                const video = e.currentTarget;
                                console.error('❌ Video onError event', {
                                  error: video.error,
                                  networkState: video.networkState,
                                  readyState: video.readyState
                                });
                              }}
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
                                          console.log('User clicked Enable Camera button');
                                          const granted = await requestPermissions()
                                          if (granted) {
                                            toast.success('Camera access granted! Video feed will appear shortly.')
                                            // Force video element to play after a short delay
                                            setTimeout(() => {
                                              if (userVideoRef.current && videoStream) {
                                                const video = userVideoRef.current;
                                                video.srcObject = videoStream;
                                                video.play().catch(err => {
                                                  console.error('Failed to play video after permission grant:', err);
                                                  toast.error('Camera enabled but video playback failed. Please refresh the page.');
                                                });
                                              }
                                            }, 300);
                                          } else {
                                            toast.error('Camera permission denied. Please enable it in your browser settings.')
                                          }
                                        } catch (error) {
                                          console.error('Error requesting camera:', error)
                                          const errorObj = error as { name?: string; message?: string }
                                          const errorMsg = errorObj?.name === 'NotAllowedError' 
                                            ? 'Camera permission denied. Please allow camera access in your browser settings.'
                                            : errorObj?.name === 'NotFoundError'
                                            ? 'No camera found. Please connect a camera and try again.'
                                            : 'Failed to access camera. Please check your browser settings.'
                                          toast.error(errorMsg)
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
                            {videoStream && userVideoRef.current && userVideoRef.current.paused && (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm z-5 pointer-events-none">
                                <div className="text-center text-white text-sm">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                  <p>Loading camera...</p>
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
                              const transcriptText = transcript.trim()
                              
                              if (!transcriptText) {
                                // No transcript, just update text input
                                setTextInput(newValue)
                              } else if (newValue.startsWith(transcriptText)) {
                                // User is typing after transcript, preserve the space
                                const afterTranscript = newValue.slice(transcriptText.length)
                                setTextInput(afterTranscript.startsWith(' ') ? afterTranscript.slice(1) : afterTranscript)
                              } else {
                                // User is editing/replacing transcript
                                setTextInput(newValue)
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
