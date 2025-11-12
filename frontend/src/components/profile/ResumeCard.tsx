'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileText, Sparkles, Loader2, CheckCircle2, TrendingUp } from 'lucide-react'

interface ResumeCardProps {
  user: {
    raw_resume_text?: string
    resume_score?: number
    resume_analysis?: {
      strengths?: string[]
      improvements?: string[]
    }
  } | null
  isAnalyzing: boolean
  onAnalyze: () => void
  onImprove: () => void
}

export default function ResumeCard({ user, isAnalyzing, onAnalyze, onImprove }: ResumeCardProps) {
  const hasResume = !!user?.raw_resume_text
  const hasAnalysis = !!user?.resume_score

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resume Analysis
            </CardTitle>
            <CardDescription className="mt-1">
              {hasResume
                ? 'View your resume analysis and get improvement suggestions'
                : 'Upload a resume to get started with AI-powered analysis'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasResume ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No resume uploaded yet</p>
            <p className="text-sm text-muted-foreground">
              Upload your resume during onboarding or from your profile settings
            </p>
          </div>
        ) : (
          <>
            {hasAnalysis ? (
              <>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Resume Score</span>
                      <span className="text-2xl font-bold">{user.resume_score}/100</span>
                    </div>
                    <Progress value={user.resume_score} className="h-3" />
                  </div>

                  {user.resume_analysis?.strengths && user.resume_analysis.strengths.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Strengths
                      </p>
                      <ul className="space-y-1">
                        {user.resume_analysis.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {user.resume_analysis?.improvements && user.resume_analysis.improvements.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        Areas for Improvement
                      </p>
                      <ul className="space-y-1">
                        {user.resume_analysis.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button onClick={onAnalyze} disabled={isAnalyzing} variant="outline">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Re-Analyze
                      </>
                    )}
                  </Button>
                  <Button onClick={onImprove}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Improve My Resume
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Resume uploaded but not analyzed yet</p>
                <Button onClick={onAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Resume
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

