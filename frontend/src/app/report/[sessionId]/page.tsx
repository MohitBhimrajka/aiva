'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion' // <-- Import motion

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Badge } from "@/components/ui/badge"
import { AnimatedCounter } from '@/components/AnimatedCounter' // <-- Import counter
import AnimatedPage from '@/components/AnimatedPage' // <-- Import page wrapper

// --- TypeScript Interfaces ---
interface ReportQuestion { content: string }
interface ReportAnswer {
  answer_text: string;
  ai_feedback: string;
  ai_score: number;
  question: ReportQuestion;
}
interface ReportRole { name: string; category: string }
interface ReportSession {
  id: number;
  difficulty: string;
  status: string;
  role: ReportRole;
}
interface FullReport {
  session: ReportSession;
  answers: ReportAnswer[];
}

// --- Helper Functions & Components ---
const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
  if (score >= 8) return "default";
  if (score >= 5) return "secondary";
  return "destructive";
};

const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="h-12 bg-gray-200 rounded w-1/2 animate-pulse"></div>
      <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
      <div className="h-16 bg-gray-200 rounded w-full animate-pulse mt-8"></div>
      <div className="h-16 bg-gray-200 rounded w-full animate-pulse"></div>
    </div>
);

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger animation of children
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
        type: 'spring',
        stiffness: 100
    }
  },
};

export default function ReportPage() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [report, setReport] = useState<FullReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const averageScore = report ? 
    report.answers.reduce((acc, ans) => acc + ans.ai_score, 0) / (report.answers.length || 1)
    : 0;

  useEffect(() => {
    if (!accessToken || !sessionId) return;
    
    const fetchReport = async () => {
      // ... (fetch logic remains the same)
      setIsLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/report`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch interview report.');
        const data: FullReport = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [accessToken, sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-4xl w-full p-8">
            <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="max-w-4xl mx-auto p-8 text-red-500">Error: {error}</div>
  }

  if (!report) {
    return <div className="max-w-4xl mx-auto p-8">No report data found.</div>
  }

  return (
    <AnimatedPage>
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto p-4 md:p-8">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.header variants={itemVariants} className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">AIVA Interview Report</h1>
                        <p className="text-muted-foreground">
                        Your AI Virtual Assistant has analyzed your performance for the {report.session.role.name} ({report.session.difficulty}) role.
                        </p>
                    </motion.header>

                    <motion.div variants={itemVariants}>
                        <Card className="mb-8 shadow-sm">
                            <CardHeader>
                                <CardTitle>Overall Summary</CardTitle>
                                <CardDescription>Your average score across all questions.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl font-bold">
                                        <AnimatedCounter from={0} to={averageScore} />
                                    </div>
                                    <span className="text-xl text-muted-foreground">/ 10</span>
                                    <Badge variant={getScoreBadgeVariant(averageScore)} className="text-lg">
                                        {averageScore >= 8 ? "Excellent" : averageScore >= 5 ? "Good" : "Needs Improvement"}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    
                    <motion.h2 variants={itemVariants} className="text-2xl font-bold mb-4">Detailed Feedback</motion.h2>
                    <motion.div variants={itemVariants}>
                        <Accordion type="single" collapsible className="w-full bg-white rounded-lg shadow-sm">
                            {report.answers.map((answer, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="text-left hover:no-underline px-6 py-4">
                                    <div className="flex-1 flex items-center gap-4">
                                        <span className="text-primary font-bold">{`Q${index + 1}`}</span>
                                        <span className="font-medium text-gray-800">{answer.question.content}</span>
                                    </div>
                                    <Badge variant={getScoreBadgeVariant(answer.ai_score)} className="ml-4">
                                        Score: {answer.ai_score}/10
                                    </Badge>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-2 space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">Your Answer:</h4>
                                        <blockquote className="border-l-4 pl-4 italic text-gray-600 bg-gray-50 p-3 rounded-r-md">
                                        {answer.answer_text}
                                        </blockquote>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">AI Feedback:</h4>
                                        <blockquote className="border-l-4 border-primary pl-4 text-gray-800 bg-blue-50 p-3 rounded-r-md">
                                        {answer.ai_feedback}
                                        </blockquote>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            ))}
                        </Accordion>
                    </motion.div>

                    <motion.div variants={itemVariants} className="mt-8 text-center">
                        <Button onClick={() => router.push('/dashboard')}>
                            Practice Again
                        </Button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    </AnimatedPage>
  );
}
