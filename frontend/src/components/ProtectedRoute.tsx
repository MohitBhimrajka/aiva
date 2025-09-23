'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="container">
        <h1>Loading...</h1>
        <p>Checking authentication status.</p>
      </div>
    );
  }

  // Render children only if user is authenticated
  if (user) {
    return <>{children}</>
  }

  // Optionally, return null or a simple loading indicator while redirecting
  return null;
}
