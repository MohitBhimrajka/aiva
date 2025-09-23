'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import AnimatedPage from '@/components/AnimatedPage' // <-- Import
import { BrandLogo } from '@/components/BrandLogo' // <-- Import

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.")
      setIsLoading(false)
      return
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${apiUrl}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        toast.success("Account created successfully!")
        router.push('/login?signup=success')
      } else {
        const data = await response.json()
        toast.error(data.detail || 'Failed to create account. Please try again.')
      }
    } catch {
      toast.error('An unexpected error occurred. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatedPage className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <BrandLogo />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join AIVA</CardTitle>
          <CardDescription>Create your account to start practicing with our AI Virtual Assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Login here
            </Link>
          </p>
        </CardContent>
      </Card>
    </AnimatedPage>
  )
}
