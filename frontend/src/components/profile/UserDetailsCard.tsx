'use client'

import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User as UserIcon, Briefcase, School, TrendingUp, Edit2, Save, X, Loader2 } from 'lucide-react'

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  primary_goal?: string;
  college?: string;
  degree?: string;
  major?: string;
  graduation_year?: number;
  skills?: string[];
}

const goalIcons: { [key: string]: React.ReactNode } = {
  student: <School className="w-5 h-5" />,
  career_change: <Briefcase className="w-5 h-5" />,
  advancement: <TrendingUp className="w-5 h-5" />,
};

export function UserDetailsCard({ user }: { user: User }) {
  const { accessToken, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [isLoading, setIsLoading] = useState(false);

  const goalText = user.primary_goal?.replace('_', ' ') || 'Not Set';

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      // Use the new full profile update endpoint
      const response = await fetch(`${apiUrl}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          primary_goal: user.primary_goal,
          // We pass existing data back to avoid overwriting it
          details: user.primary_goal === 'student' ? {
            college: user.college, degree: user.degree, major: user.major, graduation_year: user.graduation_year
          } : undefined,
          skills: user.skills
        })
      });
      if (!response.ok) throw new Error("Failed to update profile.");
      await refreshUser();
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><UserIcon /> Your Profile</div>
          {!isEditing ? (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8">
              <Edit2 size={16} />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8"><X size={16} /></Button>
              <Button variant="ghost" size="icon" onClick={handleSave} disabled={isLoading} className="h-8 w-8">
                {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />}
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user.first_name} {user.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Primary Goal</span>
              <div className="flex items-center gap-2 font-medium capitalize">
                {goalIcons[user.primary_goal || '']}
                {goalText}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
