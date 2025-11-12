'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'

interface User {
  id: number
  email: string
  role: string // Keep this from Version A
  // --- ADDED FROM VERSION B ---
  first_name?: string
  last_name?: string
  primary_goal?: string
  college?: string
  degree?: string
  major?: string
  graduation_year?: number
  skills?: string[]
  raw_resume_text?: string
  resume_summary?: string
  resume_score?: number
  resume_analysis?: { strengths: string[]; improvements: string[] }
  role_matches?: { role_name: string; match_score: number; justification: string }[]
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  login: (token: string, redirectTo?: string) => void
  logout: () => void
  isLoading: boolean
  refreshUser: () => Promise<void> // <-- Add this line
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start loading to check auth state
  const router = useRouter()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Function to fetch user details from backend (e.g., /users/me endpoint)
  const fetchUser = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const userData = await response.json()
        // Decode JWT to get role and add it to user object
        const decodedToken: { sub: string; role: string } = jwtDecode(token)
        setUser({ ...userData, role: decodedToken.role || 'user' })
        return true // User data fetched successfully
      } else if (response.status === 401) {
        // Token is expired or invalid - this is expected, don't log as error
        // Silently return false so the token can be cleared
        return false
      } else {
        // Other errors (500, 404, etc.) should be logged
        console.error('Failed to fetch user data:', response.status, response.statusText)
        return false
      }
    } catch (error) {
      console.error('Network error while fetching user:', error)
      return false
    }
  }, [apiUrl])

  // On initial load, try to retrieve token from localStorage and validate it
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken')
    if (storedToken) {
      setAccessToken(storedToken)
      fetchUser(storedToken).then(isValid => {
        if (!isValid) {
          // If token is invalid, clear it
          localStorage.removeItem('accessToken')
          setAccessToken(null)
          setUser(null)
        }
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [fetchUser])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    setAccessToken(null)
    setUser(null)
    router.push('/login')
  }, [router])

  const login = useCallback(async (token: string, redirectTo: string = '/dashboard') => {
    localStorage.setItem('accessToken', token) // Store in localStorage (for simplicity; ideally httpOnly cookies)
    setAccessToken(token)
    const success = await fetchUser(token)
    if (success) {
      router.push(redirectTo)
    } else {
      // If fetching user failed after login, something is wrong with the token or backend
      console.error("Login successful, but couldn't fetch user data.")
      logout() // Force logout
    }
  }, [fetchUser, router, logout])

  // --- ADD THIS FUNCTION ---
  const refreshUser = useCallback(async () => {
    if (accessToken) {
      await fetchUser(accessToken)
    }
  }, [accessToken, fetchUser])
  // --- END ADD ---

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
