'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, History, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Session {
  id: number;
  created_at: string;
  difficulty: string;
  status: string;
  role_name: string;
}

const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    if (status === 'Completed') return 'default';
    if (status === 'In Progress') return 'secondary';
    return 'outline';
}

export function SessionHistory() {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

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
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [accessToken]);

  const handleClearHistory = async () => {
    if (!accessToken) return;
    
    setIsClearing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/sessions/history`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to clear session history: ${response.status} ${errorText}`);
      }
      
      setSessions([]);
      setShowClearDialog(false);
      toast.success('Session history cleared successfully.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Error clearing session history:', err);
      toast.error(errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="text-red-500 p-4 flex items-center gap-2"><AlertCircle size={16}/> {error}</div>;
    if (sessions.length === 0) return <p className="text-muted-foreground p-4 text-center">You have no interview history yet. Start a new session to begin!</p>;
    
    return (
      <ul className="space-y-3">
        {sessions.map((session, index) => (
          <motion.li
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-md transition-colors">
              <div>
                <p className="font-semibold">{session.role_name} - <span className="font-normal">{session.difficulty}</span></p>
                <p className="text-sm text-muted-foreground">{session.created_at}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={getStatusVariant(session.status)}>{session.status}</Badge>
                {session.status === 'Completed' && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/report/${session.id}`}>View Report</Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History size={20}/> Session History
            </CardTitle>
            {sessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="gap-2"
              >
                <Trash2 size={16} />
                Clear History
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Session History</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all your interview session history? This action cannot be undone.
              All your past sessions and their associated data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearHistory}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear History
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

