'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Briefcase, LayoutDashboard, UserCircle, BarChart3, LogOut } from 'lucide-react'

export function Header() {
    const { user, logout } = useAuth()

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
                        <div className="p-2 bg-primary text-primary-foreground rounded-full">
                           <Briefcase size={20}/>
                        </div>
                        <span className="hidden font-bold sm:inline-block">AIVA</span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        {/* --- FIX: New Navigation Order --- */}
                        <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-2"><LayoutDashboard size={16}/> Dashboard</Link>
                        <Link href="/profile" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-2"><UserCircle size={16}/> Career Hub</Link>
                        <Link href="/progress" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-2"><BarChart3 size={16}/> My Progress</Link>
                        {/* Session History now lives on the Dashboard, so it's removed from the main nav */}
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-end space-x-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user?.first_name || user?.email}</span>
                    <Button onClick={logout} variant="outline" size="sm" className="gap-2">
                        <LogOut size={16}/> Logout
                    </Button>
                </div>
            </div>
        </header>
    )
}
