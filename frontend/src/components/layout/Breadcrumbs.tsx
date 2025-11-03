// frontend/src/components/layout/Breadcrumbs.tsx

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext'

export function Breadcrumbs() {
  const pathname = usePathname()
  const { dynamicPaths } = useBreadcrumbs();
  
  // Don't show breadcrumbs on the main dashboard page
  if (pathname === '/dashboard') {
    return null;
  }

  // Create breadcrumb segments from the path
  const segments = pathname.split('/').filter(Boolean); // filter(Boolean) removes empty strings

  return (
    <nav aria-label="Breadcrumb" className="text-sm font-medium text-muted-foreground hidden md:flex">
      <ol className="flex items-center space-x-2">
        <li>
          <Link href="/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`
          const isLast = index === segments.length - 1

          // Check if a dynamic name exists for this path, otherwise format the segment
          const displayName = dynamicPaths[href] || (segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '));

          return (
            <Fragment key={href}>
              <li>
                <div className="flex items-center">
                  <ChevronRight className="h-4 w-4" />
                  {isLast ? (
                    <span className="ml-2 text-foreground">{displayName}</span>
                  ) : (
                    <Link href={href} className="ml-2 hover:text-primary transition-colors">
                      {displayName}
                    </Link>
                  )}
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

