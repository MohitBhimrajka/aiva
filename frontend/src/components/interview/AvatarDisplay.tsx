'use client'

import { useEffect, useRef } from 'react'

interface AvatarDisplayProps {
  stream: MediaStream | null
}

export function AvatarDisplay({ stream }: AvatarDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch((error) => {
        console.error('Error playing avatar video:', error)
      })
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [stream])

  if (!stream) {
    return (
      <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">Avatar loading...</p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
    </div>
  )
}

