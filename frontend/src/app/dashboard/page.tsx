'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Code, Briefcase, BarChart2, AlertCircle, Loader2 } from "lucide-react"
import { motion } from 'framer-motion'
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import AnimatedPage from '@/components/AnimatedPage' // <-- Import
import { SessionHistory } from '@/components/SessionHistory'

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

// --- NEW Animation Variants for Header ---
const headerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15, // Stagger the title and description
    },
  },
};

const headerItemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
        type: 'spring',
        stiffness: 100
    }
  },
};

export default function DashboardPage() {
  const { user, logout, accessToken } = useAuth()
  const router = useRouter()

  const [roles, setRoles] = useState<GroupedRoles>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // ... (rest of the function is the same)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ role_id: selectedRole.id, difficulty: selectedDifficulty })
    });
    if (!response.ok) {
        toast.error('Could not start the session. Please try again.');
        setIsStartingSession(false);
        return;
    }
    const sessionData = await response.json();
    router.push(`/interview/${sessionData.id}`);
  };

  const openModal = (role: Role) => {
    setSelectedRole(role);
    setSelectedDifficulty('');
  };
  
  const closeModal = () => {
    setSelectedRole(null);
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
    <AnimatedPage className="w-full max-w-5xl mx-auto p-4 md:p-8">
      {/* --- MODIFIED HEADER with gradient and animations --- */}
      <header className="relative flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4 p-6 rounded-lg overflow-hidden bg-card border">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent -z-10" />
         <motion.div variants={headerVariants} initial="hidden" animate="visible">
            <motion.h1 variants={headerItemVariants} className="text-3xl font-bold text-gray-900">
                AIVA Dashboard
            </motion.h1>
            <motion.p variants={headerItemVariants} className="text-muted-foreground">
                Welcome back, {user?.email}! Let&apos;s practice with your AI Virtual Assistant.
            </motion.p>
        </motion.div>
        <Button onClick={logout} variant="outline">Logout</Button>
      </header>

      <main className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Start a New Session</h2>
          {renderContent()}
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Session History</h2>
          <SessionHistory />
        </div>
      </main>

      <Dialog open={!!selectedRole} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Interview: {selectedRole?.name}</DialogTitle>
            <DialogDescription>
              Please select a difficulty level for your practice session.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
    </AnimatedPage>
  )
}
