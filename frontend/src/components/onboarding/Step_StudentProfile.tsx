'use client'

import { useState, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

interface Step_StudentProfileProps {
  onComplete: (data: {
    college: string
    degree: string
    major: string
    graduation_year: number
    skills?: string[]
  }) => void
  initialData?: {
    details?: {
      college?: string
      degree?: string
      major?: string
      graduation_year?: number
    }
    skills?: string[]
  }
}

const degreeOptions = ['Bachelor\'s', 'Master\'s', 'PhD', 'Associate\'s', 'Other']

export default function Step_StudentProfile({ onComplete, initialData }: Step_StudentProfileProps) {
  const [college, setCollege] = useState(initialData?.details?.college || '')
  const [degree, setDegree] = useState(initialData?.details?.degree || '')
  const [major, setMajor] = useState(initialData?.details?.major || '')
  const [graduationYear, setGraduationYear] = useState(
    initialData?.details?.graduation_year?.toString() || ''
  )
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>(initialData?.skills || [])

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear + i)

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()])
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (college.trim() && degree && major.trim() && graduationYear) {
      onComplete({
        college: college.trim(),
        degree,
        major: major.trim(),
        graduation_year: parseInt(graduationYear),
        skills: skills.length > 0 ? skills : undefined,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="college">College/University</Label>
        <Input
          id="college"
          type="text"
          placeholder="University of Example"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="degree">Degree</Label>
        <Select value={degree} onValueChange={setDegree} required>
          <SelectTrigger id="degree">
            <SelectValue placeholder="Select your degree" />
          </SelectTrigger>
          <SelectContent>
            {degreeOptions.map((deg) => (
              <SelectItem key={deg} value={deg}>
                {deg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="major">Major</Label>
        <Input
          id="major"
          type="text"
          placeholder="Computer Science"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="graduationYear">Expected Graduation Year</Label>
        <Select value={graduationYear} onValueChange={setGraduationYear} required>
          <SelectTrigger id="graduationYear">
            <SelectValue placeholder="Select graduation year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Skills (Optional)</Label>
        <div className="flex gap-2">
          <Input
            id="skills"
            type="text"
            placeholder="e.g., Python, React, SQL"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddSkill()
              }
            }}
          />
          <Button type="button" onClick={handleAddSkill} variant="outline">
            Add
          </Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!college.trim() || !degree || !major.trim() || !graduationYear}
      >
        Complete Setup
      </Button>
    </form>
  )
}

