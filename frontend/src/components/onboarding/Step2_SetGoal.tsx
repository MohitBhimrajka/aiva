'use client'

import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GraduationCap, Briefcase, TrendingUp } from 'lucide-react'

interface Step2_SetGoalProps {
  onComplete: (data: { primary_goal: string; isStudent: boolean }) => void
  initialData?: {
    primary_goal?: string
  }
}

const goalOptions = [
  {
    value: 'I\'m a student',
    label: 'I\'m a student',
    description: 'Preparing for interviews after graduation',
    icon: GraduationCap,
    isStudent: true,
  },
  {
    value: 'I\'m job hunting',
    label: 'I\'m job hunting',
    description: 'Looking for my next opportunity',
    icon: Briefcase,
    isStudent: false,
  },
  {
    value: 'I want to improve',
    label: 'I want to improve',
    description: 'Enhancing my interview skills',
    icon: TrendingUp,
    isStudent: false,
  },
]

export default function Step2_SetGoal({ onComplete, initialData }: Step2_SetGoalProps) {
  const [selectedGoal, setSelectedGoal] = useState(initialData?.primary_goal || '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (selectedGoal) {
      const selectedOption = goalOptions.find((opt) => opt.value === selectedGoal)
      console.log('Step2 Submit - selectedGoal:', selectedGoal, 'selectedOption:', selectedOption)
      const result = {
        primary_goal: selectedGoal,
        isStudent: selectedOption?.isStudent || false,
      }
      console.log('Step2 calling onComplete with:', result)
      onComplete(result)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        {goalOptions.map((option) => {
          const Icon = option.icon
          const isSelected = selectedGoal === option.value
          return (
            <Card
              key={option.value}
              className={`cursor-pointer transition-all hover:border-primary ${
                isSelected ? 'border-primary border-2' : ''
              }`}
              onClick={() => setSelectedGoal(option.value)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`p-3 rounded-lg ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{option.label}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="h-4 w-4 rounded-full bg-primary"></div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button type="submit" className="w-full" disabled={!selectedGoal}>
        Continue
      </Button>
    </form>
  )
}

