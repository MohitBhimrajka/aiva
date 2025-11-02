// frontend/src/app/reports/page.tsx

'use client'

import AnimatedPage from '@/components/AnimatedPage'
import { SessionHistory } from '@/components/SessionHistory'

export default function ReportsPage() {
  return (
    <AnimatedPage>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Reports</h1>
        <p className="text-muted-foreground">
          Review your past interview sessions and track your progress.
        </p>
      </header>
      <SessionHistory />
    </AnimatedPage>
  );
}

