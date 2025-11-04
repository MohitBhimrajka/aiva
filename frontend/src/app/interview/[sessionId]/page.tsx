'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useInterviewManager, InterviewState } from '@/hooks/useInterviewManager'
import { useHeyGen } from '@/hooks/useHeyGen'
import { useMediaStream } from '@/contexts/MediaStreamContext'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { FeedbackHUD } from '@/components/interview/FeedbackHUD'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import AnimatedPage from '@/components/AnimatedPage'
import { InterviewerPanel } from '@/components/interview/InterviewerPanel'
import { UserResponsePanel } from '@/components/interview/UserResponsePanel'
import { AvatarDisplay } from '@/components/interview/AvatarDisplay'

export default function InterviewPage() {
  const [transcript, setTranscript] = useState("")
  const router = useRouter()
  const userVideoRef = useRef<HTMLVideoElement>(null) // Ref for the visible video feed

  // Get analysis functions from our contexts and hooks
  const { startAnalysis, stopAnalysis, metrics: videoMetrics, videoStream, requestPermissions, isCameraReady } = useMediaStream()
  const { metrics: audioMetrics, start: startAudioAnalysis, stop: stopAudioAnalysis } = useAudioAnalysis()
  const [deliveryMetrics, setDeliveryMetrics] = useState({ wpm: 0, fillerCount: 0 })

  // Auto-request permissions if not already granted
  useEffect(() => {
    if (!videoStream && !isCameraReady) {
      requestPermissions().catch((error) => {
        console.error("Failed to request camera permissions:", error);
        toast.error("Camera access denied. Please enable camera permissions to continue.");
      });
    }
  }, [videoStream, isCameraReady, requestPermissions]);

  // All other hooks
  const { interviewState, setInterviewState, currentQuestion, sessionDetails, answeredCount, error, submitAnswerAndGetNext } = useInterviewManager()
  const { stream: avatarStream, isConnected: isAvatarConnected, speak } = useHeyGen()
  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onTranscriptChanged: setTranscript,
    onMetricsChanged: setDeliveryMetrics
  })

  // Start all analysis when the video stream is ready
  useEffect(() => {
    if (videoStream && userVideoRef.current) {
        const videoElement = userVideoRef.current;
        // Assign the stream to the visible video element
        videoElement.srcObject = videoStream;
        
        // Ensure the video plays
        videoElement.play().catch((error) => {
          console.error("Error playing video:", error);
        });
        
        // Start MediaPipe analysis using the same video element
        startAnalysis(videoElement);
        // Start Web Audio API analysis using the same stream
        startAudioAnalysis(videoStream);
    }
    // Cleanup function to stop analysis when the component unmounts
    return () => {
        stopAnalysis();
        stopAudioAnalysis();
    }
  }, [videoStream, startAnalysis, stopAnalysis, startAudioAnalysis, stopAudioAnalysis]);
  
  // Let the avatar speak when a new question arrives
  useEffect(() => {
    if (currentQuestion?.content && isAvatarConnected) {
      speak(currentQuestion.content)
    }
  }, [currentQuestion, isAvatarConnected, speak])

  // Sync our interview state with the speech recognition state
  useEffect(() => {
    if (interviewState === InterviewState.LISTENING) {
      startListening()
    } else {
      stopListening()
    }
  }, [interviewState, startListening, stopListening])

  const handleMicClick = () => {
    setInterviewState(isListening ? InterviewState.IDLE : InterviewState.LISTENING)
    if (!isListening) setTranscript("")
  }

  const vocalConfidence = (audioMetrics.pitchVariation + audioMetrics.volumeStability) / 2;

  const handleSubmit = () => {
    if (transcript.trim().length > 0) {
      submitAnswerAndGetNext(transcript, {
        eyeContactScore: videoMetrics.eyeContactPercentage / 100,
        speaking_pace_wpm: deliveryMetrics.wpm,
        filler_word_count: deliveryMetrics.fillerCount,
        pitch_variation_score: audioMetrics.pitchVariation,
        volume_stability_score: audioMetrics.volumeStability,
        posture_score: videoMetrics.postureScore / 100,
        openness_score: videoMetrics.opennessScore / 100
      });
      setTranscript("")
    } else {
      toast.warning("Please provide an answer before submitting.")
    }
  }
  
  if (interviewState === InterviewState.LOADING || error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        {error ? (
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">Back to Dashboard</Button>
          </Alert>
        ) : (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        )}
      </div>
    )
  }
  
  const progressValue = sessionDetails ? (answeredCount / sessionDetails.total_questions) * 100 : 0;

  return (
    <AnimatedPage>
      <main className="container mx-auto flex h-screen flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl relative"> {/* Added relative positioning for HUD */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-muted-foreground">{sessionDetails?.role.name} - {sessionDetails?.difficulty}</h2>
              <p className="text-lg font-semibold">{answeredCount} / {sessionDetails?.total_questions}</p>
            </div>
            <Progress value={progressValue} className="w-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InterviewerPanel question={currentQuestion?.content}>
              <AvatarDisplay stream={avatarStream} />
            </InterviewerPanel>
            
            <UserResponsePanel 
              transcript={transcript}
              interviewState={interviewState}
              isListening={isListening}
              isSupported={isSupported}
              handleMicClick={handleMicClick}
              handleSubmit={handleSubmit}
              videoRef={userVideoRef} // Pass the ref to the component
            />
          </div>

          {isListening && (
            <FeedbackHUD 
              wpm={deliveryMetrics.wpm} 
              fillerCount={deliveryMetrics.fillerCount} 
              vocalConfidence={vocalConfidence}
              postureScore={videoMetrics.postureScore}
              opennessScore={videoMetrics.opennessScore}
            />
          )}

          {!isSupported && (
            <Alert variant="destructive" className="mt-8">
              <AlertTitle>Browser Not Supported</AlertTitle>
              <AlertDescription>Your browser does not support live speech recognition. Please use a recent version of Google Chrome or Firefox.</AlertDescription>
            </Alert>
          )}
        </div>
      </main>
    </AnimatedPage>
  )
}
