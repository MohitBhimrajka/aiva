'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import AnimatedPage from '@/components/AnimatedPage'
import ResumeCard from '@/components/profile/ResumeCard'
import RoleMatchesCard from '@/components/profile/RoleMatchesCard'
import UserDetailsCard from '@/components/profile/UserDetailsCard'
import ResumeImproverModal from '@/components/profile/resume-improver/ResumeImproverModal'

export default function ProfilePage() {
  const { user, accessToken, refreshUser } = useAuth()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showImprover, setShowImprover] = useState(false)

  const handleAnalyze = async () => {
    if (!accessToken) {
      toast.error('You must be logged in to analyze your resume')
      return
    }

    setIsAnalyzing(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${apiUrl}/api/profile/analyze-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        await refreshUser()
        toast.success('Resume analyzed successfully!')
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Failed to analyze resume')
      }
    } catch (error) {
      console.error('Error analyzing resume:', error)
      toast.error('An error occurred while analyzing your resume')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <AnimatedPage>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Career Hub</h1>
        <p className="text-muted-foreground">
          Manage your resume, view analysis, and discover role matches
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Details */}
        <div className="lg:col-span-1">
          <UserDetailsCard user={user} />
        </div>

        {/* Right Column - Resume Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <ResumeCard
            user={user}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            onImprove={() => setShowImprover(true)}
          />

          {user?.resume_score && (
            <RoleMatchesCard user={user} />
          )}
        </div>
      </div>

      {showImprover && (
        <ResumeImproverModal
          isOpen={showImprover}
          onClose={() => setShowImprover(false)}
          resumeText={user?.raw_resume_text || ''}
        />
      )}
    </AnimatedPage>
  )
}

