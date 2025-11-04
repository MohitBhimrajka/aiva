'use client'

import { useAuth } from '@/contexts/AuthContext'
import AnimatedPage from '@/components/AnimatedPage'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ResumeCard } from '@/components/profile/ResumeCard'
import { RoleMatchesCard } from '@/components/profile/RoleMatchesCard'
import { UserDetailsCard } from '@/components/profile/UserDetailsCard'
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    if (isLoading || !user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <AnimatedPage className="bg-gray-50/50 min-h-screen p-4 sm:p-8">
            <main className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Career Hub</h1>
                        <p className="text-muted-foreground">Manage your profile, analyze your resume, and track your progress.</p>
                    </div>
                    <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-1 space-y-8">
                        <UserDetailsCard user={user} />
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 space-y-8">
                        <ResumeCard resumeSummary={user.resume_summary} />
                        <RoleMatchesCard />
                    </div>
                </div>
            </main>
        </AnimatedPage>
    )
}
