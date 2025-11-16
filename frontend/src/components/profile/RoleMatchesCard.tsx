'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Target } from 'lucide-react'

interface RoleMatchesCardProps {
  user: {
    role_matches?: Array<{
      role_name: string
      match_score: number
    }>
  } | null
}

export default function RoleMatchesCard({ user }: RoleMatchesCardProps) {
  const roleMatches = user?.role_matches || []

  if (roleMatches.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Top Role Matches
        </CardTitle>
        <CardDescription>
          Roles that best match your resume based on AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roleMatches.map((match, index: number) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{match.role_name}</span>
                <Badge variant="secondary">
                  {Math.round(match.match_score * 100)}% match
                </Badge>
              </div>
              <Progress value={match.match_score * 100} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

