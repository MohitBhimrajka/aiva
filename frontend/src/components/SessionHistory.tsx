// frontend/src/components/SessionHistory.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileClock, AlertCircle } from 'lucide-react'
import { ProgressLineChart } from './ReportCharts'

// TypeScript interface matching our backend schema
interface SessionHistoryItem {
  session_id: number;
  role_name: string;
  difficulty: string;
  completed_at: string;
  average_score: number | null;
}

// A simple skeleton component for the loading state
const SkeletonCard = () => (
  <div className="p-4 border rounded-lg animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

// Helper to determine badge color based on score
const getScoreBadgeVariant = (score: number | null): "default" | "secondary" | "destructive" => {
  if (score === null || score < 5) return "destructive";
  if (score < 8) return "secondary";
  return "default";
};

export function SessionHistory() {
  const { accessToken } = useAuth();
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!accessToken) return;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/sessions/history`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          throw new Error('Failed to load your session history. Please try again later.');
        }

        const data = await response.json();
        setHistory(data.history);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [accessToken]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-10 px-6 border-2 border-dashed rounded-lg">
        <FileClock className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No completed sessions</h3>
        <p className="mt-1 text-sm text-gray-500">Your interview history will appear here once you complete a session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Progress Over Time</CardTitle>
            <CardDescription>Tracking your average score across sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressLineChart history={history} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map((item) => (
          <Link href={`/report/${item.session_id}`} key={item.session_id} legacyBehavior>
            <a className="block">
              <Card className="hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{item.role_name}</CardTitle>
                      <CardDescription>
                        {item.difficulty} &middot; {new Date(item.completed_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant={getScoreBadgeVariant(item.average_score)}>
                      {item.average_score ? `${item.average_score.toFixed(1)}/10` : 'N/A'}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}

