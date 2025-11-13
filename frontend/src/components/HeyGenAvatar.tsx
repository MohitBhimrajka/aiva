'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  TaskMode,
} from '@heygen/streaming-avatar';

interface HeyGenAvatarProps {
  accessToken: string; // HeyGen session token from backend
  onAvatarReady: () => void;
  onAvatarSpeaking: (speaking: boolean) => void;
  onError: (error: string) => void;
}

export interface HeyGenAvatarHandle {
  speak: (text: string, taskType?: TaskType) => Promise<void>;
  interrupt: () => Promise<void>;
}

export const HeyGenAvatar = forwardRef<HeyGenAvatarHandle, HeyGenAvatarProps>(
  ({ accessToken, onAvatarReady, onAvatarSpeaking, onError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const avatarRef = useRef<StreamingAvatar | null>(null);
    const [isAvatarReady, setIsAvatarReady] = useState(false);

    useEffect(() => {
      let avatar: StreamingAvatar | null = null;

      async function initializeAvatar() {
        try {
          // Create avatar instance
          avatar = new StreamingAvatar({ token: accessToken });
          avatarRef.current = avatar;

          // Set up event listeners
          avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
            console.log('Avatar started talking');
            onAvatarSpeaking(true);
          });

          avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
            console.log('Avatar stopped talking');
            onAvatarSpeaking(false);
          });

          avatar.on(StreamingEvents.STREAM_READY, (event) => {
            console.log('Stream is ready');
            // Attach video stream when ready
            if (videoRef.current && event && typeof event === 'object' && 'detail' in event) {
              videoRef.current.srcObject = event.detail as MediaStream;
              videoRef.current.play().catch((e) => console.error('Play error:', e));
            }
            setIsAvatarReady(true);
            onAvatarReady();
          });

          avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
            console.log('Stream disconnected');
            setIsAvatarReady(false);
          });

          // Start the avatar session
          await avatar.createStartAvatar({
            quality: AvatarQuality.High,
            avatarName: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || 'default',
            voice: {
              voiceId: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || 'default',
            },
            language: 'en',
            disableIdleTimeout: false,
          });

        } catch (error) {
          console.error('Error initializing HeyGen avatar:', error);
          onError(error instanceof Error ? error.message : 'Failed to initialize avatar');
        }
      }

      if (accessToken) {
        initializeAvatar();
      }

      // Cleanup
      return () => {
        if (avatar) {
          avatar.stopAvatar();
        }
      };
    }, [accessToken, onAvatarReady, onAvatarSpeaking, onError]);

    // Method to speak text (called from parent component)
    const speak = useCallback(async (text: string, taskType: TaskType = TaskType.TALK) => {
      if (!avatarRef.current || !isAvatarReady) {
        console.warn('Avatar not ready to speak');
        return;
      }

      try {
        await avatarRef.current.speak({
          text,
          taskType,
          taskMode: TaskMode.SYNC, // Wait for completion
        });
      } catch (error) {
        console.error('Error speaking:', error);
        onError(error instanceof Error ? error.message : 'Failed to speak');
      }
    }, [isAvatarReady, onError]);

    // Method to interrupt current speech
    const interrupt = useCallback(async () => {
      if (!avatarRef.current || !isAvatarReady) return;
      
      try {
        await avatarRef.current.interrupt();
      } catch (error) {
        console.error('Error interrupting:', error);
      }
    }, [isAvatarReady]);

    // Expose methods via ref for parent access
    useImperativeHandle(ref, () => ({
      speak,
      interrupt,
    }), [speak, interrupt]);

    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {!isAvatarReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-gray-500">Loading avatar...</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

HeyGenAvatar.displayName = 'HeyGenAvatar';
