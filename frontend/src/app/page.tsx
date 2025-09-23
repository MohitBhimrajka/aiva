// frontend/src/app/page.tsx (Corrected)
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // We wait until the authentication status is no longer loading
    if (!isLoading) {
      if (user) {
        // If user is logged in, redirect to the dashboard
        router.push('/dashboard')
      } else {
        // If user is not logged in, redirect to the login page
        router.push('/login')
      }
    }
  }, [user, isLoading, router])

  // Display a full-page loading spinner while the auth check and redirect are in progress.
  // This provides a smooth user experience and prevents any content flicker.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  )
}
