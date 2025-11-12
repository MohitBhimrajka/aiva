// frontend/src/app/interview/layout.tsx

'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { MediaStreamProvider } from '@/contexts/MediaStreamContext'

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <MediaStreamProvider>
        {/* This layout is intentionally simple to create a focused experience */}
        {children}
      </MediaStreamProvider>
    </ProtectedRoute>
  )
}

