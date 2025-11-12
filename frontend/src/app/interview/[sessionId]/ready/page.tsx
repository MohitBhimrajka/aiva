'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMediaStream } from '@/contexts/MediaStreamContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Camera, Mic, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import AnimatedPage from '@/components/AnimatedPage'

export default function ReadyPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const { requestPermissions, isCameraReady, videoStream } = useMediaStream()
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [canStart, setCanStart] = useState(false)

  useEffect(() => {
    // Check if permissions are already granted
    if (isCameraReady && videoStream) {
      setIsInitializing(true)
      // Give MediaPipe a moment to initialize
      const timer = setTimeout(() => {
        setIsInitializing(false)
        setCanStart(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isCameraReady, videoStream])

  const handleRequestPermissions = async () => {
    setIsRequestingPermissions(true)
    try {
      const granted = await requestPermissions()
      if (!granted) {
        toast.error('Camera permission denied. Please enable camera access in your browser settings.')
      } else {
        toast.success('Camera access granted!')
      }
    } catch (error) {
      console.error('Error requesting permissions:', error)
      toast.error('Failed to request camera permission.')
    } finally {
      setIsRequestingPermissions(false)
    }
  }

  const handleBeginInterview = () => {
    if (canStart) {
      router.push(`/interview/${sessionId}`)
    }
  }

  return (
    <AnimatedPage>
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Get Ready for Your Interview</CardTitle>
            <CardDescription>
              We need access to your camera to analyze your performance during the interview.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Permission Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Camera Access</p>
                    <p className="text-sm text-muted-foreground">
                      Required for posture and eye contact analysis
                    </p>
                  </div>
                </div>
                {isCameraReady ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mic className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Microphone Access</p>
                    <p className="text-sm text-muted-foreground">
                      Will be requested when you start recording
                    </p>
                  </div>
                </div>
                <div className="h-5 w-5" /> {/* Spacer */}
              </div>
            </div>

            {/* Action Buttons */}
            {!isCameraReady ? (
              <Button
                onClick={handleRequestPermissions}
                disabled={isRequestingPermissions}
                className="w-full"
                size="lg"
              >
                {isRequestingPermissions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting Permissions...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Grant Camera Permission
                  </>
                )}
              </Button>
            ) : isInitializing ? (
              <div className="flex flex-col items-center gap-2 p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Initializing analyzers...
                </p>
              </div>
            ) : (
              <Button
                onClick={handleBeginInterview}
                disabled={!canStart}
                className="w-full"
                size="lg"
              >
                Begin Interview
              </Button>
            )}

            {/* Info Note */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Your video feed is processed locally in your browser. No video
                data is sent to our servers. Only analysis metrics are recorded.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}

