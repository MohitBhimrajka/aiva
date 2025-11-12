// frontend/src/app/profile/layout.tsx

import ProtectedRoute from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 p-4 md:p-8 bg-background">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

