'use client'

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Briefcase, School, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const goals = [
  { id: 'student', icon: <School />, text: "I&apos;m a student landing my first job." },
  { id: 'career_change', icon: <Briefcase />, text: "I&apos;m a professional changing careers." },
  { id: 'advancement', icon: <TrendingUp />, text: "I&apos;m looking to advance in my field." },
];

export function Step2_SetGoal({ onCompleted }: { onCompleted: () => void }) {
  const [selectedGoal, setSelectedGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { accessToken, user, refreshUser } = useAuth();

  const handleSaveGoal = async () => {
    if (!selectedGoal) {
      toast.error('Please select a goal.');
      return;
    }
    setIsLoading(true);

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/users/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ 
                first_name: user?.first_name || "",
                last_name: user?.last_name || "",
                primary_goal: selectedGoal 
            })
        });

        if (!response.ok) throw new Error("Failed to save goal.");
        await refreshUser(); // Refresh user data so onboarding can see the updated primary_goal
        onCompleted();
    } catch (error) {
        toast.error(error instanceof Error ? error.message : "An error occurred.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s your primary goal?</CardTitle>
        <CardDescription>This will help us tailor the experience for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            {goals.map(goal => (
                <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={cn(
                        "w-full flex items-center gap-4 p-4 border rounded-lg text-left transition-all",
                        selectedGoal === goal.id ? "border-primary ring-2 ring-primary" : "hover:bg-muted/50"
                    )}
                >
                    {goal.icon} {goal.text}
                </button>
            ))}
        </div>
        <Button onClick={handleSaveGoal} disabled={isLoading || !selectedGoal} className="w-full">
            {isLoading ? <Loader2 className="animate-spin" /> : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}

