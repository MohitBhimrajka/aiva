'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, Download, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import DiffMatchPatch from 'diff-match-patch'
import { Alert, AlertTitle } from '@/components/ui/alert'

// This is our new "Google Docs" style diff renderer
function renderUnifiedDiff(originalText: string, improvedText: string) {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(originalText, improvedText);
    dmp.diff_cleanupSemantic(diffs);

    return (
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {diffs.map(([op, text], i) => {
                if (op === 0) return <span key={i}>{text}</span>; // EQUAL
                if (op === -1) return <del key={i} className="bg-red-200/50 rounded px-1 text-red-800">{text}</del>; // DELETE
                if (op === 1) return <ins key={i} className="bg-green-200/50 rounded px-1 text-green-800 no-underline font-medium">{text}</ins>; // INSERT
            })}
        </pre>
    );
}

interface ResumeImproverModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    rawResumeText: string;
    resumeSummary: string; // We need this for the fallback check
    improvements: string[];
}

export function ResumeImproverModal({ isOpen, onOpenChange, rawResumeText, resumeSummary, improvements }: ResumeImproverModalProps) {
    const { accessToken } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [improvedText, setImprovedText] = useState<string | null>(null)

    // Determine if we're using the fallback summary or the real full text
    const isUsingFullText = rawResumeText && rawResumeText.length > (resumeSummary?.length || 0);
    const textToImprove = isUsingFullText ? rawResumeText : resumeSummary;

    const handleImprove = async () => {
        setIsLoading(true);
        setImprovedText(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/profile/improve-resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ raw_text: textToImprove, improvements })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);
            setImprovedText(data.improved_text);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to improve resume.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleExport = async () => {
        if (!improvedText) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/profile/export-resume-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ improved_text: improvedText, template_id: 'classic' })
            });
            if (!response.ok) throw new Error("Failed to generate PDF.");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "AIVA_Improved_Resume.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch(err) {
            toast.error(err instanceof Error ? err.message : "Failed to export PDF.");
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-8">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-2xl flex items-center gap-3"><Sparkles /> AI Resume Co-Pilot</DialogTitle>
                    <DialogDescription>
                        Click &quot;Generate Suggestions&quot; to see AI improvements. Added text is <span className="text-green-600 bg-green-100 px-1 rounded">green</span>, and removed text is <span className="text-red-600 bg-red-100 px-1 rounded line-through">red</span>.
                    </DialogDescription>
                </DialogHeader>

                {!isUsingFullText && (
                    <Alert variant="destructive" className="mt-4 flex-shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Note: You&apos;re viewing the AI summary. For the best edit-by-edit comparison, please re-upload your resume.</AlertTitle>
                    </Alert>
                )}
                
                {/* --- MODIFICATION: Unified Single Panel View --- */}
                <div className="flex-grow border rounded-md p-4 overflow-y-auto bg-white mt-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mr-4"/>Generating improvements...</div>
                    ) : improvedText ? (
                        renderUnifiedDiff(textToImprove, improvedText)
                    ) : (
                        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{textToImprove}</pre>
                    )}
                </div>

                <div className="flex justify-between items-center pt-6 border-t mt-4 flex-shrink-0">
                    <p className="text-xs text-muted-foreground">Review the changes and export your improved resume when ready.</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={handleImprove} disabled={isLoading} className="gap-2">
                            {isLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={16}/>}
                            Generate Suggestions
                        </Button>
                        <Button onClick={handleExport} disabled={!improvedText} className="gap-2">
                            <Download size={16}/>
                            Export to PDF
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
