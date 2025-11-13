// frontend/src/app/interview/[sessionId]/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Room, RoomEvent, VideoPresets } from 'livekit-client'
import { toast } from "sonner"
import { Loader2, PhoneOff, Send } from 'lucide-react'

// Main component
export default function InterviewPage() {
    const { sessionId } = useParams()
    const { accessToken } = useAuth()
    const router = useRouter()

    // DOM Elements
    const mediaElementRef = useRef<HTMLVideoElement>(null)

    // State
    const [statusLog, setStatusLog] = useState<string[]>([])
    const [taskInput, setTaskInput] = useState('')
    const [isSessionActive, setIsSessionActive] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Refs for session management
    const roomRef = useRef<Room | null>(null)
    const webSocketRef = useRef<WebSocket | null>(null)

    // Helper to update status log
    const updateStatus = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setStatusLog(prev => [...prev, `[${timestamp}] ${message}`])
    }, [])

    // Close session function
    const closeSession = useCallback(async () => {
        updateStatus("Closing session...")
        if (!sessionId || !accessToken) return;

        // Backend call to stop HeyGen session
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            await fetch(`${apiUrl}/api/sessions/${sessionId}/avatar/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            })
        } catch (error) {
            console.error("Failed to stop session on backend:", error)
        }

        // Frontend cleanup
        webSocketRef.current?.close()
        await roomRef.current?.disconnect()
        
        if (mediaElementRef.current) {
            mediaElementRef.current.srcObject = null
        }

        roomRef.current = null
        webSocketRef.current = null
        setIsSessionActive(false)
        updateStatus("Session closed")
        toast.info("Interview session ended.")
        router.push('/dashboard')

    }, [sessionId, accessToken, updateStatus, router])



    // Start session function
    const startSession = useCallback(async () => {
        if (!sessionId || !accessToken) {
            toast.error("Session ID or authentication token is missing.")
            return
        }
        setIsLoading(true)
        updateStatus("Initializing interview session...")

        try {
            // 1. Initialize session on our backend
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const initResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/avatar/initialize`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            })
            if (!initResponse.ok) {
                const errorData = await initResponse.json()
                throw new Error(errorData.detail || 'Failed to initialize session.')
            }
            const sessionInfo = await initResponse.json()
            updateStatus("Session details obtained from backend.")

            // 2. Setup LiveKit Room
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
            })
            roomRef.current = room

            const mediaStream = new MediaStream()
            room.on(RoomEvent.TrackSubscribed, (track) => {
                if (track.kind === "video" || track.kind === "audio") {
                    mediaStream.addTrack(track.mediaStreamTrack)
                    if (mediaStream.getVideoTracks().length > 0 && mediaStream.getAudioTracks().length > 0) {
                        if (mediaElementRef.current) mediaElementRef.current.srcObject = mediaStream
                        updateStatus("Media stream ready")
                    }
                }
            })
            
            room.on(RoomEvent.Disconnected, (reason) => {
                updateStatus(`Room disconnected: ${reason}`)
                closeSession()
            })

            await room.prepareConnection(sessionInfo.lk_url, sessionInfo.lk_token)
            updateStatus("Connection prepared")
            
            // 3. Connect WebSocket
            const ws = new WebSocket(sessionInfo.ws_url)
            webSocketRef.current = ws
            ws.onopen = () => updateStatus("WebSocket connected")
            ws.onmessage = (event) => {
                const eventData = JSON.parse(event.data)
                console.log("Raw WebSocket event:", eventData)
                // Here you would handle incoming data, like transcription
            }
            ws.onerror = () => updateStatus("WebSocket error")
            ws.onclose = () => updateStatus("WebSocket closed")
            
            // 4. Start the streaming on HeyGen's side
            const startResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/avatar/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            })
            if (!startResponse.ok) throw new Error('Failed to start streaming.')

            // 5. Connect to the LiveKit room
            await room.connect(sessionInfo.lk_url, sessionInfo.lk_token)
            updateStatus("Connected to room. Streaming started!")
            setIsSessionActive(true)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
            updateStatus(`Error: ${errorMessage}`)
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }, [sessionId, accessToken, updateStatus, closeSession])
    
    // Send text to avatar
    const sendText = async (text: string, taskType = "talk") => {
        if (!isSessionActive || !text) return

        updateStatus(`Sending text (${taskType}): ${text}`)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/avatar/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ text, task_type: taskType }),
            })
            if (!response.ok) throw new Error('Failed to send task.')
            setTaskInput('')
        } catch {
            toast.error("Failed to send text to avatar.")
        }
    }

    // Effect to start the session on component mount
    useEffect(() => {
        startSession()
        // Cleanup on unmount
        return () => {
            closeSession()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty dependency array ensures this runs only once on mount

    return (
        <div className="bg-gray-900 text-white min-h-screen p-5 font-sans flex items-center justify-center">
            <div className="w-full max-w-4xl bg-gray-800 p-5 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold mb-4">AIVA Interview Session</h1>

                {/* Video Player */}
                <div className="relative bg-black rounded-lg mb-4">
                    <video
                        ref={mediaElementRef}
                        className="w-full h-auto max-h-[500px] rounded-lg"
                        autoPlay
                        playsInline
                    ></video>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                            <Loader2 className="h-12 w-12 animate-spin" />
                            <p className="ml-4">Initializing Session...</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-4 mb-4">
                    <input
                        id="taskInput"
                        type="text"
                        value={taskInput}
                        onChange={(e) => setTaskInput(e.target.value)}
                        placeholder="Type a message to AIVA..."
                        className="flex-1 min-w-[200px] p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        disabled={!isSessionActive}
                    />
                    <button
                        onClick={() => sendText(taskInput)}
                        className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        disabled={!isSessionActive || !taskInput}
                    >
                        <Send size={18} /> Send
                    </button>
                    <button
                        onClick={closeSession}
                        className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                       <PhoneOff size={18} /> End Session
                    </button>
                </div>

                {/* Status Log */}
                <div className="bg-gray-900 border border-gray-700 rounded-md h-[150px] overflow-y-auto font-mono text-sm p-2.5">
                    {statusLog.map((log, index) => (
                        <p key={index}>{log}</p>
                    ))}
                </div>
            </div>
        </div>
    )
}
