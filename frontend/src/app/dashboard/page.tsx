'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Code, Briefcase, BarChart2, AlertCircle, Loader2, ArrowBigRightDash } from "lucide-react"
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import AnimatedPage from '@/components/AnimatedPage'

interface Role {
  id: number;
  name: string;
  category: string;
}

interface GroupedRoles {
  [category: string]: Role[];
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
  const { accessToken, user } = useAuth()
  const router = useRouter()

  const [roles, setRoles] = useState<GroupedRoles>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  const [companyName, setCompanyName] = useState<string>('')
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSpotlight, setShowSpotlight] = useState(false)

  // Check if we came from onboarding to show the spotlight
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new_user') === 'true') {
      setShowSpotlight(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, []);

  // Redirect to onboarding if user is a student but missing student profile data
  useEffect(() => {
    if (user?.primary_goal === 'student' && (!user.college || !user.major)) {
      router.push('/onboarding?step=3');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!accessToken) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/roles`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch roles. The server might be down.');
        
        const data: Role[] = await response.json();
        if (data.length === 0) {
            setError("No interview roles found in the database. Please run the seeding script.");
            return;
        }
        
        const grouped = data.reduce((acc, role) => {
          acc[role.category] = acc[role.category] || [];
          acc[role.category].push(role);
          return acc;
        }, {} as GroupedRoles);

        setRoles(grouped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoles();
  }, [accessToken]);

  const handleStartSession = async () => {
    if (!selectedRole || !selectedDifficulty || !accessToken) return;
    setIsStartingSession(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ 
          role_id: selectedRole.id, 
          difficulty: selectedDifficulty,
          company_name: companyName || undefined
        })
    });
    if (!response.ok) {
        toast.error('Could not start the session. Please try again.');
        setIsStartingSession(false);
        return;
    }
    const sessionData = await response.json();
    router.push(`/interview/${sessionData.id}/ready`);
  };

  const openModal = (role: Role) => {
    setSelectedRole(role);
    setSelectedDifficulty('');
    setCompanyName('');
  };
  
  const closeModal = () => {
    setSelectedRole(null);
    setCompanyName('');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Roles</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <motion.div
        className="grid gap-6"
        initial="hidden"
        animate="visible"
        variants={{
            visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        {Object.entries(roles).map(([category, roleList]) => (
          <motion.div
            key={category}
            variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1 }
            }}
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>Select a role in the {category} field to practice.</CardDescription>
                </div>
                {getCategoryIcon(category)}
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roleList.map((role) => (
                  <Button key={role.id} variant="outline" className="justify-start p-4 h-auto" onClick={() => openModal(role)}>
                    <div className="text-left">
                      <p className="font-semibold">{role.name}</p>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  return (
    <AnimatedPage className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Start a New Session</h1>
      <p className="text-muted-foreground mb-8">Select a role and difficulty to begin your practice interview.</p>
      
      {renderContent()}

      <Dialog open={!!selectedRole} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Interview: {selectedRole?.name}</DialogTitle>
            <DialogDescription>
              Select a difficulty level. Optionally, add a company name for tailored questions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 grid gap-4">
            <div className="space-y-2">
              <Label>Difficulty</Label>
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
            </div>
            <div className="space-y-2">
              <Label>Target Company (Optional)</Label>
              <Input 
                placeholder="e.g., Google, Amazon" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleStartSession}
              disabled={!selectedDifficulty || isStartingSession}
            >
              {isStartingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : 'Start Interview'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- NEW: Popover Spotlight --- */}
      <AnimatePresence>
        {showSpotlight && (
          <div className="fixed top-1 left-1/2 -translate-x-1/2 mt-16 z-50">
            <Popover open={true}>
              <PopoverTrigger asChild>
                {/* This is an invisible trigger positioned near the real button */}
                <div className="absolute top-0 right-[-100px] w-24 h-10" />
              </PopoverTrigger>
              <PopoverContent side="bottom" className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none flex items-center gap-2"><ArrowBigRightDash/> First step: Career Hub</h4>
                    <p className="text-sm text-muted-foreground">
                      Your resume is ready. Click on the &quot;Career Hub&quot; in the header to get your AI analysis and find your best role matches.
                    </p>
                  </div>
                  <Button onClick={() => setShowSpotlight(false)} size="sm">Got it</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </AnimatePresence>
    </AnimatedPage>
  )
}
