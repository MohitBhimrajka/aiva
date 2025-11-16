'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, GraduationCap, Target } from 'lucide-react'

interface UserDetailsCardProps {
  user: {
    first_name?: string
    last_name?: string
    primary_goal?: string
    college?: string
    degree?: string
    major?: string
    graduation_year?: number
    skills?: string[]
  } | null
}

export default function UserDetailsCard({ user }: UserDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Name</p>
          <p className="text-lg">
            {user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : 'Not set'}
          </p>
        </div>

        {user?.primary_goal && (
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Primary Goal
            </p>
            <Badge variant="secondary" className="mt-1">
              {user.primary_goal}
            </Badge>
          </div>
        )}

        {(user?.college || user?.degree || user?.major) && (
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Education
            </p>
            <div className="mt-1 space-y-1">
              {user.degree && user.major && (
                <p className="text-sm">{user.degree} in {user.major}</p>
              )}
              {user.college && (
                <p className="text-xs text-muted-foreground">{user.college}</p>
              )}
              {user.graduation_year && (
                <p className="text-xs text-muted-foreground">Class of {user.graduation_year}</p>
              )}
            </div>
          </div>
        )}

        {user?.skills && user.skills.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill: string, index: number) => (
                <Badge key={index} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

