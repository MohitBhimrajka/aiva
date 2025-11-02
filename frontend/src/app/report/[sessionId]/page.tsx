// frontend/src/app/report/[sessionId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Badge } from "@/components/ui/badge"
import { AnimatedCounter } from '@/components/AnimatedCounter'
import AnimatedPage from '@/components/AnimatedPage'
import { ScoreBarChart } from '@/components/ReportCharts';
import { OverallAnalysis } from '@/components/OverallAnalysis';
import { Clock, Mic } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton'

// --- UPDATED INTERFACES ---
interface ReportQuestion { content: string }
interface ReportAnswer {
  answer_text: string;
  ai_feedback: string;
  ai_score: number;
  speaking_pace_wpm: number | null;
  filler_word_count: number | null;
  question: ReportQuestion;
}
interface ReportRole { name: string; category: string }
interface ReportSession {
  id: number; difficulty: string; status: string; role: ReportRole;
}
interface FullReport {
  session: ReportSession;
  answers: ReportAnswer[];
}

interface AnalysisData {
  summary: string;
  strengths: string[];
  areas_for_improvement: string[];
}

const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
  if (score >= 8) return "default";
  if (score >= 5) return "secondary";
  return "destructive";
};

// --- NEW LOADING SKELETON FOR THE WHOLE PAGE ---
const ReportSkeleton = () => (
    <div className="space-y-8">
        <div className="space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
        </div>
        <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
        <Skeleton className="h-8 w-1/3" />
        <Card><CardContent className="p-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
    </div>
)

export default function ReportPage() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const [report, setReport] = useState<FullReport | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)
  
  const averageScore = report ? report.answers.reduce((acc, ans) => acc + ans.ai_score, 0) / (report.answers.length || 1) : 0;
  
  useEffect(() => {
    if (!accessToken || !sessionId) return;
    
    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      try {
        // --- Fetch initial report ---
        const reportResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/report`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!reportResponse.ok) throw new Error('Failed to fetch interview report.');
        const reportData: FullReport = await reportResponse.json();
        setReport(reportData);
        setIsLoading(false);
        // --- Now, fetch the AI summary ---
        setIsAnalysisLoading(true);
        const summaryResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}/summary`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if(summaryResponse.ok){
            setAnalysis(await summaryResponse.json());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      } finally {
        setIsAnalysisLoading(false);
      }
    };
    fetchReportData();
  }, [accessToken, sessionId]);

  if (isLoading) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="max-w-4xl w-full p-8"><ReportSkeleton /></div>
        </div>
    );
  }

  if (error) return <div className="max-w-4xl mx-auto p-8 text-red-500">Error: {error}</div>

  if (!report) return <div className="max-w-4xl mx-auto p-8">No report data found.</div>

  return (
    <AnimatedPage>
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-gray-900">AIVA Interview Report</h1>
                    <p className="text-muted-foreground">
                    Performance summary for the {report.session.role.name} ({report.session.difficulty}) role.
                    </p>
                </header>
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="text-4xl font-bold"><AnimatedCounter from={0} to={averageScore} /></div>
                            <span className="text-xl text-muted-foreground">/ 10</span>
                            <Badge variant={getScoreBadgeVariant(averageScore)} className="text-base">
                                {averageScore >= 8 ? "Excellent" : averageScore >= 5 ? "Good" : "Needs Improvement"}
                            </Badge>
                        </div>
                        <ScoreBarChart answers={report.answers} />
                    </CardContent>
                </Card>
                
                <div>
                    <h2 className="text-2xl font-bold mb-4">Detailed Feedback</h2>
                    <Accordion type="single" collapsible className="w-full bg-white rounded-lg shadow-sm">
                        {report.answers.map((answer, index) => (
                          <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger className="text-left hover:no-underline px-6 py-4">
                                <div className="flex-1 flex items-center gap-4">
                                    <span className="text-primary font-bold">{`Q${index + 1}`}</span>
                                    <span className="font-medium text-gray-800 flex-1">{answer.question.content}</span>
                                </div>
                                <Badge variant={getScoreBadgeVariant(answer.ai_score)} className="ml-4">
                                    Score: {answer.ai_score}/10
                                </Badge>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-2 space-y-6">
                                {(answer.speaking_pace_wpm !== null && answer.filler_word_count !== null) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
                                      <div className="flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /><p><span className="font-bold text-lg">{answer.speaking_pace_wpm}</span> WPM</p></div>
                                      <div className="flex items-center gap-3"><Mic className="h-6 w-6 text-primary" /><p><span className="font-bold text-lg">{answer.filler_word_count}</span> Filler Words</p></div>
                                  </div>
                                )}
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Your Answer:</h4>
                                    <blockquote className="border-l-4 pl-4 text-gray-600 bg-gray-50 p-3 rounded-r-md">{answer.answer_text}</blockquote>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">AI Feedback:</h4>
                                    <blockquote className="border-l-4 border-primary pl-4 text-gray-800 bg-blue-50/50 p-3 rounded-r-md">{answer.ai_feedback}</blockquote>
                                </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                <OverallAnalysis analysis={analysis} isLoading={isAnalysisLoading} />
                <div className="mt-8 text-center">
                    <Button onClick={() => router.push('/dashboard')}>Practice Again</Button>
                </div>
            </div>
        </div>
    </AnimatedPage>
  );
}
