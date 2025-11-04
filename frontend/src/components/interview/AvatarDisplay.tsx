'use client';

import { useEffect, useRef, useState } from 'react';

interface AvatarDisplayProps {
  stream: MediaStream | null;
}

export function AvatarDisplay({ stream }: AvatarDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('🎥 Setting video stream:', stream);
      console.log('🎥 Stream tracks:', stream.getTracks());
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('✅ Video metadata loaded');
        setIsVideoReady(true);
      };

      videoRef.current.oncanplay = () => {
        console.log('✅ Video can play');
      };

      videoRef.current.play().then(() => {
        console.log('✅ Video playing successfully');
        setIsVideoReady(true);
      }).catch(error => {
        console.error("❌ Video play failed:", error);
        // This can happen if the user hasn't interacted with the page yet.
      });
    } else if (!stream) {
      console.log('⏳ Waiting for stream...');
      setIsVideoReady(false);
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <div className="text-center">
          <div className="animate-pulse text-gray-500">Connecting to avatar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black rounded-full overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {!isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white animate-pulse">Loading avatar...</div>
        </div>
      )}
    </div>
  );
}

