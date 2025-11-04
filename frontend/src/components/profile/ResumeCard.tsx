'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, Sparkles, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { ResumeImproverModal } from './resume-improver/ResumeImproverModal'
import { Step3_ResumeUpload } from '@/components/onboarding/Step3_ResumeUpload'

interface ResumeAnalysis {
  score: number;
  analysis: {
    strengths: string[];
    improvements: string[];
  };
  role_matches: unknown[];
}

export function ResumeCard({ resumeSummary }: { resumeSummary?: string | null }) {
  const { accessToken, refreshUser, user } = useAuth()
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showImprover, setShowImprover] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const handleAnalyze = async () => {
    setIsLoading(true)
    setAnalysis(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/profile/analyze-resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setAnalysis(data);
      await refreshUser(); // Refresh user data to get updated role_matches
      toast.success('Resume analysis complete!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze resume.');
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText /> Resume Analysis</CardTitle>
        <CardDescription>Get AI-powered feedback on your uploaded resume to identify strengths and areas for improvement.</CardDescription>
      </CardHeader>
      <CardContent>
        {!resumeSummary ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Upload a resume to get started with AI analysis.</p>
            <Button onClick={() => setShowUploadModal(true)}>Upload Resume</Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Overall Resume Score</h3>
                <span className="font-bold text-xl">{analysis.score}/100</span>
              </div>
              <Progress value={analysis.score} />
            </div>
            <div>
              <h4 className="font-semibold mb-2">Strengths</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {analysis.analysis.strengths.map((item: string, i: number) => <li key={i} className="flex items-start gap-2"><Check className="text-green-500 mt-1 flex-shrink-0" size={16}/> {item}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Areas for Improvement</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {analysis.analysis.improvements.map((item: string, i: number) => <li key={i} className="flex items-start gap-2"><X className="text-red-500 mt-1 flex-shrink-0" size={16}/> {item}</li>)}
              </ul>
            </div>
          </div>
        ) : (
          <Alert variant="default" className="text-center">
            <AlertDescription>Your resume is ready for analysis.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {resumeSummary && (
        <CardFooter className="grid grid-cols-2 gap-2">
          <Button onClick={handleAnalyze} disabled={isLoading} variant="outline">
            {isLoading ? <Loader2 className="animate-spin" /> : <>Re-Analyze</>}
          </Button>
          <Button 
            onClick={() => {
              console.log('Improve button clicked', { analysis: !!analysis, hasRawText: !!user?.raw_resume_text, hasSummary: !!resumeSummary })
              setShowImprover(true)
            }} 
            disabled={!analysis}
          >
            <Sparkles className="mr-2" size={16} /> Improve My Resume
          </Button>
        </CardFooter>
      )}
      {/* --- MODIFICATION: Pass both text fields to the modal --- */}
      {analysis && (
         <ResumeImproverModal 
            isOpen={showImprover}
            onOpenChange={setShowImprover}
            rawResumeText={user?.raw_resume_text || ''} // Pass the full text
            resumeSummary={user?.resume_summary || ''}   // Pass the summary for fallback check
            improvements={analysis.analysis.improvements}
         />
      )}
      {/* Re-use the onboarding resume upload component in a modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
            <Step3_ResumeUpload />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
