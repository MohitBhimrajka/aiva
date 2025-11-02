import './globals.css'
import localFont from 'next/font/local' // <-- Use local font instead
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from "@/components/ui/sonner"
import { cn } from '@/lib/utils'

// --- Initialize Inter variable font from local files ---
const inter = localFont({
  src: [
    {
      path: '../../public/fonts/Inter-VariableFont_opsz,wght.ttf',
      weight: '100 900',
      style: 'normal',
    }
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  title: 'AIVA - AI Virtual Assistant | HR Pinnacle',
  description: 'Master your interviews with AIVA, the intelligent virtual assistant that provides personalized practice sessions and detailed feedback.',
  icons: {
    icon: '/favicon.png',
  },
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
