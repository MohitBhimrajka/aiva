'use client'

import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Play, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import ReactMarkdown from 'react-markdown'

interface CodingProblem {
  id: number
  title: string
  description: string
  starter_code: string | null
  test_cases: Array<{ stdin: string; expected_output: string }>
}

interface CodingChallengeUIProps {
  problem: CodingProblem
  onSubmit: (code: string, results: Record<string, unknown>) => void
}

// Judge0 language IDs
const LANGUAGE_IDS: Record<string, number> = {
  python: 92, // Python 3
  javascript: 63, // Node.js
  java: 62, // Java
  cpp: 54, // C++
}

export default function CodingChallengeUI({ problem, onSubmit }: CodingChallengeUIProps) {
  const { accessToken } = useAuth()
  const [code, setCode] = useState(problem.starter_code || '')
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResults, setTestResults] = useState<Array<{
    testCase: number
    passed: boolean
    output?: string
    expected?: string
    error?: string
  }>>([])

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error('Please write some code before running')
      return
    }

    setIsRunning(true)
    setTestResults([])

    try {
      // Run each test case
      const results = []
      for (let i = 0; i < problem.test_cases.length; i++) {
        const testCase = problem.test_cases[i]
        
        const response = await fetch(`${apiUrl}/api/coding/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            language_id: LANGUAGE_IDS.python, // Default to Python for now
            source_code: code,
            stdin: testCase.stdin
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Failed to run code' }))
          throw new Error(errorData.detail || 'Failed to run code')
        }

        const result = await response.json()
        
        // Check if the output matches expected
        const output = result.stdout || result.stderr || ''
        const passed = output.trim() === testCase.expected_output.trim()
        
        results.push({
          testCase: i + 1,
          passed,
          output: output.trim(),
          expected: testCase.expected_output.trim(),
          error: result.stderr || (result.status?.description || null)
        })
      }

      setTestResults(results)
      
      const allPassed = results.every(r => r.passed)
      if (allPassed) {
        toast.success('All test cases passed!')
      } else {
        toast.warning(`${results.filter(r => r.passed).length}/${results.length} test cases passed`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run code'
      toast.error(errorMessage)
      setTestResults([{
        testCase: 1,
        passed: false,
        error: errorMessage
      }])
    } finally {
      setIsRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error('Please write some code before submitting')
      return
    }

    setIsSubmitting(true)
    try {
      // Calculate results summary
      const results = {
        code,
        testResults: testResults.map(r => ({
          testCase: r.testCase,
          passed: r.passed,
          output: r.output,
          expected: r.expected
        })),
        allPassed: testResults.length > 0 && testResults.every(r => r.passed),
        totalTests: problem.test_cases.length,
        passedTests: testResults.filter(r => r.passed).length
      }

      onSubmit(code, results)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{problem.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{problem.description}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Solution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <CodeMirror
              value={code}
              height="400px"
              extensions={[python()]}
              onChange={(value) => setCode(value)}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false
              }}
            />
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    result.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {result.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      Test Case {result.testCase}: {result.passed ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                  {result.error && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                      Error: {result.error}
                    </div>
                  )}
                  {result.output && (
                    <div className="mt-2 space-y-1 text-sm">
                      <div>
                        <span className="font-medium">Output:</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
                          {result.output}
                        </pre>
                      </div>
                      {!result.passed && result.expected && (
                        <div>
                          <span className="font-medium">Expected:</span>
                          <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
                            {result.expected}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleRunCode}
          disabled={isRunning || isSubmitting}
          variant="outline"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Code
            </>
          )}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isRunning}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit & Continue'
          )}
        </Button>
      </div>
    </div>
  )
}

