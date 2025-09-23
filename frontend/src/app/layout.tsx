import './globals.css'
import { Inter } from 'next/font/google' // <-- Import the font
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from "@/components/ui/sonner"
import { cn } from '@/lib/utils'

// --- Initialize the font with the 'latin' subset ---
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata = {
  title: 'AIVA - AI Virtual Assistant | HR Pinnacle',
  description: 'Master your interviews with AIVA, the intelligent virtual assistant that provides personalized practice sessions and detailed feedback.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // --- Apply the font class to the <html> tag ---
    <html lang="en" className={cn(
      "min-h-screen bg-background font-sans antialiased",
      inter.variable
    )}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster richColors />
      </body>
    </html>
  )
}
