// frontend/src/components/layout/Header.tsx

import { Breadcrumbs } from './Breadcrumbs'
import { UserProfile } from './UserProfile'

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
      <Breadcrumbs />
      <div className="ml-auto">
        <UserProfile />
      </div>
    </header>
  )
}

