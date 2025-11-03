// frontend/src/components/OverallAnalysis.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThumbsUp, Target, Bot } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

interface AnalysisData {
  summary: string;
  strengths: string[];
  areas_for_improvement: string[];
}

interface OverallAnalysisProps {
  analysis: AnalysisData | null;
  isLoading: boolean;
}

const AnalysisSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="pt-4 space-y-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
        </div>
    </div>
)

export function OverallAnalysis({ analysis, isLoading }: OverallAnalysisProps) {
  if (isLoading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot /> AIVA&apos;s Final Analysis</CardTitle>
                <CardDescription>Generating your holistic performance summary...</CardDescription>
            </CardHeader>
            <CardContent>
                <AnalysisSkeleton />
            </CardContent>
        </Card>
    )
  }

  if (!analysis) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot /> AIVA&apos;s Final Analysis</CardTitle>
        <CardDescription>A holistic summary of your interview performance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-foreground/90 text-base">{analysis.summary}</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* --- MODIFIED STRENGTHS SECTION --- */}
          <div className="rounded-lg border bg-green-50 p-4 border-green-200">
            <h3 className="font-semibold flex items-center gap-2 mb-3 text-green-900">
                <ThumbsUp className="h-5 w-5 text-green-600" /> 
                Key Strengths
            </h3>
            {analysis.strengths && analysis.strengths.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-green-800">
                {analysis.strengths.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-green-700/80 italic">
                Focus on demonstrating clear strengths in your next session.
              </p>
            )}
          </div>

          {/* --- MODIFIED IMPROVEMENTS SECTION --- */}
          <div className="rounded-lg border bg-amber-50 p-4 border-amber-200">
            <h3 className="font-semibold flex items-center gap-2 mb-3 text-amber-900">
                <Target className="h-5 w-5 text-amber-600" /> 
                Areas for Improvement
            </h3>
            {analysis.areas_for_improvement && analysis.areas_for_improvement.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-amber-800">
                {analysis.areas_for_improvement.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-amber-700/80 italic">
                Great work! No critical areas for improvement were identified in this session.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

