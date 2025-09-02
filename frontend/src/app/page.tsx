'use client'

import { useState, useEffect } from 'react'

interface BackendStatus {
  isWorking: boolean
  message: string
  details?: string
  timestamp?: string
}

export default function HealthCheck() {
  const [status, setStatus] = useState<BackendStatus>({
    isWorking: false,
    message: 'Checking backend...'
  })
  const [isLoading, setIsLoading] = useState(true)

  const checkBackend = async () => {
    setIsLoading(true)
    setStatus({ isWorking: false, message: 'Checking backend...' })

    try {
      // Try to reach the backend health endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/health`)
      
      if (response.ok) {
        const data = await response.json()
        setStatus({
          isWorking: true,
          message: 'Backend is working! ✅',
          details: JSON.stringify(data, null, 2),
          timestamp: new Date().toLocaleString()
        })
      } else {
        setStatus({
          isWorking: false,
          message: `Backend responded with error: ${response.status} ${response.statusText}`,
          details: `HTTP ${response.status}`,
          timestamp: new Date().toLocaleString()
        })
      }
    } catch (error) {
      setStatus({
        isWorking: false,
        message: 'Backend is not responding ❌',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toLocaleString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Check backend on page load
  useEffect(() => {
    checkBackend()
  }, [])

  const getStatusClass = () => {
    if (isLoading) return 'loading'
    return status.isWorking ? 'success' : 'error'
  }

  return (
    <div className="container">
      <h1>Procurement Backend Health Check</h1>
      
      <div className={`status ${getStatusClass()}`}>
        {status.message}
      </div>

      {status.details && (
        <div className="details">
          <strong>Response:</strong>
          {status.details}
        </div>
      )}

      {status.timestamp && (
        <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          Last checked: {status.timestamp}
        </div>
      )}

      <button 
        onClick={checkBackend} 
        disabled={isLoading}
      >
        {isLoading ? 'Checking...' : 'Check Again'}
      </button>
    </div>
  )
}
