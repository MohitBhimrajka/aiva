'use client'

import { RefObject } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, MicOff } from 'lucide-react'

interface UserResponsePanelProps {
  transcript: string
  textInput: string
  setTextInput: (value: string) => void
  interviewState: 'loading' | 'in-progress' | 'completed'
  isListening: boolean
  isSupported: boolean
  handleMicClick: () => void
  handleSubmit: () => void
  videoRef: RefObject<HTMLVideoElement>
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
  videoRef,
}: UserResponsePanelProps) {
  // Combine transcript and manual text input
  const combinedText = transcript.trim() 
    ? (transcript.trim() + (textInput.trim() ? ' ' + textInput.trim() : ''))
    : textInput.trim()

  return (
    <div className="space-y-4">
      {/* User Video Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Your Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </CardContent>
      </Card>

      {/* Answer Input */}
      <Card>
        <CardHeader>
          <CardTitle>Your Answer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type or record your answer here..."
            value={combinedText}
            onChange={(e) => {
              // When user types, update textInput and clear transcript if needed
              const newValue = e.target.value
              // If the new value doesn't start with transcript, user is editing
              if (!newValue.startsWith(transcript.trim())) {
                setTextInput(newValue)
              } else {
                // User is typing after transcript
                setTextInput(newValue.slice(transcript.trim().length).trim())
              }
            }}
            rows={8}
            className="text-base"
            disabled={interviewState !== 'in-progress'}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleMicClick}
              variant={isListening ? 'destructive' : 'outline'}
              disabled={!isSupported || interviewState !== 'in-progress'}
              className="flex-1"
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
              onClick={handleSubmit}
              disabled={!combinedText.trim() || interviewState !== 'in-progress'}
              className="flex-1"
            >
              Submit Answer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

