# HeyGen Integration Guide for AIVA

## Overview

This guide explains how to integrate HeyGen's Interactive Avatar into AIVA to replace the current SVG avatar with a realistic, AI-powered video avatar that can speak questions and respond to user interactions.

## Architecture Overview

### Current System
- **Frontend**: `AnimatedAiva.tsx` - SVG avatar with lip-sync animation
- **Backend**: `tts_service.py` - Google Cloud TTS generates audio + speech marks
- **Flow**: Question → TTS → Base64 Audio + Speech Marks → SVG Animation

### With HeyGen Integration
- **Frontend**: HeyGen Streaming API with WebRTC
- **Backend**: Question text → HeyGen API (generates video + audio)
- **Flow**: Question → HeyGen generates avatar video speaking the question → User responds

---

## Integration Options

### **Option 1: Streaming Avatar (Recommended for Push-to-Talk)**
Real-time, low-latency avatar that can interrupt and respond immediately.

**Pros:**
- Real-time interaction
- Low latency (~500-800ms)
- Perfect for push-to-talk
- Natural conversation flow
- Can interrupt mid-speech

**Cons:**
- More complex integration
- Requires WebRTC
- Token-based pricing (more expensive)

### **Option 2: Video Avatar API**
Pre-generated video clips for each question.

**Pros:**
- Simpler integration
- More affordable
- Good video quality

**Cons:**
- Higher latency (5-20 seconds to generate)
- Cannot interrupt
- Not suitable for real-time conversation

---

## Recommended Approach: Streaming Avatar with Push-to-Talk

This is the best fit for your interview application as it allows natural back-and-forth conversation.

---

## Step-by-Step Implementation

### Phase 1: Setup HeyGen Account & Get API Keys

1. **Sign up for HeyGen**
   - Go to https://www.heygen.com/
   - Sign up for an account
   - Navigate to API settings to get your API key

2. **Add HeyGen credentials to `.env`**
   ```bash
   # HeyGen Configuration
   HEYGEN_API_KEY=your_heygen_api_key_here
   HEYGEN_AVATAR_ID=default  # Or your custom avatar ID
   HEYGEN_VOICE_ID=default   # Or your custom voice ID
   ```

---

### Phase 2: Install Frontend Dependencies

```bash
cd frontend
npm install @heygen/streaming-avatar
```

---

### Phase 3: Create HeyGen Avatar Component

Create `frontend/src/components/HeyGenAvatar.tsx`:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  VoiceEmotion,
} from '@heygen/streaming-avatar';

interface HeyGenAvatarProps {
  accessToken: string; // HeyGen session token from backend
  onAvatarReady: () => void;
  onAvatarSpeaking: (speaking: boolean) => void;
  onError: (error: string) => void;
}

export function HeyGenAvatar({
  accessToken,
  onAvatarReady,
  onAvatarSpeaking,
  onError
}: HeyGenAvatarProps) {
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

        avatar.on(StreamingEvents.STREAM_READY, () => {
          console.log('Stream is ready');
          setIsAvatarReady(true);
          onAvatarReady();
        });

        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          console.log('Stream disconnected');
          setIsAvatarReady(false);
        });

        // Start the avatar session
        const res = await avatar.createStartAvatar({
          quality: AvatarQuality.High,
          avatarName: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || 'default',
          voice: {
            voiceId: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || 'default',
          },
          language: 'en',
          disableIdleTimeout: false,
        });

        // Attach video stream to video element
        if (videoRef.current && res.mediaStream) {
          videoRef.current.srcObject = res.mediaStream;
          videoRef.current.play();
        }

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
  const speak = async (text: string, taskType: TaskType = TaskType.TALK) => {
    if (!avatarRef.current || !isAvatarReady) {
      console.warn('Avatar not ready to speak');
      return;
    }

    try {
      await avatarRef.current.speak({
        text,
        taskType,
        taskMode: 'sync', // Wait for completion
      });
    } catch (error) {
      console.error('Error speaking:', error);
      onError(error instanceof Error ? error.message : 'Failed to speak');
    }
  };

  // Method to interrupt current speech
  const interrupt = async () => {
    if (!avatarRef.current || !isAvatarReady) return;
    
    try {
      await avatarRef.current.interrupt();
    } catch (error) {
      console.error('Error interrupting:', error);
    }
  };

  // Expose methods via ref for parent access
  useEffect(() => {
    if (avatarRef.current) {
      // @ts-ignore - extending ref with methods
      avatarRef.current.speak = speak;
      // @ts-ignore
      avatarRef.current.interrupt = interrupt;
    }
  }, [isAvatarReady]);

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
```

---

### Phase 4: Backend - Add HeyGen Token Generation

Create `app/services/heygen_service.py`:

```python
# app/services/heygen_service.py
"""
HeyGen API service for generating streaming avatar tokens and managing avatar sessions.
"""

import logging
import os
import requests
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class HeyGenService:
    """Service for interacting with HeyGen Streaming Avatar API."""
    
    def __init__(self):
        self.api_key = os.getenv("HEYGEN_API_KEY")
        self.base_url = "https://api.heygen.com/v1"
        self.is_available = bool(self.api_key)
        
        if not self.is_available:
            logger.warning("HeyGen API key not configured. Avatar features will be disabled.")
        else:
            logger.info("HeyGen service initialized")
    
    def generate_session_token(self) -> Optional[Dict]:
        """
        Generate a session token for the streaming avatar.
        
        Returns:
            Dictionary with 'token' and 'expires_at' if successful, None otherwise
        """
        if not self.is_available:
            logger.error("HeyGen service not available - missing API key")
            return None
        
        try:
            headers = {
                "X-Api-Key": self.api_key,
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.base_url}/streaming.new",
                headers=headers,
                json={
                    "quality": "high",
                    "avatar_name": os.getenv("HEYGEN_AVATAR_ID", "default"),
                    "voice": {
                        "voice_id": os.getenv("HEYGEN_VOICE_ID", "default")
                    }
                },
                timeout=10
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                "token": data.get("data", {}).get("session_token"),
                "expires_at": data.get("data", {}).get("expires_at"),
                "session_id": data.get("data", {}).get("session_id")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to generate HeyGen session token: {e}")
            return None
    
    def is_operational(self) -> bool:
        """Check if the HeyGen service is operational."""
        return self.is_available


# Singleton instance
_heygen_service_instance: Optional[HeyGenService] = None

def get_heygen_service() -> HeyGenService:
    """Get the singleton HeyGen service instance."""
    global _heygen_service_instance
    if _heygen_service_instance is None:
        _heygen_service_instance = HeyGenService()
    return _heygen_service_instance
```

---

### Phase 5: Backend - Add API Endpoint for Token

Add to `app/routers/interviews.py`:

```python
from app.services import heygen_service

@router.get("/heygen/token")
def get_heygen_token(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generate a HeyGen streaming avatar session token for the current user.
    """
    heygen = heygen_service.get_heygen_service()
    
    if not heygen.is_operational():
        raise HTTPException(
            status_code=503,
            detail="HeyGen service is not available"
        )
    
    token_data = heygen.generate_session_token()
    
    if not token_data:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate HeyGen session token"
        )
    
    return token_data
```

---

### Phase 6: Update Interview Page to Use HeyGen

Modify `frontend/src/app/interview/[sessionId]/page.tsx`:

```typescript
import { HeyGenAvatar } from '@/components/HeyGenAvatar';

export default function InterviewPage() {
  // ... existing state ...
  
  const [heygenToken, setHeygenToken] = useState<string | null>(null);
  const heygenAvatarRef = useRef<any>(null);
  
  // Fetch HeyGen token on mount
  useEffect(() => {
    async function fetchHeyGenToken() {
      if (!accessToken) return;
      
      try {
        const response = await fetch(`${apiUrl}/api/heygen/token`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setHeygenToken(data.token);
        }
      } catch (error) {
        console.error('Failed to fetch HeyGen token:', error);
        toast.error('Failed to initialize avatar');
      }
    }
    
    fetchHeyGenToken();
  }, [accessToken, apiUrl]);
  
  // When question is fetched, make avatar speak it
  useEffect(() => {
    if (question && heygenAvatarRef.current && !isAvatarSpeaking) {
      setIsAvatarSpeaking(true);
      heygenAvatarRef.current.speak(question.content);
    }
  }, [question]);
  
  const handleAvatarSpeaking = (speaking: boolean) => {
    setIsAvatarSpeaking(speaking);
  };
  
  return (
    // ... existing JSX ...
    
    <aside className="w-full md:w-1/3 bg-card border-r border-border p-8 flex flex-col items-center justify-center">
      {heygenToken ? (
        <HeyGenAvatar
          ref={heygenAvatarRef}
          accessToken={heygenToken}
          onAvatarReady={() => console.log('Avatar ready')}
          onAvatarSpeaking={handleAvatarSpeaking}
          onError={(error) => toast.error(error)}
        />
      ) : (
        <div>Loading avatar...</div>
      )}
    </aside>
    
    // ... rest of JSX ...
  );
}
```

---

## Phase 7: Push-to-Talk Integration

Add push-to-talk button to interrupt avatar and start recording:

```typescript
const handlePushToTalk = () => {
  // Interrupt avatar if speaking
  if (isAvatarSpeaking && heygenAvatarRef.current) {
    heygenAvatarRef.current.interrupt();
  }
  
  // Start recording user's voice
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
};

// In JSX:
<button
  onMouseDown={handlePushToTalk}
  onMouseUp={handlePushToTalk}
  onTouchStart={handlePushToTalk}
  onTouchEnd={handlePushToTalk}
  className="..."
>
  <Mic className={isRecording ? "animate-pulse" : ""} />
  {isRecording ? "Release to send" : "Hold to speak"}
</button>
```

---

## Environment Variables Summary

Add to `.env`:

```bash
# HeyGen Configuration
HEYGEN_API_KEY=your_heygen_api_key_here
HEYGEN_AVATAR_ID=default  # Optional: custom avatar ID
HEYGEN_VOICE_ID=default   # Optional: custom voice ID
```

Add to `frontend/.env.local`:

```bash
NEXT_PUBLIC_HEYGEN_AVATAR_ID=default
NEXT_PUBLIC_HEYGEN_VOICE_ID=default
```

---

## Testing Checklist

- [ ] HeyGen API key configured
- [ ] Backend generates session tokens successfully
- [ ] Frontend initializes avatar video stream
- [ ] Avatar speaks questions automatically
- [ ] Push-to-talk interrupts avatar
- [ ] Voice recording works while avatar is idle
- [ ] Avatar returns to idle state after speaking
- [ ] Error handling for token expiration
- [ ] Error handling for network issues

---

## Cost Considerations

### HeyGen Pricing (as of 2024)
- **Streaming Avatar**: ~$0.10-0.20 per minute
- **Video API**: ~$0.05-0.10 per video

### Cost Optimization Tips
1. Reuse session tokens (they're valid for 30 minutes)
2. Implement idle timeout to stop avatar when not in use
3. Use lower quality for development/testing
4. Cache common questions as pre-generated videos

---

## Alternative: Hybrid Approach

Keep Google TTS for audio, use HeyGen for video only:

**Pros:**
- Lower cost (Google TTS is cheaper)
- Faster response time
- Multi-language support via Google

**Cons:**
- Lip-sync might not be perfect
- More complex integration

---

## Troubleshooting

### Avatar not loading
- Check API key is valid
- Verify network connectivity
- Check browser console for WebRTC errors

### Poor video quality
- Increase quality setting in avatar config
- Check network bandwidth
- Try different avatar model

### High latency
- Use streaming avatar instead of video API
- Optimize network connection
- Consider edge deployment

---

## Next Steps

1. **Phase 1**: Set up HeyGen account and get API keys ✅
2. **Phase 2**: Implement basic avatar with text-to-speech
3. **Phase 3**: Add push-to-talk interruption
4. **Phase 4**: Integrate with existing speech recognition
5. **Phase 5**: Add multi-language support
6. **Phase 6**: Optimize performance and costs
7. **Phase 7**: Add emotion and gesture controls

---

## Resources

- [HeyGen Streaming Avatar Docs](https://docs.heygen.com/docs/streaming-avatar)
- [HeyGen API Reference](https://docs.heygen.com/reference)
- [WebRTC Troubleshooting](https://webrtc.github.io/samples/)
- [React Hooks Best Practices](https://react.dev/reference/react)


