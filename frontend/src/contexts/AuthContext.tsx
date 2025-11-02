'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'

interface User {
  id: number
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  login: (token: string, redirectTo?: string) => void
  logout: () => void
  isLoading: boolean
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
      } else {
        // Token might be invalid or expired
        console.error('Failed to fetch user data with existing token:', response.statusText)
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

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isLoading }}>
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
