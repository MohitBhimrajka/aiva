'use client'

import React, { useEffect } from 'react'
import { Mic, MicOff, Loader2, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InterviewState } from '@/hooks/useInterviewManager'
import { useMediaStream } from '@/contexts/MediaStreamContext'

interface UserResponsePanelProps {
  transcript: string;
  interviewState: InterviewState;
  isListening: boolean;
  isSupported: boolean;
  handleMicClick: () => void;
  handleSubmit: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; // Accept the ref from the parent
}

export function UserResponsePanel({
  transcript,
  interviewState,
  isListening,
  isSupported,
  handleMicClick,
  handleSubmit,
  videoRef
}: UserResponsePanelProps) {
  const { videoStream } = useMediaStream();

  // Ensure the video element gets the stream when both are available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      const videoElement = videoRef.current;
      if (videoElement.srcObject !== videoStream) {
        videoElement.srcObject = videoStream;
        videoElement.play().catch((error) => {
          console.error("Error playing video in UserResponsePanel:", error);
        });
      }
    }
  }, [videoRef, videoStream]);

  return (
    <Card className="flex flex-col justify-between">
      <CardContent className="p-6 flex-grow flex flex-col gap-4">
        {/* Camera Feed */}
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border">
            {/* The video element is now controlled by the parent page's ref */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100" // Flip the video for a mirror effect
            />
        </div>
        
        {/* Transcript */}
        <div>
          <p className="text-muted-foreground mb-2">Your live response:</p>
          <div className="h-32 overflow-y-auto rounded-md border bg-muted/50 p-4">
            {transcript || <span className="text-muted-foreground/70">Press the microphone to begin speaking...</span>}
          </div>
        </div>
      </CardContent>
      <div className="p-6 border-t flex items-center justify-center space-x-4">
        <Button
          size="lg"
          className="rounded-full w-20 h-20"
          onClick={handleMicClick}
          disabled={interviewState === InterviewState.PROCESSING || !isSupported}
          variant={isListening ? "destructive" : "default"}
        >
          {interviewState === InterviewState.PROCESSING ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : isListening ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!transcript || isListening || interviewState === InterviewState.PROCESSING}
        >
          <Send className="mr-2 h-5 w-5" /> Submit
        </Button>
      </div>
    </Card>
  );
}
