'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface FeedbackHUDProps {
  wpm: number
  fillerCount: number
  vocalConfidence: number // 0-1 score
  postureScore: number // 0-100
  opennessScore: number // 0-100
}

export function FeedbackHUD({
  wpm,
  fillerCount,
  vocalConfidence,
  postureScore,
  opennessScore,
}: FeedbackHUDProps) {
  const getScoreColor = (score: number, max: number = 100) => {
    const percentage = (score / max) * 100
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number, max: number = 100) => {
    const percentage = (score / max) * 100
    if (percentage >= 70) return <TrendingUp className="h-4 w-4" />
    if (percentage >= 40) return <Minus className="h-4 w-4" />
    return <TrendingDown className="h-4 w-4" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 space-y-3 min-w-[280px]"
    >
      <h3 className="text-sm font-semibold mb-2">Live Feedback</h3>

      {/* WPM */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Speaking Pace</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{wpm} WPM</span>
          {wpm > 180 ? (
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          ) : wpm < 120 ? (
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          ) : (
            <Minus className="h-4 w-4 text-green-600" />
          )}
        </div>
      </div>

      {/* Filler Words */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Filler Words</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${fillerCount > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
            {fillerCount}
          </span>
        </div>
      </div>

      {/* Vocal Confidence */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Vocal Confidence</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${getScoreColor(vocalConfidence * 100)}`}>
            {Math.round(vocalConfidence * 100)}%
          </span>
          {getScoreIcon(vocalConfidence * 100)}
        </div>
      </div>

      {/* Posture Score */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Posture</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${getScoreColor(postureScore)}`}>
            {Math.round(postureScore)}%
          </span>
          {getScoreIcon(postureScore)}
        </div>
      </div>

      {/* Openness Score */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Engagement</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${getScoreColor(opennessScore)}`}>
            {Math.round(opennessScore)}%
          </span>
          {getScoreIcon(opennessScore)}
        </div>
      </div>
    </motion.div>
  )
}

