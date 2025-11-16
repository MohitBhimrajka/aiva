'use client'

import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Step1_ProfileBasicsProps {
  onComplete: (data: { first_name: string; last_name: string }) => void
  initialData?: {
    first_name?: string
    last_name?: string
  }
}

export default function Step1_ProfileBasics({ onComplete, initialData }: Step1_ProfileBasicsProps) {
  const [firstName, setFirstName] = useState(initialData?.first_name || '')
  const [lastName, setLastName] = useState(initialData?.last_name || '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (firstName.trim() && lastName.trim()) {
      onComplete({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          type="text"
          placeholder="John"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          type="text"
          placeholder="Doe"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={!firstName.trim() || !lastName.trim()}>
        Continue
      </Button>
    </form>
  )
}

