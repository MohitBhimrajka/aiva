'use client'

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMediaStream } from '@/contexts/MediaStreamContext';
import { Loader2, CheckCircle2, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import AnimatedPage from '@/components/AnimatedPage';

function ChecklistItem({ label, isReady }: { label: string, isReady: boolean }) {
    return ( <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-lg">
            {isReady ? <CheckCircle2 className="text-green-500" /> : <Loader2 className="animate-spin text-muted-foreground" />}
            <span className={isReady ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </motion.li> )
}

export default function ReadyPage() {
    const router = useRouter();
    const { sessionId } = useParams();
    const { videoStream, isCameraReady, isMicReady, areAnalyzersReady, requestPermissions } = useMediaStream();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [permissionState, setPermissionState] = useState<'idle' | 'pending' | 'denied'>('idle');

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    const handleRequestPermissions = async () => {
        setPermissionState('pending');
        await requestPermissions();
        // The context will update isCameraReady/isMicReady, which will update the UI
        // We need to check the result here to know if it was denied
        setTimeout(() => { // Give browser time to update state
             navigator.mediaDevices.enumerateDevices().then(devices => {
                const hasVideo = devices.some(d => d.kind === 'videoinput' && d.label);
                const hasAudio = devices.some(d => d.kind === 'audioinput' && d.label);
                if (!hasVideo || !hasAudio) {
                    setPermissionState('denied');
                }
            });
        }, 1000);
    }
    
    // Auto-request on first load
    useEffect(() => {
        handleRequestPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Temporarily bypass avatar requirement for testing
    const allReady = isCameraReady && isMicReady && areAnalyzersReady;

    return (
        <AnimatedPage>
            <main className="container mx-auto flex h-screen flex-col items-center justify-center p-4">
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Interview Setup</CardTitle>
                            <CardDescription>Let&apos;s make sure everything is ready for your session.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ul className="space-y-4">
                                <ChecklistItem label="Camera Ready" isReady={isCameraReady} />
                                <ChecklistItem label="Microphone Ready" isReady={isMicReady} />
                                {areAnalyzersReady && <>
                                    <ChecklistItem label="Facial Analyzer Initialized" isReady={true} />
                                    <ChecklistItem label="Posture Analyzer Initialized" isReady={true} />
                                </>}
                            </ul>
                            <div className="p-4 border rounded-lg bg-muted/30">
                                <h4 className="font-semibold mb-2">Privacy Guarantee</h4>
                                <p className="text-sm text-muted-foreground">Your video is processed **live in your browser** and is **never** sent to our servers.</p>
                            </div>
                            <Button size="lg" className="w-full" disabled={!allReady} onClick={() => router.push(`/interview/${sessionId}`)}>
                                Begin Interview
                            </Button>
                        </CardContent>
                    </Card>
                    <div className="flex flex-col items-center justify-center border rounded-lg p-4 bg-black overflow-hidden">
                        <div className="w-full h-full relative">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain rounded-md" />
                            {!videoStream && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white bg-black">
                                    {permissionState === 'pending' && <><Loader2 className="animate-spin h-8 w-8 mb-4"/> <p>Waiting for camera and microphone access...</p><p className="text-sm text-gray-400">Please check your browser permissions prompt.</p></>}
                                    {permissionState === 'denied' && <><VideoOff className="h-8 w-8 mb-4 text-red-500"/> <p>Access Denied</p><p className="text-sm text-gray-400">Please allow camera/mic access in your browser&apos;s site settings and refresh the page.</p></>}
                                    {permissionState === 'idle' && <Button onClick={handleRequestPermissions}>Enable Devices</Button>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </AnimatedPage>
    );
}
