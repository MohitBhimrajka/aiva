'use client'

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface AnalysisMetrics {
    eyeContactPercentage: number;
    postureScore: number;
    opennessScore: number;
}

interface MediaStreamContextType {
    videoStream: MediaStream | null;
    isCameraReady: boolean;
    isMicReady: boolean;
    areAnalyzersReady: boolean;
    requestPermissions: () => Promise<void>;
    metrics: AnalysisMetrics;
    startAnalysis: (videoElement: HTMLVideoElement) => void;
    stopAnalysis: () => void;
}

const MediaStreamContext = createContext<MediaStreamContextType | undefined>(undefined);

let faceLandmarker: FaceLandmarker;
let poseLandmarker: PoseLandmarker;
let lastVideoTime = -1;
let animationFrameId: number = 0;

export function MediaStreamProvider({ children }: { children: ReactNode }) {
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isMicReady, setIsMicReady] = useState(false);
    const [areAnalyzersReady, setAreAnalyzersReady] = useState(false);
    const [metrics, setMetrics] = useState<AnalysisMetrics>({ eyeContactPercentage: 0, postureScore: 100, opennessScore: 100 });
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const createAnalyzers = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
                faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: `/face_landmarker.task`, delegate: "GPU" },
                    runningMode: "VIDEO", numFaces: 1
                });
                poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: `/pose_landmarker_lite.task`, delegate: "GPU" },
                    runningMode: "VIDEO", numPoses: 1
                });
                setAreAnalyzersReady(true);
            } catch (error) {
                console.error("Failed to create MediaPipe analyzers:", error);
            }
        };
        createAnalyzers();
    }, []);

    const requestPermissions = useCallback(async () => {
        try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error("Media devices API not available in this browser.");
                return;
            }

            // Request both video and audio
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Check if stream has video and audio tracks
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            
            setVideoStream(stream);
            setIsCameraReady(videoTracks.length > 0);
            setIsMicReady(audioTracks.length > 0);
            
            // Log track info for debugging
            if (videoTracks.length > 0) {
                console.log("Camera ready:", videoTracks[0].label);
            }
            if (audioTracks.length > 0) {
                console.log("Microphone ready:", audioTracks[0].label);
            }
        } catch (error) {
            console.error("Error accessing media devices:", error);
            // Reset states on error
            setIsCameraReady(false);
            setIsMicReady(false);
            setVideoStream(null);
            
            // Provide user-friendly error message
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    alert("Camera and microphone access was denied. Please allow access in your browser settings and try again.");
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    alert("No camera or microphone found. Please connect a device and try again.");
                } else {
                    alert(`Error accessing camera/microphone: ${error.message}`);
                }
            }
        }
    }, []);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !areAnalyzersReady || videoRef.current.paused || videoRef.current.ended) {
            animationFrameId = requestAnimationFrame(predictWebcam);
            return;
        }

        const video = videoRef.current;
        if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const now = Date.now();
            const faceResults = faceLandmarker.detectForVideo(video, now);
            const poseResults = poseLandmarker.detectForVideo(video, now);

            let newEyeContact = 0, newPosture = 100, newOpenness = 100;

            if (faceResults.faceLandmarks?.[0]) {
                const landmarks = faceResults.faceLandmarks[0];
                const leftPupil = landmarks[473], rightPupil = landmarks[468];
                if (leftPupil && rightPupil && leftPupil.z < 0.01 && rightPupil.z < 0.01) {
                    newEyeContact = 100;
                }
            }

            if (poseResults.landmarks?.[0]) {
                const landmarks = poseResults.landmarks[0];
                const [nose, leftShoulder, rightShoulder, leftWrist, rightWrist] = [landmarks[0], landmarks[11], landmarks[12], landmarks[15], landmarks[16]];

                if (leftShoulder.visibility > 0.8 && rightShoulder.visibility > 0.8) {
                    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
                    newPosture = nose.y > shoulderY + 0.05 ? 0 : 100; // Slouch detection
                }

                if (leftWrist.visibility > 0.5 && rightWrist.visibility > 0.5) {
                    const bodyMidlineX = (leftShoulder.x + rightShoulder.x) / 2;
                    if ((leftWrist.x > bodyMidlineX && rightWrist.x < bodyMidlineX)) {
                        newOpenness = 0; // Arms crossed detection
                    }
                }
            }
            
            setMetrics(prev => ({
                eyeContactPercentage: (prev.eyeContactPercentage * 0.9) + (newEyeContact * 0.1),
                postureScore: (prev.postureScore * 0.9) + (newPosture * 0.1),
                opennessScore: (prev.opennessScore * 0.9) + (newOpenness * 0.1),
            }));
        }
        animationFrameId = requestAnimationFrame(predictWebcam);
    }, [areAnalyzersReady]);

    const startAnalysis = useCallback((videoElement: HTMLVideoElement) => {
        if (videoStream && animationFrameId === 0) {
            videoRef.current = videoElement;
            predictWebcam();
        }
    }, [videoStream, predictWebcam]);

    const stopAnalysis = useCallback(() => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
            videoRef.current = null;
        }
    }, []);

    return (
        <MediaStreamContext.Provider value={{ videoStream, isCameraReady, isMicReady, areAnalyzersReady, requestPermissions, metrics, startAnalysis, stopAnalysis }}>
            {children}
        </MediaStreamContext.Provider>
    );
}

export const useMediaStream = () => {
    const context = useContext(MediaStreamContext);
    if (!context) throw new Error('useMediaStream must be used within a MediaStreamProvider');
    return context;
};
