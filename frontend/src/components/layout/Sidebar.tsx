// frontend/src/components/layout/Sidebar.tsx

'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScrollText, Settings, Briefcase, ShieldCheck, BarChart3, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/profile', label: 'Career Hub', icon: UserCircle },
  { href: '/reports', label: 'My Reports', icon: ScrollText },
  { href: '/dashboard/comparison', label: 'Your Performance', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const adminLink = { href: '/admin', label: 'Admin', icon: ShieldCheck };

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Helper to determine if a link is active
  const isLinkActive = (href: string) => {
    if (href === '/reports') {
      // Also highlight reports when viewing individual report pages
      return pathname === href || pathname.startsWith('/report/');
    }
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-50 border-r h-screen sticky top-0">
      <div className="p-6">
        {/* Simplified BrandLogo for the sidebar */}
        <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">AIVA</h1>
        </div>
      </div>
      <nav className="flex flex-col px-4 space-y-1">
        {navLinks.map((link) => {
          const isActive = isLinkActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-200 hover:text-gray-900 interactive-effect',
                isActive && 'bg-primary/10 text-primary font-semibold'
              )}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
        
        {/* Conditionally render admin link */}
        {user?.role === 'super_admin' && (
          <Link
            href={adminLink.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-gray-700 hover:bg-gray-200 hover:text-gray-900 interactive-effect',
              pathname.startsWith(adminLink.href) && 'bg-primary/10 text-primary font-semibold'
            )}
          >
            <adminLink.icon className="h-5 w-5" />
            {adminLink.label}
          </Link>
        )}
      </nav>
    </aside>
  );
}

