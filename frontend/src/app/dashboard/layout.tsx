import ProtectedRoute from '@/components/ProtectedRoute' // Adjust path if needed

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
