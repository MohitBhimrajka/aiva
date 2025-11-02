// frontend/src/app/settings/page.tsx

'use client'

import AnimatedPage from '@/components/AnimatedPage'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <AnimatedPage>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This section is under development. Future features will include password management and profile updates.
          </CardDescription>
        </CardHeader>
      </Card>
    </AnimatedPage>
  );
}

