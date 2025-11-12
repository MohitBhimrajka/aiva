'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InterviewerPanelProps {
  question: string | undefined
  children: ReactNode
}

export function InterviewerPanel({ question, children }: InterviewerPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Interviewer</CardTitle>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
      
      {question && (
        <Card>
          <CardHeader>
            <CardTitle>Question</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{question}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

