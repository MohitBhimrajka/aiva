// frontend/src/app/dashboard/layout.tsx

import ProtectedRoute from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header' // <-- Import the new Header

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        {/* This new div wrapper is crucial for the layout */}
        <div className="flex flex-1 flex-col">
          <Header /> {/* <-- Add the Header here */}
          <main className="flex-1 p-4 md:p-8 bg-background">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
