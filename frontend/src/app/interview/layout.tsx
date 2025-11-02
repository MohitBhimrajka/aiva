// frontend/src/app/interview/layout.tsx

import ProtectedRoute from '@/components/ProtectedRoute'

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      {/* This layout is intentionally simple to create a focused experience */}
      {children}
    </ProtectedRoute>
  )
}

