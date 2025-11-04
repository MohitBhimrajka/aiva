'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { motion, AnimatePresence } from 'framer-motion'
import { Gauge, Mic, Waves, PersonStanding, Heart } from 'lucide-react'

interface FeedbackHUDProps {
    wpm: number;
    fillerCount: number;
    vocalConfidence: number;
    postureScore: number;
    opennessScore: number;
}

const getPaceColor = (wpm: number) => {
    if (wpm > 170) return "bg-yellow-500"; // Too fast
    if (wpm < 130) return "bg-blue-500"; // Too slow
    return "bg-green-500";
}

export function FeedbackHUD({ wpm, fillerCount, vocalConfidence, postureScore, opennessScore }: FeedbackHUDProps) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 right-4 z-50"
            >
                <Card className="w-64 p-3 bg-background/80 backdrop-blur-sm shadow-xl">
                    <div className="space-y-3">
                        {/* Speaking Pace */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Gauge size={14}/> Pace</span>
                                <span className="font-bold">{wpm} WPM</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all ${getPaceColor(wpm)}`}
                                    style={{ width: `${Math.min(100, (wpm / 250) * 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Filler Words */}
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Mic size={14}/> Filler Words</span>
                            <span className="font-bold text-lg">{fillerCount}</span>
                        </div>

                        {/* Vocal Confidence */}
                        <div className="space-y-1">
                             <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Waves size={14}/> Vocal Confidence</span>
                                <span className="font-bold">{(vocalConfidence * 100).toFixed(0)}%</span>
                            </div>
                             <Progress value={vocalConfidence * 100} className="h-2" />
                        </div>

                        {/* Posture Stability */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><PersonStanding size={14}/> Posture</span>
                                <span className="font-bold">{postureScore.toFixed(0)}%</span>
                            </div>
                            <Progress value={postureScore} className="h-2" />
                        </div>

                        {/* Openness Score */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Heart size={14}/> Openness</span>
                                <span className="font-bold">{opennessScore.toFixed(0)}%</span>
                            </div>
                            <Progress value={opennessScore} className="h-2" />
                        </div>
                    </div>
                </Card>
            </motion.div>
        </AnimatePresence>
    )
}

