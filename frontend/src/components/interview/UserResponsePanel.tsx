'use client'

import React, { useEffect } from 'react'
import { Mic, MicOff, Loader2, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InterviewState } from '@/hooks/useInterviewManager'
import { useMediaStream } from '@/contexts/MediaStreamContext'

interface UserResponsePanelProps {
  transcript: string;
  textInput: string;
  setTextInput: (value: string) => void;
  interviewState: InterviewState;
  isListening: boolean;
  isSupported: boolean;
  handleMicClick: () => void;
  handleSubmit: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; // Accept the ref from the parent
}

export function UserResponsePanel({
  transcript,
  textInput,
  setTextInput,
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
        
        {/* Speech Transcript */}
        {transcript && (
          <div>
            <p className="text-muted-foreground mb-2 text-sm">Speech recognition:</p>
            <div className="h-24 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm">
              {transcript}
            </div>
          </div>
        )}
        
        {/* Text Input */}
        <div>
          <p className="text-muted-foreground mb-2">
            {transcript ? "Type additional response (optional):" : "Type your response:"}
          </p>
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={transcript ? "Add to your spoken response..." : "Type your answer here or use the microphone to speak..."}
            className="min-h-32 resize-none"
            disabled={interviewState === InterviewState.PROCESSING}
          />
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
          disabled={(!transcript && !textInput.trim()) || isListening || interviewState === InterviewState.PROCESSING}
        >
          <Send className="mr-2 h-5 w-5" /> Submit
        </Button>
      </div>
    </Card>
  );
}
