// frontend/src/app/report/[sessionId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Badge } from "@/components/ui/badge"
import { AnimatedCounter } from '@/components/AnimatedCounter'
import AnimatedPage from '@/components/AnimatedPage'
import { ScoreBarChart } from '@/components/ReportCharts';
import { OverallAnalysis } from '@/components/OverallAnalysis';
import { Clock, Mic, MessageSquareQuote, Bot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

// Loading Skeleton
const ReportSkeleton = () => (
    <div className="space-y-8">
        <div className="space-y-2"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4" /></div>
        <div className="border-b"><Skeleton className="h-10 w-48" /></div>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
)

export default function ReportPage() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const { setDynamicPath } = useBreadcrumbs()
  const sessionId = params.sessionId as string
  const [report, setReport] = useState<FullReport | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)
  
  const averageScore = report && report.answers.length > 0
    ? report.answers.reduce((acc, ans) => acc + ans.ai_score, 0) / report.answers.length
    : 0;
  
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
        
        // Set the dynamic breadcrumb path
        if (reportData.session.role.name) {
          setDynamicPath(pathname, `${reportData.session.role.name} Report`);
        }
        
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
  }, [accessToken, sessionId, pathname]);

  if (isLoading) {
    return (
      <AnimatedPage className="max-w-4xl mx-auto p-4 md:p-8">
        <ReportSkeleton />
      </AnimatedPage>
    );
  }

  if (error) return <div className="max-w-4xl mx-auto p-8 text-red-500">Error: {error}</div>
  if (!report) return <div className="max-w-4xl mx-auto p-8">No report data found.</div>

  return (
    <AnimatedPage className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <header className="space-y-1">
            <h1>Interview Report</h1>
            <p className="text-muted-foreground">
              Performance summary for the {report.session.role.name} ({report.session.difficulty}) role.
            </p>
        </header>

        {/* --- NEW: Tabbed Layout --- */}
        <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="breakdown">Detailed Breakdown</TabsTrigger>
            </TabsList>
            
            {/* --- SUMMARY TAB CONTENT --- */}
            <TabsContent value="summary" className="space-y-6 pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Performance</CardTitle>
                        <CardDescription>A high-level look at your scores across all questions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="text-5xl font-bold text-primary"><AnimatedCounter from={0} to={averageScore} /></div>
                            <div className="flex flex-col">
                                <span className="text-lg text-muted-foreground">/ 10 average score</span>
                                <Badge variant={getScoreBadgeVariant(averageScore)} className="text-base mt-1">
                                    {averageScore >= 8 ? "Excellent" : averageScore >= 5 ? "Good" : "Needs Improvement"}
                                </Badge>
                            </div>
                        </div>
                        <ScoreBarChart answers={report.answers} />
                    </CardContent>
                </Card>
                
                <OverallAnalysis analysis={analysis} isLoading={isAnalysisLoading} />
            </TabsContent>

            {/* --- DETAILED BREAKDOWN TAB CONTENT --- */}
            <TabsContent value="breakdown" className="pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Question by Question</CardTitle>
                        <CardDescription>Review your specific answers and the AI&apos;s feedback for each question.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Accordion type="single" collapsible className="w-full">
                            {report.answers.map((answer, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="text-left hover:no-underline px-4 py-4">
                                    <div className="flex-1 flex items-center gap-4">
                                        <span className="text-primary font-bold">{`Q${index + 1}`}</span>
                                        <span className="font-medium text-foreground flex-1">{answer.question.content}</span>
                                    </div>
                                    <Badge variant={getScoreBadgeVariant(answer.ai_score)} className="ml-4 shrink-0">
                                        Score: {answer.ai_score}/10
                                    </Badge>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-2 space-y-6 bg-muted/40">
                                    {/* --- REFINED Answer & Feedback Visuals --- */}
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm flex items-center gap-2"><MessageSquareQuote className="h-4 w-4 text-muted-foreground" /> Your Answer:</h4>
                                        <blockquote className="border-l-2 pl-4 text-muted-foreground text-base">{answer.answer_text}</blockquote>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> AI Feedback:</h4>
                                        <blockquote className="border-l-2 border-primary pl-4 text-foreground text-base">{answer.ai_feedback}</blockquote>
                                    </div>
                                    {(answer.speaking_pace_wpm !== null && answer.filler_word_count !== null) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 mt-4">
                                        <div className="flex items-center gap-3 text-sm"><Clock className="h-5 w-5 text-primary" /><p><span className="font-bold text-lg">{answer.speaking_pace_wpm}</span> WPM (Words Per Minute)</p></div>
                                        <div className="flex items-center gap-3 text-sm"><Mic className="h-5 w-5 text-primary" /><p><span className="font-bold text-lg">{answer.filler_word_count}</span> Filler Words</p></div>
                                    </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
            <Button onClick={() => router.push('/dashboard')} variant="accent">Practice Again</Button>
        </div>
    </AnimatedPage>
  );
}
