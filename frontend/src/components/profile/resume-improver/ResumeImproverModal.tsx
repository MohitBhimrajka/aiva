'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Download, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import DiffViewer from './DiffViewer'

interface ResumeImproverModalProps {
  isOpen: boolean
  onClose: () => void
  resumeText: string
}

export default function ResumeImproverModal({ isOpen, onClose, resumeText }: ResumeImproverModalProps) {
  const { accessToken } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [improvedText, setImprovedText] = useState<string | null>(null)
  const [changes, setChanges] = useState<string[]>([])

  const handleGenerate = async () => {
    if (!accessToken) {
      toast.error('You must be logged in to improve your resume')
      return
    }

    setIsGenerating(true)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${apiUrl}/api/profile/improve-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        setImprovedText(data.improved_text)
        setChanges(data.changes || [])
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || 'Failed to generate improvements')
      }
    } catch (error) {
      console.error('Error improving resume:', error)
      toast.error('An error occurred while improving your resume')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportPDF = async () => {
    if (!improvedText) return

    try {
      // Use fpdf2 on the backend to generate PDF
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/profile/export-improved-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ improved_text: improvedText }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'improved-resume.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('PDF exported successfully!')
      } else {
        toast.error('Failed to export PDF')
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('An error occurred while exporting PDF')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resume Improver</DialogTitle>
          <DialogDescription>
            Get AI-powered suggestions to improve your resume
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!improvedText ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-6">
                Click the button below to generate AI-powered improvements for your resume
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Suggestions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {changes.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Key Changes:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {changes.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DiffViewer original={resumeText} improved={improvedText} />

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => {
                  setImprovedText(null)
                  setChanges([])
                }}>
                  Generate New Suggestions
                </Button>
                <Button onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export to PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

