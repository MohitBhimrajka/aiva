// frontend/src/components/AnimatedAiva.tsx

'use client'

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { gsap } from 'gsap';
import { AivaAvatar } from './AivaAvatar';

interface SpeechMark {
  timeSeconds: number;
  value: string;
}

interface AnimatedAivaProps {
  audioContent: string | null;
  speechMarks: SpeechMark[];
  isListening: boolean;
  onPlaybackComplete: () => void;
}

// UPDATED: A more comprehensive viseme map for actual Google visemes
const visemeMap: { [key: string]: string } = {
  viseme_sil: '#mouth-sil',
  viseme_p: '#mouth-p', viseme_b: '#mouth-p', viseme_m: '#mouth-p',
  viseme_t: '#mouth-S', viseme_d: '#mouth-S', viseme_n: '#mouth-S',
  viseme_S: '#mouth-S', viseme_sh: '#mouth-S', viseme_ch: '#mouth-S', viseme_j: '#mouth-S', viseme_s: '#mouth-S', viseme_z: '#mouth-S',
  viseme_f: '#mouth-f', viseme_v: '#mouth-f',
  viseme_k: '#mouth-i', viseme_g: '#mouth-i',
  viseme_i: '#mouth-i', viseme_y: '#mouth-i',
  viseme_I: '#mouth-i', viseme_E: '#mouth-i', viseme_e: '#mouth-i',
  viseme_u: '#mouth-u',
  viseme_o: '#mouth-u',
  viseme_a: '#mouth-a',
  viseme_A: '#mouth-a',
  viseme_O: '#mouth-a',
  viseme_r: '#mouth-r', viseme_l: '#mouth-r',
  viseme_w: '#mouth-u',
};

// Smart viseme mapping for backend-generated marks (viseme_0, viseme_1, etc.)
// Creates a varied, natural-looking lip movement pattern
function getMouthShapeForMark(markValue: string, index: number): string {
  // Extract index from mark name (e.g., "viseme_5" -> 5)
  const match = markValue.match(/\d+/);
  const markIndex = match ? parseInt(match[0], 10) : index;
  
  // Create a sophisticated pattern that simulates realistic speech rhythm
  // Pattern designed for: wide-open vowels, closed consonants, smooth transitions
  const patterns = [
    '#mouth-a',    // Wide open (0, 12, 24...) - vowels
    '#mouth-i',    // Mid-open (1, 13, 25...) - transition
    '#mouth-u',    // Rounded (2, 14, 26...) - "o", "u" sounds
    '#mouth-a',    // Wide open (3, 15, 27...) - strong vowels
    '#mouth-i',    // Mid-open (4, 16, 28...) - transition
    '#mouth-sil',  // Closed (5, 17, 29...) - consonants
    '#mouth-S',    // Stretched (6, 18, 30...) - "s", "t" sounds
    '#mouth-r',    // Rounded (7, 19, 31...) - "r", "l" sounds
    '#mouth-a',    // Wide open (8, 20, 32...) - vowels
    '#mouth-u',    // Rounded (9, 21, 33...) - "o", "u"
    '#mouth-i',    // Mid-open (10, 22, 34...) - transition
    '#mouth-f',    // Slight open (11, 23, 35...) - "f", "v"
  ];
  
  // Use pattern cycle with slight variation for natural rhythm
  const patternIndex = (markIndex + Math.floor(markIndex / 7)) % patterns.length;
  return patterns[patternIndex];
}

export function AnimatedAiva({ audioContent, speechMarks, isListening, onPlaybackComplete }: AnimatedAivaProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const avatarRef = useRef<SVGSVGElement | null>(null);
  const timelines = useRef({
    speech: null as gsap.core.Timeline | null,
    idle: null as gsap.core.Timeline | null,
    listening: null as gsap.core.Timeline | null,
  });
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const pendingAudioRef = useRef<{ audio: HTMLAudioElement; timeline: gsap.core.Timeline } | null>(null);

  // useLayoutEffect is preferred for animations to avoid flickers
  useLayoutEffect(() => {
    if (!avatarRef.current) return;

    const head = avatarRef.current.querySelector('#face-group');
    const eyelidL = avatarRef.current.querySelector('#eyelid-left');
    const eyelidR = avatarRef.current.querySelector('#eyelid-right');
    const mouth = avatarRef.current.querySelector('#mouth-live');

    if (!head || !eyelidL || !eyelidR || !mouth) return;

    // --- Create all timelines in a paused state ---

    // 1. Idle Timeline (blinking and head tilt)
    const idleTl = gsap.timeline({ paused: true, repeat: -1 });
    idleTl
      .to(head, {
        rotation: gsap.utils.random(-1, 1.5),
        duration: gsap.utils.random(3, 5),
        transformOrigin: 'center 60%',
        ease: 'power1.inOut',
        yoyo: true,
        repeat: 1,
      })
      .to([eyelidL, eyelidR], {
        scaleY: 0.1, duration: 0.07, transformOrigin: 'center',
        repeat: 1, yoyo: true, repeatDelay: gsap.utils.random(2, 6)
      }, 0); // Start blink at the beginning of the idle timeline
    timelines.current.idle = idleTl;

    // 2. Listening Timeline (gentle nodding)
    const listeningTl = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
    listeningTl.to(head, {
      y: -2,
      rotation: 1,
      duration: 1.5,
      transformOrigin: 'center 60%',
      ease: 'power1.inOut',
    });
    timelines.current.listening = listeningTl;

    // Start in idle state
    idleTl.play();

    // Cleanup function to kill all timelines
    // Capture timeline references at effect scope to avoid stale closure warnings
    return () => {
      gsap.killTweensOf([head, eyelidL, eyelidR, mouth]);
      // Use captured timeline references from this effect's scope
      idleTl?.kill();
      listeningTl?.kill();
      // Note: speech timeline is created in a different effect and handles its own cleanup
    };
  }, []);

  // Effect to handle state changes (speaking, listening, idle)
  useEffect(() => {
    const { speech, idle, listening } = timelines.current;
    
    if (audioContent && speechMarks.length > 0) {
      // --- SPEAKING STATE ---
      idle?.pause();
      listening?.pause();
      
      // Clear any pending audio from previous attempts
      setNeedsUserInteraction(false);
      pendingAudioRef.current = null;

      // Kill any existing speech timeline
      if (speech) {
        speech.kill();
      }

      const mouth = avatarRef.current?.querySelector('#mouth-live');
      if (!mouth || !audioRef.current) return;

      const audio = audioRef.current;
      const audioSrc = `data:audio/mp3;base64,${audioContent}`;
      audio.src = audioSrc;
      audio.currentTime = 0;

      // Reset mouth to silence state before starting
      const mouthSilElement = avatarRef.current?.querySelector('#mouth-sil');
      if (mouthSilElement) {
        const silPath = mouthSilElement.getAttribute('d');
        if (silPath && mouth) {
          gsap.set(mouth, { attr: { d: silPath } });
        }
      }
      
      const speechTl = gsap.timeline({ 
        paused: true,
        onComplete: () => {
          // Reset mouth to silence state
          const mouthSilEl = avatarRef.current?.querySelector('#mouth-sil');
          if (mouthSilEl && mouth) {
            const silPath = mouthSilEl.getAttribute('d');
            if (silPath) {
              gsap.set(mouth, { attr: { d: silPath } });
            }
          }
          onPlaybackComplete();
        }
      });
      timelines.current.speech = speechTl;

      // Add initial mouth shape at the start (time 0) for smooth beginning
      if (speechMarks.length > 0 && speechMarks[0].timeSeconds > 0) {
        const firstMark = speechMarks[0];
        const initialShapeId = visemeMap[firstMark.value] || getMouthShapeForMark(firstMark.value, 0);
        const initialShape = avatarRef.current?.querySelector(initialShapeId);
        if (initialShape) {
          const initialPath = initialShape.getAttribute('d');
          if (initialPath) {
            speechTl.to(mouth, {
              attr: { d: initialPath },
              duration: 0.1,
              ease: "power1.in",
            }, 0);
          }
        }
      }
      
      // Build lip-sync animation from speech marks
      speechMarks.forEach((mark, index) => {
        // Use viseme map if available, otherwise use smart mapping function
        let targetShapeId = visemeMap[mark.value];
        
        // If not in map, use smart mapping for backend-generated marks
        if (!targetShapeId) {
          targetShapeId = getMouthShapeForMark(mark.value, index);
        }
        
        const targetShape = avatarRef.current?.querySelector(targetShapeId);
        
        if (targetShape) {
          const pathData = targetShape.getAttribute('d');
          if (pathData) { // Ensure pathData is not null
            // Calculate duration based on time until next mark (for smoother transitions)
            const nextMark = speechMarks[index + 1];
            const duration = nextMark 
              ? Math.max(0.04, Math.min(0.2, (nextMark.timeSeconds - mark.timeSeconds) * 0.9))
              : 0.1;
            
            speechTl.to(mouth, {
              attr: { d: pathData },
              duration: duration,
              ease: "power1.inOut", // Smooth easing for more natural movement
            }, mark.timeSeconds);
          }
        }
      });
      
      // Ensure mouth closes at the end if there are marks
      if (speechMarks.length > 0) {
        const lastMark = speechMarks[speechMarks.length - 1];
        const endTime = lastMark.timeSeconds + 0.3;
        const mouthSilEl = avatarRef.current?.querySelector('#mouth-sil');
        if (mouthSilEl) {
          const silPath = mouthSilEl.getAttribute('d');
          if (silPath) {
            speechTl.to(mouth, {
              attr: { d: silPath },
              duration: 0.15,
              ease: "power1.in",
            }, endTime);
          }
        }
      }

      // Function to start synchronized playback
      const startPlayback = async () => {
        try {
          // Ensure audio is loaded and ready
          if (audio.readyState < 2) {
            await new Promise((resolve) => {
              audio.addEventListener('canplay', resolve, { once: true });
            });
          }

          // Reset audio to ensure we start from the beginning
          audio.currentTime = 0;
          
          // Start GSAP timeline first
          speechTl.play();
          
          // Try to play audio - catch autoplay restrictions gracefully
          try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              await playPromise;
            }
            
            // Monitor audio completion only if playback succeeded
            audio.addEventListener('ended', () => {
              if (speechTl.isActive()) {
                speechTl.progress(1); // Complete the timeline
              }
            }, { once: true });
            
          } catch (playError: unknown) {
            // Handle autoplay restrictions - this is expected in some browsers
            if (playError && typeof playError === 'object' && 'name' in playError && playError.name === 'NotAllowedError') {
              // Browser blocked autoplay - store audio for later playback on user interaction
              setNeedsUserInteraction(true);
              pendingAudioRef.current = { audio, timeline: speechTl };
              
              // Complete timeline after estimated duration if audio can't play
              const estimatedDuration = speechMarks.length > 0 
                ? speechMarks[speechMarks.length - 1].timeSeconds + 1 
                : 2;
              setTimeout(() => {
                if (speechTl.isActive()) {
                  speechTl.progress(1);
                }
              }, estimatedDuration * 1000);
            } else {
              throw playError; // Re-throw other errors
            }
          }

        } catch (error) {
          // Only log non-autoplay errors
          if (error && typeof error === 'object' && 'name' in error && error.name !== 'NotAllowedError') {
            console.error("Audio playback failed:", error);
          }
          // Don't kill timeline - let it complete so avatar animates
          // onPlaybackComplete will be called by timeline.onComplete
        }
      };

      // Start playback when audio is loaded
      if (audio.readyState >= 2) {
        startPlayback();
      } else {
        audio.addEventListener('canplay', startPlayback, { once: true });
      }

    } else if (isListening) {
      // --- LISTENING STATE ---
      if (speech) speech.pause();
      idle?.pause();
      listening?.play();
    } else {
      // --- IDLE STATE ---
      if (speech) speech.pause();
      listening?.pause();
      idle?.play();
    }

  }, [audioContent, speechMarks, isListening, onPlaybackComplete]);

  // Effect to handle user interaction for pending audio
  useEffect(() => {
    if (!needsUserInteraction || !pendingAudioRef.current) return;

    const handleUserInteraction = async () => {
      const pending = pendingAudioRef.current;
      if (!pending) return;

      try {
        // Reset audio to beginning
        pending.audio.currentTime = 0;
        
        // Restart the timeline from the beginning
        pending.timeline.restart();
        
        // Try to play audio now that user has interacted
        await pending.audio.play();
        
        setNeedsUserInteraction(false);
        pendingAudioRef.current = null;
      } catch {
        // Still failed, that's okay - user interaction may not have been enough
      }
    };

    // Listen for any user interaction
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [needsUserInteraction]);

  return (
    <div className="relative">
      <AivaAvatar ref={avatarRef} />
      <audio ref={audioRef} style={{ display: 'none' }} />
      {needsUserInteraction && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm animate-pulse z-10">
          Click anywhere to play audio
        </div>
      )}
    </div>
  );
}
