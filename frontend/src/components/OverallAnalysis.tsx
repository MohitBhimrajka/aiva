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
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot /> AIVA&apos;s Final Analysis</CardTitle>
        <CardDescription>A holistic summary of your interview performance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-foreground/90">{analysis.summary}</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><ThumbsUp className="text-green-500" /> Key Strengths</h3>
            {analysis.strengths && analysis.strengths.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                {analysis.strengths.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Focus on demonstrating your technical knowledge and communication skills in future sessions to build a strong performance profile.</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Target className="text-amber-500" /> Areas for Improvement</h3>
            {analysis.areas_for_improvement && analysis.areas_for_improvement.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                {analysis.areas_for_improvement.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Continue practicing and refining your interview skills.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

