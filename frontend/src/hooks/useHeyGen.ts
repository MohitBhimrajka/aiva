/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import StreamingAvatar from "@heygen/streaming-avatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NewSessionData {
  sessionId: string;
}

interface Message {
  [key: string]: unknown;
}

export const useHeyGen = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      let avatarId = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || "";
      let voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || "";
      let avatarDisplayName: string | null = null;
      let voiceDisplayName: string | null = null;

      // 1. Fetch avatar and voice resources to determine available interactive options
      console.log("📋 Fetching HeyGen resources (avatars and voices)...");

      try {
        const resourcesResponse = await fetch(
          `${apiUrl}/api/heygen/resources`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (resourcesResponse.ok) {
          const resources = await resourcesResponse.json();
          console.log(
            `✅ Found ${resources.avatars?.length || 0} avatars and ${resources.voices?.length || 0} voices`,
          );

          let selectedAvatar: any = null;
          if (!avatarId && resources.avatars && resources.avatars.length > 0) {
            selectedAvatar = resources.avatars[0];
            avatarId = selectedAvatar.avatar_id;
            console.log(
              `🎭 Using first available avatar: ${selectedAvatar.name} (${avatarId ? avatarId.substring(0, 10) + "..." : "N/A"})`,
            );
          } else if (avatarId) {
            selectedAvatar =
              resources.avatars?.find((a: any) => a.avatar_id === avatarId) ||
              null;
            if (selectedAvatar) {
              console.log(
                `✅ Found avatar from env: ${selectedAvatar.name} (${avatarId.substring(0, 10)}...)`,
              );
            } else {
              console.warn(
                `⚠️ Avatar ID from env not found in available avatars, using it anyway: ${avatarId.substring(0, 10)}...`,
              );
            }
          }

          if (selectedAvatar) {
            avatarDisplayName = selectedAvatar.name || null;
          }

          let selectedVoice: any = null;
          if (!voiceId && resources.voices && resources.voices.length > 0) {
            selectedVoice = resources.voices[0];
            voiceId = selectedVoice.voice_id;
            console.log(
              `🔊 Using first available voice: ${selectedVoice.name} (${voiceId ? voiceId.substring(0, 10) + "..." : "N/A"})`,
            );
          } else if (voiceId) {
            selectedVoice =
              resources.voices?.find((v: any) => v.voice_id === voiceId) ||
              null;
            if (selectedVoice) {
              console.log(
                `✅ Found voice from env: ${selectedVoice.name} (${voiceId.substring(0, 10)}...)`,
              );
            } else {
              console.warn(
                `⚠️ Voice ID from env not found in available voices, using it anyway: ${voiceId.substring(0, 10)}...`,
              );
            }
          }

          if (selectedVoice) {
            voiceDisplayName = selectedVoice.name || null;
          }
        } else {
          console.warn("⚠️ Could not fetch resources, using env vars only");
        }
      } catch (resourcesError) {
        console.error("❌ Error fetching resources:", resourcesError);
        console.warn("⚠️ Using environment variables only");
      }

      if (!avatarId) {
        throw new Error(
          "No avatar ID available. Please configure NEXT_PUBLIC_HEYGEN_AVATAR_ID or ensure your HeyGen API key has access to interactive avatars.",
        );
      }

      console.log(
        "🎯 Final avatar ID to use:",
        avatarId.substring(0, 10) + "...",
      );
      if (avatarDisplayName) {
        console.log("🎯 Avatar display name:", avatarDisplayName);
      }
      console.log(
        "🎯 Final voice ID to use:",
        voiceId ? voiceId.substring(0, 10) + "..." : "Not set",
      );
      if (voiceDisplayName) {
        console.log("🎯 Voice display name:", voiceDisplayName);
      }

      // 2. Request the temporary session token from our secure backend using the chosen avatar/voice
      const tokenPayload: Record<string, string> = { avatar_id: avatarId };
      if (voiceId) {
        tokenPayload.voice_id = voiceId;
      }

      console.log("🔐 Requesting HeyGen streaming token with payload:", {
        avatar_id: tokenPayload.avatar_id.substring(0, 10) + "...",
        voice_id: tokenPayload.voice_id
          ? tokenPayload.voice_id.substring(0, 10) + "..."
          : undefined,
      });

      const tokenResponse = await fetch(`${apiUrl}/api/heygen/token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tokenPayload),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse
          .json()
          .catch(() => ({ detail: "Failed to create HeyGen session." }));
        throw new Error(errorData.detail);
      }

      const { token: heygenToken } = await tokenResponse.json();
      console.log("✅ HeyGen token received");

      // 4. Create the avatar instance with just the token (per SDK documentation)
      console.log("Creating StreamingAvatar instance...");
      const newAvatar = new StreamingAvatar({
        token: heygenToken,
      });

      console.log("StreamingAvatar created:", newAvatar);
      avatarRef.current = newAvatar;

      // 5. Start the avatar session using createStartAvatar
      // Use avatar_id directly - the SDK accepts avatar IDs as avatarName parameter
      console.log("🚀 Starting avatar session with createStartAvatar...");
      console.log("Using avatar_id:", avatarId.substring(0, 10) + "...");
      console.log("Using quality: high");

      const createParams: any = {
        avatarName: avatarDisplayName || avatarId,
        avatarId,
        quality: "high",
      };

      // Add voice if available
      if (voiceId) {
        createParams.voice = {
          voiceId: voiceId,
        };
        console.log("Using voice_id:", voiceId.substring(0, 10) + "...");
      }

      let sessionData;
      try {
        sessionData = await newAvatar.createStartAvatar(createParams);
        console.log("✅ Avatar session started successfully!", sessionData);
        setSessionId(sessionData.session_id);
        setIsConnected(true);
        setDebugInfo(`Session started: ${sessionData.session_id}`);
      } catch (createError: any) {
        console.error("❌ Error creating avatar session:", createError);
        console.error("Error details:", {
          message: createError.message,
          response: createError.response,
          status: createError.status,
          data: createError.data,
        });
        throw new Error(
          `Failed to start avatar session: ${createError.message || "Unknown error"}`,
        );
      }

      // 6. Set up event handlers using .on() method
      if (typeof newAvatar.on === "function") {
        console.log("✅ Setting up event handlers with .on() method");

        newAvatar.on("message", (message: Message) => {
          console.log("📨 Avatar message:", message);
          setDebugInfo(JSON.stringify(message));
        });

        newAvatar.on("connected", (res: NewSessionData) => {
          console.log("🔗 Avatar connected!", res);
          setIsConnected(true);
          setDebugInfo(
            `Session connected: ${res.sessionId || sessionData.session_id}`,
          );

          // Check for mediaStream after connection
          let attempts = 0;
          const maxAttempts = 50;
          const checkMediaStream = () => {
            attempts++;
            const avatar = newAvatar as any;
            const stream =
              avatar.mediaStream ||
              avatar.stream ||
              (typeof avatar.getMediaStream === "function"
                ? avatar.getMediaStream()
                : null);

            if (stream) {
              console.log("📹 MediaStream found!", stream);
              console.log("📹 MediaStream tracks:", stream.getTracks());
              mediaStreamRef.current = stream;
              setStream(stream);
            } else if (attempts < maxAttempts) {
              console.warn(
                `⚠️ MediaStream not yet available (attempt ${attempts}/${maxAttempts})...`,
              );
              setTimeout(checkMediaStream, 200);
            } else {
              console.error(
                "❌ MediaStream never became available after connection",
              );
              toast.error("Avatar connected but video stream not available.");
            }
          };
          setTimeout(checkMediaStream, 100);
        });

        newAvatar.on("error", (err: Error | { message?: string }) => {
          console.error("❌ Avatar error:", err);
          const errorMessage =
            err instanceof Error
              ? err.message
              : err.message || "An unknown error occurred";
          toast.error(`Avatar Error: ${errorMessage}`);
          setIsConnected(false);
        });

        newAvatar.on("disconnected", () => {
          console.log("🔌 Avatar disconnected");
          setIsConnected(false);
          setSessionId(null);
          setDebugInfo("Session disconnected");
        });
      } else {
        console.warn(
          "⚠️ HeyGen SDK .on() method not found. Available methods:",
          Object.getOwnPropertyNames(Object.getPrototypeOf(newAvatar)),
        );
      }

      // 7. Poll for mediaStream periodically (it may become available after session starts)
      const pollForMediaStream = () => {
        const avatar = newAvatar as any;
        const possibleStream =
          avatar.mediaStream ||
          avatar.stream ||
          avatar.videoStream ||
          (typeof avatar.getMediaStream === "function"
            ? avatar.getMediaStream()
            : null);

        if (
          possibleStream &&
          possibleStream.getTracks &&
          possibleStream.getTracks().length > 0
        ) {
          console.log("📹 MediaStream found via polling!", possibleStream);
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
          console.log("⏹️ Stopped polling for MediaStream after 30 seconds");
        }
      }, 30000);

      // Try to access mediaStream immediately if already available
      const avatar = newAvatar as any;
      const immediateStream = avatar.mediaStream || avatar.stream;
      if (
        immediateStream &&
        immediateStream.getTracks &&
        immediateStream.getTracks().length > 0
      ) {
        console.log("📹 MediaStream available immediately");
        mediaStreamRef.current = immediateStream;
        setStream(immediateStream);
      } else {
        console.log("⏳ MediaStream not yet available, will poll...");
      }
    } catch (error) {
      console.error("Failed to initialize avatar:", error);
      toast.error(
        `Avatar Setup Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      if (
        avatarRef.current &&
        typeof (avatarRef.current as any).disconnect === "function"
      ) {
        (avatarRef.current as any).disconnect();
      }
      avatarRef.current = null;
      setStream(null);
      setIsConnected(false);
    };
  }, [accessToken, initializeAvatar]);

  // Function to make the avatar speak (per SDK documentation)
  const speak = useCallback(
    async (text: string) => {
      if (!avatarRef.current || !isConnected || !sessionId) {
        console.warn(
          "Cannot speak, avatar is not connected or session not started.",
        );
        return;
      }

      try {
        await avatarRef.current.speak({
          sessionId: sessionId,
          text: text,
          task_type: "repeat" as any,
        });
        console.log("✅ Avatar speak command sent:", text);
      } catch (error) {
        console.error("❌ Error making avatar speak:", error);
        toast.error(
          `Failed to make avatar speak: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [isConnected, sessionId],
  );

  return { stream, isConnected, speak, debugInfo };
};
