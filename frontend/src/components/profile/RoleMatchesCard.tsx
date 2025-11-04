'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target } from 'lucide-react'

export function RoleMatchesCard() {
  const { user } = useAuth()

  const getScoreColor = (score: number) => {
    if (score > 85) return "bg-green-100 text-green-800"
    if (score > 70) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Target /> Top Role Matches</CardTitle>
        <CardDescription>Based on our analysis of your resume, here are the roles you&apos;re a strong fit for.</CardDescription>
      </CardHeader>
      <CardContent>
        {!user?.role_matches || user.role_matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Run the resume analysis to see your role matches here.</p>
        ) : (
          <div className="space-y-4">
            {user.role_matches.map((match: { role_name: string; match_score: number; justification: string }, i: number) => (
              <div key={i} className="border p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{match.role_name}</h3>
                  <Badge className={getScoreColor(match.match_score)}>Match: {match.match_score}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground italic">&quot;{match.justification}&quot;</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
