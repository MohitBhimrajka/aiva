'use client'

import { useAuth } from "@/contexts/AuthContext"
import AnimatedPage from "@/components/AnimatedPage";
import { useEffect, useState, FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AdminMetrics {
  total_users: number;
  total_completed_interviews: number;
}

interface InterviewRole {
    id: number;
    name: string;
    category: string;
}

// --- NEW COMPONENT FOR CREATING ROLES ---
function CreateRoleForm({ accessToken, onRoleCreated }: { accessToken: string, onRoleCreated: (newRole: InterviewRole) => void }) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiUrl}/api/admin/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ name, category }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to create role.');
            toast.success(`Role "${data.name}" created successfully!`);
            onRoleCreated(data); // Notify parent component
            setName('');
            setCategory('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Interview Role</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="roleName">Role Name</Label>
                        <Input id="roleName" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="roleCategory">Category</Label>
                        <Input id="roleCategory" value={category} onChange={e => setCategory(e.target.value)} required />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Role
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

// --- NEW COMPONENT FOR ADDING QUESTIONS ---
function AddQuestionForm({ accessToken, roles }: { accessToken: string, roles: InterviewRole[] }) {
    const [content, setContent] = useState('');
    const [roleId, setRoleId] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiUrl}/api/admin/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({ content, role_id: parseInt(roleId), difficulty }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Failed to add question.');
            toast.success(`Question added successfully!`);
            setContent('');
            setRoleId('');
            setDifficulty('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Add New Question</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="questionContent">Question Content</Label>
                        <Textarea id="questionContent" value={content} onChange={e => setContent(e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Role</Label>
                            <Select onValueChange={setRoleId} value={roleId} required>
                                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Difficulty</Label>
                            <Select onValueChange={setDifficulty} value={difficulty} required>
                                <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Junior">Junior</SelectItem>
                                    <SelectItem value="Mid-Level">Mid-Level</SelectItem>
                                    <SelectItem value="Senior">Senior</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Question
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

// --- UPDATE THE MAIN ADMIN PAGE COMPONENT ---
export default function AdminPage() {
    const { user, accessToken } = useAuth();
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [roles, setRoles] = useState<InterviewRole[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role === 'super_admin' && accessToken) {
            const fetchAdminData = async () => {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                try {
                    // Fetch both metrics and roles in parallel
                    const [metricsResponse, rolesResponse] = await Promise.all([
                        fetch(`${apiUrl}/api/admin/metrics`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
                        fetch(`${apiUrl}/api/roles`, { headers: { 'Authorization': `Bearer ${accessToken}` } }) // Use existing public roles endpoint
                    ]);
                    if (!metricsResponse.ok || !rolesResponse.ok) throw new Error("Failed to load admin data.");
                    
                    setMetrics(await metricsResponse.json());
                    setRoles(await rolesResponse.json());
                } catch (err) {
                    setError(err instanceof Error ? err.message : "An unknown error occurred.");
                }
            };
            fetchAdminData();
        }
    }, [user, accessToken]);

    const handleRoleCreated = (newRole: InterviewRole) => {
        setRoles(prevRoles => [...prevRoles, newRole]);
    };

    if (user?.role !== 'super_admin') {
        return (
            <AnimatedPage>
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage className="space-y-8">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            {error && <p className="text-red-500">{error}</p>}
            
            <section>
                <h2 className="text-xl font-semibold mb-4">System Metrics</h2>
                {metrics ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Users</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metrics.total_users}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Completed Interviews</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metrics.total_completed_interviews}</div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <p>Loading metrics...</p>
                )}
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-4">Content Management</h2>
                <div className="grid gap-8 md:grid-cols-2">
                    {accessToken && <CreateRoleForm accessToken={accessToken} onRoleCreated={handleRoleCreated} />}
                    {accessToken && roles.length > 0 && <AddQuestionForm accessToken={accessToken} roles={roles} />}
                </div>
            </section>
        </AnimatedPage>
    );
}
