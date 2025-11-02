// frontend/src/components/SessionHistory.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { FileClock, AlertCircle, TrendingUp, Filter, SortAsc, SortDesc } from 'lucide-react'
import { ProgressLineChart } from './ReportCharts'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// TypeScript interface matching our backend schema
interface SessionHistoryItem {
  session_id: number;
  role_name: string;
  difficulty: string;
  completed_at: string;
  average_score: number | null;
}

// Helper to determine badge color based on score
const getScoreBadgeVariant = (score: number | null): "default" | "secondary" | "destructive" => {
  if (score === null || score < 5) return "destructive";
  if (score < 8) return "secondary";
  return "default";
};

// Types for sorting options
type SortOrder = 'asc' | 'desc';
type SortCriteria = 'date' | 'score' | 'role';

// Skeleton for loading state
const HistorySkeleton = () => (
  <div className="space-y-8">
    <Card className="animate-pulse">
      <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
      <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
    </Card>
    <Card className="animate-pulse">
      <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  </div>
);

export function SessionHistory() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for filtering and sorting
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!accessToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/sessions/history`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          throw new Error('Failed to load your session history. Please try again later.');
        }

        const data = await response.json();
        setHistory(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [accessToken]);

  // Extract unique roles for the filter dropdown
  const uniqueRoles = useMemo(() => {
    const roles = history.map(item => item.role_name);
    const unique = [...new Set(roles)].sort();
    return ['all', ...unique];
  }, [history]);

  // Filter and Sort Logic
  const filteredAndSortedHistory = useMemo(() => {
    let processedHistory = [...history];

    // 1. Filter by Role
    if (filterRole !== 'all') {
      processedHistory = processedHistory.filter(item => item.role_name === filterRole);
    }

    // 2. Sort
    processedHistory.sort((a, b) => {
      let comparison = 0;
      switch (sortCriteria) {
        case 'date':
          comparison = new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
          break;
        case 'score':
          // Handle null scores by pushing them to the end
          const scoreA = a.average_score ?? -1;
          const scoreB = b.average_score ?? -1;
          comparison = scoreA - scoreB;
          break;
        case 'role':
          comparison = a.role_name.localeCompare(b.role_name);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });

    return processedHistory;
  }, [history, filterRole, sortCriteria, sortOrder]);

  if (isLoading) {
    return <HistorySkeleton />;
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

  // Empty state
  if (history.length === 0) {
    return (
      <Card className="text-center py-16 px-6 border-2 border-dashed">
        <FileClock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">No Completed Sessions</h3>
        <p className="mt-2 text-base text-muted-foreground">Your interview history will appear here once you complete a session.</p>
        <Button className="mt-6" onClick={() => router.push('/dashboard')}>Start Your First Interview</Button>
      </Card>
    );
  }

  // Main content with filters, chart, and table
  return (
    <div className="space-y-8">
      {/* Filters and Sort Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filter & Sort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Role Filter */}
            <div>
              <Label htmlFor="role-filter">Filter by Role</Label>
              <Select onValueChange={setFilterRole} value={filterRole}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueRoles.map(role => (
                    <SelectItem key={role} value={role}>
                      {role === 'all' ? 'All Roles' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Criteria */}
            <div>
              <Label htmlFor="sort-criteria">Sort by</Label>
              <Select onValueChange={(value: SortCriteria) => setSortCriteria(value)} value={sortCriteria}>
                <SelectTrigger id="sort-criteria">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div>
              <Label htmlFor="sort-order">Order</Label>
              <Select onValueChange={(value: SortOrder) => setSortOrder(value)} value={sortOrder}>
                <SelectTrigger id="sort-order">
                  <SelectValue placeholder="Descending" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">
                    <span className="flex items-center">
                      Descending <SortDesc className="ml-2 h-4 w-4 text-muted-foreground" />
                    </span>
                  </SelectItem>
                  <SelectItem value="asc">
                    <span className="flex items-center">
                      Ascending <SortAsc className="ml-2 h-4 w-4 text-muted-foreground" />
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Chart (only shown if more than 1 session after filtering) */}
      {filteredAndSortedHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Your Progress Over Time
            </CardTitle>
            <CardDescription>Tracking your average score across sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressLineChart history={filteredAndSortedHistory} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>Select a session to view the detailed report.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Avg. Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedHistory.map((item) => (
                <TableRow 
                  key={item.session_id} 
                  onClick={() => router.push(`/report/${item.session_id}`)}
                  className="cursor-pointer hover:bg-accent/50 interactive-effect"
                >
                  <TableCell className="font-medium">{item.role_name}</TableCell>
                  <TableCell>{item.difficulty}</TableCell>
                  <TableCell>{new Date(item.completed_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={getScoreBadgeVariant(item.average_score)}>
                      {item.average_score !== null ? `${item.average_score.toFixed(1)}/10` : 'N/A'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

