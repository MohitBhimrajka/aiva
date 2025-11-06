'use client'

import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Loader2, Play, Send } from 'lucide-react'

// Define interfaces for clarity
interface TestCase {
  stdin: string;
  expected_output: string;
}

interface CodingProblem {
  id: number;
  title: string;
  description: string;
  starter_code: string | null;
  test_cases: TestCase[];
}

interface CodingResults {
  submitted?: boolean;
  code?: string;
  [key: string]: unknown;
}

interface Props {
  problem: CodingProblem;
  onSubmit: (code: string, results: CodingResults) => void;
}

export function CodingChallengeUI({ problem, onSubmit }: Props) {
  const [code, setCode] = useState(problem.starter_code || '');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const { accessToken } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  const handleRun = async () => {
    if (!problem.test_cases || problem.test_cases.length === 0) {
      toast.error('No test cases available.');
      return;
    }

    setIsRunning(true);
    setOutput('Running your code...');
    try {
      const response = await fetch(`${apiUrl}/api/coding/run`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          language_id: 71, // Python
          source_code: code,
          stdin: problem.test_cases[0].stdin, // Run against the first test case
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to run code' }));
        throw new Error(errorData.detail || 'Failed to run code');
      }

      const result = await response.json();
      if (result.stdout) {
        setOutput(`Output:\n${result.stdout}`);
      } else if (result.stderr) {
        setOutput(`Error:\n${result.stderr}`);
      } else if (result.compile_output) {
        setOutput(`Compilation Error:\n${result.compile_output}`);
      } else {
        setOutput(`Status: ${result.status?.description || 'Unknown'}\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run code.';
      toast.error(errorMessage);
      setOutput(`Error: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = () => {
    if (code.trim().length === 0) {
      toast.warning('Please write some code before submitting.');
      return;
    }
    const results: CodingResults = { submitted: true, code: code };
    onSubmit(code, results);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[80vh]">
      {/* Problem Description */}
      <div className="flex flex-col p-4 border rounded-lg bg-card">
        <h2 className="text-2xl font-bold mb-4">{problem.title}</h2>
        <div className="whitespace-pre-wrap flex-grow overflow-y-auto text-sm">
          {problem.description}
        </div>
      </div>

      {/* Code Editor & Output */}
      <div className="flex flex-col gap-4">
        <div className="flex-shrink-0">
          <CodeMirror
            value={code}
            height="50vh"
            extensions={[python()]}
            onChange={(value) => setCode(value)}
            className="rounded-lg overflow-hidden border"
          />
        </div>
        <div className="flex-grow min-h-[150px] p-4 border rounded-lg bg-gray-900 text-white font-mono text-sm overflow-y-auto">
          <pre className="whitespace-pre-wrap">{output || 'Click "Run Code" to see the output here.'}</pre>
        </div>
        <div className="flex gap-4">
          <Button onClick={handleRun} disabled={isRunning} className="gap-2">
            {isRunning ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
            Run Code
          </Button>
          <Button onClick={handleSubmit} variant="secondary" className="gap-2">
            <Send className="h-4 w-4" />
            Submit & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

