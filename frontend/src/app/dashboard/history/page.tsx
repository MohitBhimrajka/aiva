"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Role = {
  id: number;
  name: string;
  category: string;
};

type Session = {
  id: number;
  role: Role;
  status: string;
  difficulty: string;
  total_questions: number;
  created_at?: string;
};

export default function HistoryPage() {
  const { accessToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/sessions/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (error)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading sessions</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">My Interview History</h1>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground">
          No completed sessions yet. Try starting one from the main dashboard.
        </p>
      ) : (
        sessions.map((s) => (
          <Card key={s.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>
                {s.role?.name || "Unknown Role"} ({s.role?.category})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Difficulty:</strong> {s.difficulty}
              </p>
              <p>
                <strong>Status:</strong> {s.status}
              </p>
              <p>
                <strong>Total Questions:</strong> {s.total_questions}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {s.created_at
                  ? new Date(s.created_at).toLocaleString()
                  : "N/A"}
              </p>
              <Button variant="outline" className="mt-3" asChild>
                <a href={`/report/${s.id}`}>View Report</a>
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
