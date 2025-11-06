'use client'

import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function Step_StudentProfile({ onCompleted }: { onCompleted: () => void }) {
  const { user, accessToken, refreshUser } = useAuth();
  const [college, setCollege] = useState('');
  const [degree, setDegree] = useState('');
  const [major, setMajor] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        await fetch(`${apiUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({
                first_name: user?.first_name,
                last_name: user?.last_name,
                primary_goal: user?.primary_goal,
                details: { college, degree, major, graduation_year: parseInt(gradYear) }
            })
        });
        await refreshUser();
        onCompleted();
    } catch {
        toast.error("Failed to save academic profile.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Background</CardTitle>
        <CardDescription>Tell us about your studies. This helps us tailor your experience.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>College/University</Label>
            <Input value={college} onChange={e => setCollege(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Degree</Label>
                <Input placeholder="e.g., Bachelor of Science" value={degree} onChange={e => setDegree(e.target.value)} required />
             </div>
             <div className="space-y-2">
                <Label>Major</Label>
                <Input placeholder="e.g., Computer Science" value={major} onChange={e => setMajor(e.target.value)} required />
             </div>
          </div>
          <div className="space-y-2">
            <Label>Graduation Year</Label>
            <Input type="number" placeholder="e.g., 2025" value={gradYear} onChange={e => setGradYear(e.target.value)} required />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="animate-spin" /> : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

