'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import AnimatedPage from '@/components/AnimatedPage'
import { BrandLogo } from '@/components/BrandLogo'
import Step1_ProfileBasics from '@/components/onboarding/Step1_ProfileBasics'
import Step2_SetGoal from '@/components/onboarding/Step2_SetGoal'
import Step_StudentProfile from '@/components/onboarding/Step_StudentProfile'
import Step3_ResumeUpload from '@/components/onboarding/Step3_ResumeUpload'

interface OnboardingData {
  first_name: string
  last_name: string
  primary_goal: string
  details?: {
    college: string
    degree: string
    major: string
    graduation_year: number
  }
  skills?: string[]
}

export default function OnboardingPage() {
  const { accessToken, refreshUser } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  const isStudentRef = useRef(false) // Use ref to track immediately
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    first_name: '',
    last_name: '',
    primary_goal: '',
  })
  
  // Helper function to check if user is a student based on primary_goal
  const checkIsStudent = () => {
    const result = onboardingData.primary_goal === "I'm a student"
    console.log('checkIsStudent - primary_goal:', onboardingData.primary_goal, 'result:', result)
    return result
  }
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('State updated - currentStep:', currentStep, 'isStudent:', isStudent, 'isStudentRef:', isStudentRef.current, 'primary_goal:', onboardingData.primary_goal)
  }, [currentStep, isStudent, onboardingData.primary_goal])

  const totalSteps = 4

  const handleStep1Complete = (data: { first_name: string; last_name: string }) => {
    setOnboardingData((prev) => ({ ...prev, ...data }))
    setCurrentStep(2)
  }

  const handleStep2Complete = async (data: { primary_goal: string; isStudent: boolean }) => {
    console.log('Step2 Complete - Data received:', data)
    const updatedData = { ...onboardingData, primary_goal: data.primary_goal }
    
    // Update ref immediately (synchronous)
    isStudentRef.current = data.isStudent
    
    // Update state - use functional updates to ensure we have the latest state
    setOnboardingData((prev) => ({ ...prev, primary_goal: data.primary_goal }))
    setIsStudent(data.isStudent)
    console.log('isStudent set to:', data.isStudent, 'isStudentRef set to:', isStudentRef.current, 'primary_goal:', data.primary_goal)
    
    // Use the data directly instead of relying on state updates
    if (data.isStudent) {
      console.log('Moving to step 3 (Student Profile)')
      // Set both states and step together
      setOnboardingData((prev) => ({ ...prev, primary_goal: data.primary_goal }))
      setIsStudent(true)
      isStudentRef.current = true
      setCurrentStep(3)
    } else {
      console.log('Skipping student profile, moving to step 4 (Resume Upload)')
      // Skip student profile, save profile data first, then go to resume upload
      await saveProfileData(updatedData)
      setCurrentStep(4)
    }
  }

  const handleStep3Complete = async (data: {
    college: string
    degree: string
    major: string
    graduation_year: number
    skills?: string[]
  }) => {
    const updatedData = {
      ...onboardingData,
      details: {
        college: data.college,
        degree: data.degree,
        major: data.major,
        graduation_year: data.graduation_year,
      },
      skills: data.skills,
    }
    setOnboardingData(updatedData)
    // After student profile, save profile data first, then go to resume upload
    await saveProfileData(updatedData)
    setCurrentStep(4)
  }

  const saveProfileData = async (profileData: OnboardingData, redirectToDashboard = false) => {
    if (!accessToken) {
      toast.error('You must be logged in to complete onboarding.')
      router.push('/login')
      return false
    }

    setIsSubmitting(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${apiUrl}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          primary_goal: profileData.primary_goal,
          details: profileData.details,
          skills: profileData.skills,
        }),
      })

      if (response.ok) {
        await refreshUser()
        if (redirectToDashboard) {
          toast.success('Profile updated successfully!')
          router.push('/dashboard')
        }
        return true
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Failed to update profile. Please try again.')
        return false
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('An unexpected error occurred. Please check your connection.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    // Check ref first (immediate), then state, then primary_goal
    const userIsStudent = isStudentRef.current || isStudent || checkIsStudent()
    console.log('renderStep - currentStep:', currentStep, 'isStudent:', isStudent, 'isStudentRef:', isStudentRef.current, 'userIsStudent:', userIsStudent, 'primary_goal:', onboardingData.primary_goal)
    switch (currentStep) {
      case 1:
        return <Step1_ProfileBasics onComplete={handleStep1Complete} initialData={onboardingData} />
      case 2:
        return <Step2_SetGoal onComplete={handleStep2Complete} initialData={onboardingData} />
      case 3:
        // Conditionally render student profile or resume upload
        // Check ref first (most reliable), then state, then primary_goal as fallback
        console.log('Rendering step 3 - userIsStudent:', userIsStudent, 'isStudentRef:', isStudentRef.current)
        if (userIsStudent) {
          console.log('Showing Student Profile component')
          return <Step_StudentProfile onComplete={handleStep3Complete} initialData={onboardingData} />
        }
        // For all other goals, go to resume upload
        console.log('Showing Resume Upload component (not a student)')
        return <Step3_ResumeUpload onSkip={() => router.push('/dashboard')} />
      case 4:
        // This is the fallback for students after they fill their profile
        return <Step3_ResumeUpload onSkip={() => router.push('/dashboard')} />
      default:
        return null
    }
  }

  return (
    <AnimatedPage className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <BrandLogo />
        </div>

        <Card>
          <CardHeader>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <CardTitle>Step {currentStep}: {currentStep === 1 ? 'Welcome to AIVA!' : currentStep === 2 ? 'Set Your Goal' : currentStep === 3 ? ((isStudentRef.current || isStudent || checkIsStudent()) ? 'Student Profile' : 'Upload Resume') : 'Upload Resume'}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {currentStep} of {totalSteps}
                </span>
              </div>
              <Progress value={(currentStep / totalSteps) * 100} className="w-full" />
            </div>
            <CardDescription>
              {currentStep === 1 && "Let's start by getting to know you."}
              {currentStep === 2 && 'What brings you to AIVA?'}
              {currentStep === 3 && ((isStudentRef.current || isStudent || checkIsStudent()) ? 'Tell us about your academic background.' : 'Upload your resume to get started.')}
              {currentStep === 4 && 'Upload your resume to get started.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Saving your profile...</p>
              </div>
            ) : (
              renderStep()
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}

