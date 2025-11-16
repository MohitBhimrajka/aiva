'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Step3_ResumeUploadProps {
  onSkip?: () => void
}

export default function Step3_ResumeUpload({ onSkip }: Step3_ResumeUploadProps) {
  const { accessToken, refreshUser } = useAuth()
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    matches: string[]
    discrepancies: string[]
  } | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    setUploadedFile(file)
    setIsUploading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiUrl}/api/users/me/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        await refreshUser()
        
        // Store verification results if available
        if (data.verification) {
          setVerificationResult(data.verification)
        }
        
        // Show appropriate message based on verification
        if (data.verification?.discrepancies?.length > 0) {
          toast.warning('Resume uploaded, but some information doesn\'t match your profile. Please review.', {
            duration: 7000,
          })
          // Don't auto-redirect if there are discrepancies - let user choose
        } else if (data.verification?.matches?.length > 0) {
          toast.success('Resume uploaded and verified successfully!', {
            duration: 5000,
          })
          // Auto-redirect after 3 seconds if no discrepancies
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        } else {
          toast.success('Resume uploaded and analyzed successfully!')
          // Auto-redirect after 2 seconds if no verification data
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        }
        
        setIsComplete(true)
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Failed to upload resume')
        setUploadedFile(null)
      }
    } catch (error) {
      console.error('Error uploading resume:', error)
      toast.error('An error occurred while uploading your resume')
      setUploadedFile(null)
    } finally {
      setIsUploading(false)
    }
  }, [accessToken, refreshUser, router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading || isComplete,
  })

  const handleContinue = () => {
    router.push('/dashboard')
  }

  const handleReupload = () => {
    setVerificationResult(null)
    setUploadedFile(null)
    setIsComplete(false)
  }

  if (isComplete) {
    const hasDiscrepancies = verificationResult?.discrepancies && verificationResult.discrepancies.length > 0
    
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        {hasDiscrepancies ? (
          <>
            <AlertCircle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-center">Resume Verification Warning</h3>
            <p className="text-center text-muted-foreground max-w-md">
              We found some discrepancies between your resume and your profile. Please review and upload the correct resume.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Resume Uploaded Successfully!</h3>
          </>
        )}
        
        {/* Show verification results if available */}
        {verificationResult && (
          <div className="w-full max-w-lg space-y-4">
            {verificationResult.matches.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900 mb-2">Verified Matches</h4>
                      <ul className="space-y-1">
                        {verificationResult.matches.map((match, idx) => (
                          <li key={idx} className="text-sm text-green-800">• {match}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {verificationResult.discrepancies.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-900 mb-2">Discrepancies Found</h4>
                      <p className="text-xs text-yellow-800 mb-2">
                        The following information in your resume doesn&apos;t match your profile:
                      </p>
                      <ul className="space-y-1">
                        {verificationResult.discrepancies.map((discrepancy, idx) => (
                          <li key={idx} className="text-sm text-yellow-800">• {discrepancy}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-3 w-full max-w-lg">
          {hasDiscrepancies && (
            <Button
              variant="outline"
              onClick={handleReupload}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Correct Resume
            </Button>
          )}
          <Button
            onClick={handleContinue}
            className={hasDiscrepancies ? "flex-1" : "w-full"}
            variant={hasDiscrepancies ? "default" : "default"}
          >
            {hasDiscrepancies ? "Continue Anyway" : "Continue to Dashboard"}
          </Button>
        </div>
        
        {!hasDiscrepancies && (
          <p className="text-sm text-muted-foreground">Redirecting automatically in a few seconds...</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Upload Your Resume</h3>
        <p className="text-sm text-muted-foreground">
          Upload your resume in PDF format. We&apos;ll analyze it and provide personalized insights.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Uploading and analyzing your resume...</p>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col items-center">
                <FileText className="h-12 w-12 text-primary mb-4" />
                <p className="font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-2">Processing...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-2">
                  {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume here'}
                </p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-2">PDF files only</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Your resume will be analyzed using AI to provide personalized career insights.
        </p>
        {onSkip && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={isUploading || isComplete}
            className="text-xs"
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  )
}

