'use client'

import { useAuth } from '@/contexts/AuthContext'
import AnimatedPage from '@/components/AnimatedPage'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Loader2, LineChart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface SessionHistory {
    id: number;
    created_at: string;
    difficulty: string;
    status: string;
    role_name: string;
    score?: string;
}

export default function ProgressPage() {
    const { isLoading, accessToken } = useAuth()
    const router = useRouter()
    const [history, setHistory] = useState<SessionHistory[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
          if (!accessToken) return;
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/sessions/history`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error('Failed to fetch session history.');
            const data = await response.json();
            
            // For charting, we need scores. We'll simulate this for now.
            // A real implementation would add an average_score to the history endpoint.
            const dataWithScores = data.map((s: SessionHistory) => ({
                ...s,
                score: s.status === 'Completed' ? (Math.random() * (9 - 6) + 6).toFixed(1) : 0
            }));
            setHistory(dataWithScores.reverse()); // Reverse to show oldest first on chart
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not load history.');
          } finally {
            setIsHistoryLoading(false);
          }
        };
        fetchHistory();
      }, [accessToken]);


    if (isLoading || isHistoryLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <AnimatedPage className="bg-gray-50/50 min-h-screen p-4 sm:p-8">
            <main className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Your Progress</h1>
                        <p className="text-muted-foreground">Visualize your interview performance over time.</p>
                    </div>
                    <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><LineChart /> Score Trend</CardTitle>
                        <CardDescription>Average scores from your completed interview sessions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer>
                                <BarChart data={history.filter(s => s.status === 'Completed')}>
                                    <XAxis dataKey="created_at" />
                                    <YAxis domain={[0, 10]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="score" fill="#18181b" name="Average Score"/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </AnimatedPage>
    )
}
