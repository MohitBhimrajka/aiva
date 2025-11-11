// frontend/src/app/dashboard/page.tsx

'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Code, Briefcase, BarChart2, AlertCircle, Loader2, History, Sparkles, Star, CalendarDays } from "lucide-react"
import { motion } from 'framer-motion'
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import AnimatedPage from '@/components/AnimatedPage'
import { OnboardingGuide } from '@/components/OnboardingGuide'
import { AnimatedCounter } from '@/components/AnimatedCounter'

// --- Interfaces ---
interface Role {
  id: number;
  name: string;
  category: string;
}

// --- ADD THIS NEW INTERFACE ---
interface Language {
  name: string;
  code: string;
}
// ----------------------------

interface GroupedRoles {
  [category:string]: Role[];
}

// --- Session History type for the "Practice Again" feature ---
interface SessionHistoryItem {
    session_id: number;
    role_id: number; // We'll need this to re-create the session
    role_name: string;
    difficulty: string;
    completed_at: string;
    average_score: number | null;
}

// Helper to get an icon based on category name
const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'engineering':
      return <Code className="h-6 w-6 text-muted-foreground" />;
    case 'product management':
      return <Briefcase className="h-6 w-6 text-muted-foreground" />;
    case 'data science':
      return <BarChart2 className="h-6 w-6 text-muted-foreground" />;
    default:
      return <Briefcase className="h-6 w-6 text-muted-foreground" />;
  }
};

export default function DashboardPage() {
  const { user, accessToken } = useAuth()
  const router = useRouter()

  const [roles, setRoles] = useState<GroupedRoles>({})
  // --- ADD THESE NEW STATE VARIABLES ---
  const [languages, setLanguages] = useState<Language[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  // ------------------------------------
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- NEW STATE FOR STATS & QUICK START ---
  const [lastSession, setLastSession] = useState<SessionHistoryItem | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  // --- NEW: Ref for the role selection grid ---
  const roleGridRef = useRef<HTMLDivElement>(null);

  // --- MODIFIED DATA FETCHING ---
  // We now fetch roles and session history in parallel for better performance.
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!accessToken) return;
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        // --- FETCH LANGUAGES IN PARALLEL ---
        const [rolesResponse, historyResponse, languagesResponse] = await Promise.all([
          fetch(`${apiUrl}/api/roles`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(`${apiUrl}/api/sessions/history`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(`${apiUrl}/api/languages`) // No auth needed for this
        ]);
        // ------------------------------------

        // Handle roles
        if (!rolesResponse.ok) throw new Error('Failed to fetch roles.');
        const rolesData: Role[] = await rolesResponse.json();
        if (rolesData.length === 0) {
            setError("No interview roles found. An admin needs to add them.");
        } else {
            const grouped = rolesData.reduce((acc, role) => {
              acc[role.category] = acc[role.category] || [];
              acc[role.category].push(role);
              return acc;
            }, {} as GroupedRoles);
            setRoles(grouped);
        }

        // Handle history for stats
        if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            const historyList: SessionHistoryItem[] = historyData.history || [];
            
            if (historyList.length > 0) {
                setTotalSessions(historyList.length);
                setLastSession(historyList[0]); // The list is sorted by date descending
                
                // Calculate average score
                const validScores = historyList.map(s => s.average_score).filter(score => score !== null) as number[];
                if (validScores.length > 0) {
                    const sum = validScores.reduce((acc, score) => acc + score, 0);
                    setAverageScore(sum / validScores.length);
                }
            }
        }

        // --- ADD LOGIC TO HANDLE LANGUAGES ---
        if (!languagesResponse.ok) throw new Error('Failed to fetch languages.');
        const languagesData: Language[] = await languagesResponse.json();
        setLanguages(languagesData);
        // Set a default language (e.g., the first one in the list)
        if (languagesData.length > 0) {
            setSelectedLanguage(languagesData[0].code);
        }
        // -------------------------------------

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [accessToken]);

  const handleStartSession = async (roleId?: number, difficulty?: string) => {
    const finalRoleId = roleId ?? selectedRole?.id;
    const finalDifficulty = difficulty ?? selectedDifficulty;

    // --- UPDATE THE VALIDATION ---
    if (!finalRoleId || !finalDifficulty || !selectedLanguage || !accessToken) return;
    // ---------------------------

    setIsStartingSession(true);
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            // --- UPDATE THE REQUEST BODY ---
            body: JSON.stringify({
                role_id: finalRoleId,
                difficulty: finalDifficulty,
                language_code: selectedLanguage
            })
            // -----------------------------
        });
        if (!response.ok) throw new Error('Could not start the session.');
        const sessionData = await response.json();
        router.push(`/interview/${sessionData.id}`);
    } catch (err) {
        toast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
        setIsStartingSession(false);
    }
  };

  const openModal = (role: Role) => {
    setSelectedRole(role);
    setSelectedDifficulty('');
    // Reset to default language when opening modal
    if (languages.length > 0) {
        setSelectedLanguage(languages[0].code);
    }
  };
  
  const closeModal = () => setSelectedRole(null);

  // --- NEW: Keyboard navigation handler for the role grid ---
  const handleRoleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!roleGridRef.current) return;

    const focusableElements = Array.from(
      roleGridRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    );
    
    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.findIndex(el => el === document.activeElement);

    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentIndex >= 0 ? (currentIndex + 1) % focusableElements.length : 0;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        break;
      default:
        return;
    }
    
    if (nextIndex !== -1) {
      focusableElements[nextIndex].focus();
    }
  };

  // --- NEW: Loading state UI ---
  const renderLoading = () => (
    <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="animate-pulse"><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent></Card>
            <Card className="animate-pulse"><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent></Card>
            <Card className="animate-pulse"><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent></Card>
            <Card className="animate-pulse"><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/2"></div></CardContent></Card>
        </div>
        <Card className="animate-pulse h-64"><CardHeader><div className="h-6 bg-muted rounded w-1/4 mb-4"></div><div className="h-4 bg-muted rounded w-1/2"></div></CardHeader></Card>
    </div>
  );

  // --- NEW: Main dashboard content broken into a component ---
  const renderDashboardContent = () => {
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    
    // Get formatted last session date
    const lastSessionDate = lastSession 
      ? new Date(lastSession.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';
    
    return (
      <div className="space-y-8">
        {/* --- NEW: Stats & Quick Start Section --- */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Sessions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSessions}</div>
              <p className="text-xs text-muted-foreground">Completed interview practices</p>
            </CardContent>
          </Card>

          {/* Card 2: Average Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {averageScore > 0 ? <AnimatedCounter from={0} to={averageScore} /> : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Across all completed sessions</p>
            </CardContent>
          </Card>

          {/* Card 3: Last Session */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Session</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lastSessionDate}</div>
              <p className="text-xs text-muted-foreground">{lastSession ? lastSession.role_name : 'No sessions yet'}</p>
            </CardContent>
          </Card>

          {/* Card 4: Quick Start (now takes 1 column) */}
          {lastSession ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Quick Start</CardTitle>
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex flex-col items-start justify-center gap-2 pt-4">
                    <p className="text-sm font-semibold">Practice Again</p>
                    <p className="text-xs text-muted-foreground -mt-1">{lastSession.role_name} ({lastSession.difficulty})</p>
                    <Button 
                        onClick={() => handleStartSession(lastSession.role_id, lastSession.difficulty)}
                        disabled={isStartingSession}
                        size="sm"
                        className="w-full mt-2"
                    >
                         {isStartingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         Start
                    </Button>
                </CardContent>
              </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-full text-center p-6">
                <p className="text-sm text-muted-foreground">Complete a session to unlock Quick Start!</p>
              </CardContent>
            </Card>
          )}
        </section>
        
        {/* --- REFINED: Role Selection Section --- */}
        <section>
          <h2 id="new-session-heading" className="text-2xl font-bold tracking-tight mb-4">Start a New Session</h2>
            <div 
              ref={roleGridRef} 
              onKeyDown={handleRoleGridKeyDown} 
              role="region" 
              aria-labelledby="new-session-heading"
            >
              {Object.entries(roles).map(([category, roleList]) => (
                  <motion.div
                      key={category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="mb-6"
                  >
                      <Card className="shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                          <CardTitle>{category}</CardTitle>
                          <CardDescription>Select a role in the {category} field to practice.</CardDescription>
                          </div>
                          {getCategoryIcon(category)}
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roleList.map((role) => (
                          <Button key={role.id} variant="outline" className="justify-start p-4 h-auto text-left" onClick={() => openModal(role)}>
                              <div>
                                  <p className="font-semibold">{role.name}</p>
                              </div>
                          </Button>
                          ))}
                      </CardContent>
                      </Card>
                  </motion.div>
              ))}
            </div>
        </section>
      </div>
    )
  }

  return (
    <AnimatedPage>
      <OnboardingGuide />
      {/* --- NEW: Personalized Header --- */}
      <header className="mb-8">
        <h1>Welcome back, {user?.email.split('@')[0]}!</h1>
        <p className="text-muted-foreground">Ready to ace your next interview? Let&apos;s get started.</p>
      </header>

      <main>
        {isLoading ? renderLoading() : renderDashboardContent()}
      </main>

      {/* --- UPDATE THE DIALOG (MODAL) --- */}
      <Dialog open={!!selectedRole} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Interview: {selectedRole?.name}</DialogTitle>
            <DialogDescription>
              Please select your preferences for the practice session.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4"> {/* Add space-y-4 */}
            <Select onValueChange={setSelectedDifficulty} value={selectedDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Select a difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Junior">Junior</SelectItem>
                <SelectItem value="Mid-Level">Mid-Level</SelectItem>
                <SelectItem value="Senior">Senior</SelectItem>
              </SelectContent>
            </Select>

            {/* --- IMPROVED LANGUAGE SELECTOR WITH POPULAR LANGUAGES --- */}
            <Select onValueChange={setSelectedLanguage} value={selectedLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {/* Popular languages first */}
                {languages.filter(lang => 
                  ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'hi-IN', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-XA', 'ru-RU', 'pt-BR', 'it-IT'].includes(lang.code)
                ).map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    🌟 {lang.name}
                  </SelectItem>
                ))}
                
                {/* Separator */}
                {languages.length > 12 && (
                  <SelectItem value="separator" disabled className="text-xs text-muted-foreground">
                    ── More Languages ──
                  </SelectItem>
                )}
                
                {/* Other languages */}
                {languages.filter(lang => 
                  !['en-US', 'es-ES', 'fr-FR', 'de-DE', 'hi-IN', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-XA', 'ru-RU', 'pt-BR', 'it-IT'].includes(lang.code)
                ).map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* --------------------------------------------------------- */}

          </div>
          <DialogFooter>
            <Button
              onClick={() => handleStartSession()}
              // --- UPDATE THE DISABLED LOGIC ---
              disabled={!selectedDifficulty || !selectedLanguage || isStartingSession}
              // ---------------------------------
              variant="accent"
            >
              {isStartingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}
