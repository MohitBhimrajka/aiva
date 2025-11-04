'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noHeaderRoutes = ['/login', '/signup', '/onboarding'];

  return (
    <>
      {!noHeaderRoutes.includes(pathname) && <Header />}
      {children}
    </>
  )
}

