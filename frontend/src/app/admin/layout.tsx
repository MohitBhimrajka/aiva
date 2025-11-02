// frontend/src/app/admin/layout.tsx
import ProtectedRoute from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/layout/Sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 bg-background">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}

