/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import StreamingAvatar from '@heygen/streaming-avatar';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface NewSessionData {
  sessionId: string;
}

interface Message {
  [key: string]: unknown;
}

export const useHeyGen = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const avatarRef = useRef<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { accessToken } = useAuth();

  const initializeAvatar = useCallback(async () => {
    if (!accessToken) {
      console.log("HeyGen hook: Waiting for access token...");
      return;
    }

    try {
      // 1. Fetch the temporary session token from our secure backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const tokenResponse = await fetch(`${apiUrl}/api/heygen/token`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({ detail: 'Failed to create HeyGen session.' }));
        throw new Error(errorData.detail);
      }

      const { token: heygenToken } = await tokenResponse.json();
      console.log('✅ HeyGen token received');
      
      // 2. Fetch avatar and voice resources to get available options
      console.log('📋 Fetching HeyGen resources (avatars and voices)...');
      
      let avatarId = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID;
      let voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID;
      
      try {
        const resourcesResponse = await fetch(`${apiUrl}/api/heygen/resources`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (resourcesResponse.ok) {
          const resources = await resourcesResponse.json();
          console.log(`✅ Found ${resources.avatars?.length || 0} avatars and ${resources.voices?.length || 0} voices`);
          
          // If avatar ID not set, use the first available avatar
          if (!avatarId && resources.avatars && resources.avatars.length > 0) {
            avatarId = resources.avatars[0].avatar_id;
            console.log(`🎭 Using first available avatar: ${resources.avatars[0].name} (${avatarId ? avatarId.substring(0, 10) + '...' : 'N/A'})`);
          } else if (avatarId) {
            const avatar = resources.avatars?.find((a: any) => a.avatar_id === avatarId);
            if (avatar) {
              console.log(`✅ Found avatar from env: ${avatar.name} (${avatarId.substring(0, 10)}...)`);
            } else {
              console.warn(`⚠️ Avatar ID from env not found in available avatars, using it anyway: ${avatarId.substring(0, 10)}...`);
            }
          }
          
          // If voice ID not set, use the first available voice
          if (!voiceId && resources.voices && resources.voices.length > 0) {
            voiceId = resources.voices[0].voice_id;
            console.log(`🔊 Using first available voice: ${resources.voices[0].name} (${voiceId ? voiceId.substring(0, 10) + '...' : 'N/A'})`);
          } else if (voiceId) {
            const voice = resources.voices?.find((v: any) => v.voice_id === voiceId);
            if (voice) {
              console.log(`✅ Found voice from env: ${voice.name} (${voiceId.substring(0, 10)}...)`);
            } else {
              console.warn(`⚠️ Voice ID from env not found in available voices, using it anyway: ${voiceId.substring(0, 10)}...`);
            }
          }
        } else {
          console.warn('⚠️ Could not fetch resources, using env vars only');
        }
      } catch (resourcesError) {
        console.error('❌ Error fetching resources:', resourcesError);
        console.warn('⚠️ Using environment variables only');
      }
      
      if (!avatarId) {
        throw new Error("No avatar ID available. Please set NEXT_PUBLIC_HEYGEN_AVATAR_ID in your .env file or ensure your HeyGen API key has access to avatars.");
      }
      
      console.log('🎯 Final avatar ID to use:', avatarId.substring(0, 10) + '...');
      console.log('🎯 Final voice ID to use:', voiceId ? voiceId.substring(0, 10) + '...' : 'Not set');

      // 4. Create the avatar instance with just the token (per SDK documentation)
      console.log('Creating StreamingAvatar instance...');
      const newAvatar = new StreamingAvatar({ 
        token: heygenToken 
      });
      
      console.log('StreamingAvatar created:', newAvatar);
      avatarRef.current = newAvatar;

      // 5. Start the avatar session using createStartAvatar
      // Use avatar_id directly - the SDK accepts avatar IDs as avatarName parameter
      console.log('🚀 Starting avatar session with createStartAvatar...');
      console.log('Using avatar_id:', avatarId.substring(0, 10) + '...');
      console.log('Using quality: high');
      
      const createParams: any = {
        avatarName: avatarId, // SDK accepts avatar ID as avatarName
        quality: 'high',
      };
      
      // Add voice if available
      if (voiceId) {
        createParams.voice = {
          voiceId: voiceId,
        };
        console.log('Using voice_id:', voiceId.substring(0, 10) + '...');
      }
      
      let sessionData;
      try {
        sessionData = await newAvatar.createStartAvatar(createParams);
        console.log('✅ Avatar session started successfully!', sessionData);
        setSessionId(sessionData.session_id);
        setIsConnected(true);
        setDebugInfo(`Session started: ${sessionData.session_id}`);
      } catch (createError: any) {
        console.error('❌ Error creating avatar session:', createError);
        console.error('Error details:', {
          message: createError.message,
          response: createError.response,
          status: createError.status,
          data: createError.data,
        });
        throw new Error(`Failed to start avatar session: ${createError.message || 'Unknown error'}`);
      }
      
      // 6. Set up event handlers using .on() method
      if (typeof newAvatar.on === 'function') {
        console.log('✅ Setting up event handlers with .on() method');
        
        newAvatar.on('message', (message: Message) => {
          console.log('📨 Avatar message:', message);
          setDebugInfo(JSON.stringify(message));
        });
        
        newAvatar.on('connected', (res: NewSessionData) => {
          console.log('🔗 Avatar connected!', res);
          setIsConnected(true);
          setDebugInfo(`Session connected: ${res.sessionId || sessionData.session_id}`);
          
          // Check for mediaStream after connection
          let attempts = 0;
          const maxAttempts = 50;
          const checkMediaStream = () => {
            attempts++;
            const avatar = newAvatar as any;
            const stream = avatar.mediaStream || avatar.stream || (typeof avatar.getMediaStream === 'function' ? avatar.getMediaStream() : null);
            
            if (stream) {
              console.log('📹 MediaStream found!', stream);
              console.log('📹 MediaStream tracks:', stream.getTracks());
              mediaStreamRef.current = stream;
              setStream(stream);
            } else if (attempts < maxAttempts) {
              console.warn(`⚠️ MediaStream not yet available (attempt ${attempts}/${maxAttempts})...`);
              setTimeout(checkMediaStream, 200);
            } else {
              console.error('❌ MediaStream never became available after connection');
              toast.error('Avatar connected but video stream not available.');
            }
          };
          setTimeout(checkMediaStream, 100);
        });
        
        newAvatar.on('error', (err: Error | { message?: string }) => {
          console.error("❌ Avatar error:", err);
          const errorMessage = err instanceof Error ? err.message : (err.message || 'An unknown error occurred');
          toast.error(`Avatar Error: ${errorMessage}`);
          setIsConnected(false);
        });
        
        newAvatar.on('disconnected', () => {
          console.log('🔌 Avatar disconnected');
          setIsConnected(false);
          setSessionId(null);
          setDebugInfo("Session disconnected");
        });
      } else {
        console.warn('⚠️ HeyGen SDK .on() method not found. Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(newAvatar)));
      }

      // 7. Poll for mediaStream periodically (it may become available after session starts)
      const pollForMediaStream = () => {
        const avatar = newAvatar as any;
        const possibleStream = avatar.mediaStream || 
                              avatar.stream || 
                              avatar.videoStream ||
                              (typeof avatar.getMediaStream === 'function' ? avatar.getMediaStream() : null);
        
        if (possibleStream && possibleStream.getTracks && possibleStream.getTracks().length > 0) {
          console.log('📹 MediaStream found via polling!', possibleStream);
          mediaStreamRef.current = possibleStream;
          setStream(possibleStream);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      };

      // Start polling for the media stream
      pollIntervalRef.current = setInterval(pollForMediaStream, 500);

      // Stop polling after 30 seconds
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          console.log('⏹️ Stopped polling for MediaStream after 30 seconds');
        }
      }, 30000);

      // Try to access mediaStream immediately if already available
      const avatar = newAvatar as any;
      const immediateStream = avatar.mediaStream || avatar.stream;
      if (immediateStream && immediateStream.getTracks && immediateStream.getTracks().length > 0) {
        console.log('📹 MediaStream available immediately');
        mediaStreamRef.current = immediateStream;
        setStream(immediateStream);
      } else {
        console.log('⏳ MediaStream not yet available, will poll...');
      }

    } catch (error) {
      console.error("Failed to initialize avatar:", error);
      toast.error(`Avatar Setup Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [accessToken]);

  // Effect to initialize and clean up the avatar connection
  useEffect(() => {
    if (accessToken) {
      initializeAvatar();
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (avatarRef.current && typeof (avatarRef.current as any).disconnect === 'function') {
        (avatarRef.current as any).disconnect();
      }
      avatarRef.current = null;
      setStream(null);
      setIsConnected(false);
    };
  }, [accessToken, initializeAvatar]);

  // Function to make the avatar speak (per SDK documentation)
  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current || !isConnected || !sessionId) {
      console.warn("Cannot speak, avatar is not connected or session not started.");
      return;
    }

    try {
      await avatarRef.current.speak({
        sessionId: sessionId,
        text: text,
        task_type: 'repeat' as any
      });
      console.log('✅ Avatar speak command sent:', text);
    } catch (error) {
      console.error('❌ Error making avatar speak:', error);
      toast.error(`Failed to make avatar speak: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [isConnected, sessionId]);

  return { stream, isConnected, speak, debugInfo };
};

