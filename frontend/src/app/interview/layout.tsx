'use client'

import { MediaStreamProvider } from '@/contexts/MediaStreamContext';

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MediaStreamProvider>
      {children}
    </MediaStreamProvider>
  )
}

