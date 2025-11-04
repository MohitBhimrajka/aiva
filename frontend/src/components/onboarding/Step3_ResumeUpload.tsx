'use client'

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, UploadCloud, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Step3_ResumeUpload() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ show: boolean, message: string, file: File | null }>({ show: false, message: '', file: null });

  const handleSuccess = useCallback((isSkipped = false) => {
    if (!isSkipped) {
      toast.success("Resume analyzed successfully!");
    }
    // Add query param to trigger spotlight
    router.push('/dashboard?new_user=true');
  }, [router]);

  const processFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/users/me/resume`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Failed to upload resume.");
        }
        
        handleSuccess();
    } catch (error) {
        toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
        setFileName(null);
    } finally {
        setIsLoading(false);
    }
  }, [accessToken, handleSuccess]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        toast.error("Only PDF files are accepted.");
        return;
    }

    // --- VERIFICATION LOGIC ---
    try {
        const formData = new FormData();
        formData.append('file', file);

        const textResponse = await fetch('/api/proxy-pdf-parse', { method: 'POST', body: formData });
        if (!textResponse.ok) {
            throw new Error('Failed to parse PDF');
        }
        const { text } = await textResponse.json();

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const verifyResponse = await fetch(`${apiUrl}/api/profile/verify-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ resume_text: text })
        });
        const verifyData = await verifyResponse.json();

        if (!verifyData.is_match) {
            setVerification({ show: true, message: verifyData.reasoning, file });
        } else {
            await processFileUpload(file);
        }
    } catch {
        toast.error("Could not verify resume. Proceeding with upload.");
        await processFileUpload(file);
    }
  }, [accessToken, processFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Unlock Personalized Interviews</CardTitle>
        <CardDescription>Upload your resume (PDF) and AIVA will tailor questions to your experience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
            {...getRootProps()} 
            className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'}`}
        >
          <input {...getInputProps()} />
          <AnimatePresence mode="wait">
            {isLoading ? (
                <motion.div key="loading" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin h-8 w-8 text-primary"/>
                    <p>Analyzing &quot;{fileName}&quot;...</p>
                </motion.div>
            ) : fileName ? (
                <motion.div key="success" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-8 w-8"/>
                    <p>&quot;{fileName}&quot; uploaded!</p>
                </motion.div>
            ) : (
                <motion.div key="idle" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center gap-2">
                    <UploadCloud className="h-8 w-8 text-gray-500"/>
                    <p>Drag & drop your resume here, or click to select a file</p>
                    <p className="text-sm text-muted-foreground">PDF format only</p>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="text-center">
            <Button variant="link" onClick={() => handleSuccess(true)}>
                I&apos;ll do this later
            </Button>
        </div>
      </CardContent>
    </Card>

    {/* --- VERIFICATION MODAL --- */}
    <Dialog open={verification.show} onOpenChange={() => setVerification({ ...verification, show: false })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Please Verify Your Resume</DialogTitle>
          <DialogDescription>{verification.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setVerification({ show: false, message: '', file: null })}>Upload Different File</Button>
          <Button onClick={async () => {
            if (verification.file) await processFileUpload(verification.file);
            setVerification({ show: false, message: '', file: null });
          }}>Continue with This File</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

