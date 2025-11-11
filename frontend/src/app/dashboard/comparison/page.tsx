'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, TrendingUp, BarChart3, Target, Info } from "lucide-react"
import AnimatedPage from '@/components/AnimatedPage'
import { AnimatedCounter } from '@/components/AnimatedCounter'
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Role {
  id: number
  name: string
}

interface TrendDataPoint {
  attempt_number: number
  average_score: number
  date: string
}

interface ComparisonData {
  has_data: boolean
  overall_average: number | null
  global_average: number | null
  percentile_overall: number | null
  roles_available: Role[]
  role_average: number | null
  role_global_average: number | null
  percentile_in_role: number | null
  trend: TrendDataPoint[]
  badges: string[]
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted-foreground))']

// Badge tooltip descriptions - updated with dynamic context
const BADGE_DESCRIPTIONS: Record<string, string> = {
  "Top 10%": "You are among the highest performers on the platform.",
  "Top 25%": "You are performing above the majority of users.",
  "On the Rise": "Your recent attempts show steady improvement.",
  "Consistency Star": "Your performance is stable and reliable.",
  "Comeback": "Your latest attempt shows a strong recovery.",
  "Newcomer": "Insights will become more accurate as you complete more attempts."
}

export default function ComparisonPage() {
  const { accessToken } = useAuth()
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const fetchComparisonData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const url = selectedRoleId 
          ? `${apiUrl}/api/comparison?role_id=${selectedRoleId}`
          : `${apiUrl}/api/comparison`
        
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!response.ok) throw new Error('Failed to fetch comparison data')
        const data: ComparisonData = await response.json()
        setComparisonData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchComparisonData()
  }, [accessToken, selectedRoleId])

  if (isLoading) {
    return (
      <AnimatedPage>
        <div className="space-y-8">
          <div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div>
          <div className="h-64 bg-muted rounded animate-pulse"></div>
        </div>
      </AnimatedPage>
    )
  }

  if (error) {
    return (
      <AnimatedPage>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </AnimatedPage>
    )
  }

  if (!comparisonData || !comparisonData.has_data) {
    return (
      <AnimatedPage>
        <Card>
          <CardHeader>
            <CardTitle>Your Performance</CardTitle>
            <CardDescription>Compare your performance with others</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">No data yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Take your first interview to see how you stack up.
            </p>
          </CardContent>
        </Card>
      </AnimatedPage>
    )
  }

  // Determine which data to use (role-specific or overall)
  const userAvg = selectedRoleId 
    ? comparisonData.role_average 
    : comparisonData.overall_average
  const globalAvg = selectedRoleId 
    ? comparisonData.role_global_average 
    : comparisonData.global_average
  const percentile = selectedRoleId 
    ? comparisonData.percentile_in_role 
    : comparisonData.percentile_overall

  // Prepare bar chart data
  const barChartData = [
    {
      name: 'Your Average',
      score: userAvg || 0
    },
    {
      name: 'Global Average',
      score: globalAvg || 0
    }
  ]

  // Prepare trend line chart data
  const trendChartData = comparisonData.trend.map((point) => ({
    attempt: `Attempt ${point.attempt_number}`,
    score: point.average_score,
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: new Date(point.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }))

  // Prepare percentile gauge data
  const percentileGaugeData = [
    { name: 'Your Percentile', value: percentile || 0 },
    { name: 'Remaining', value: 100 - (percentile || 0) }
  ]

  // Custom tooltip for trend chart - with explicit types
  const CustomTrendTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { attempt: string; score: number; fullDate: string } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{`Attempt ${data.attempt.replace('Attempt ', '')}: ${data.score.toFixed(1)}`}</p>
          <p className="text-xs text-muted-foreground">{`on ${data.fullDate}`}</p>
        </div>
      )
    }
    return null
  }

  // Custom tooltip for bar chart - with explicit types
  const CustomBarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; score: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const yourAvg = data.name === 'Your Average' ? data.score : (userAvg || 0)
      const globalAvgVal = data.name === 'Global Average' ? data.score : (globalAvg || 0)
      const deltaVal = yourAvg - globalAvgVal
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">Your avg: {yourAvg.toFixed(1)} vs global: {globalAvgVal.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Δ {deltaVal > 0 ? '+' : ''}{deltaVal.toFixed(1)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <AnimatedPage>
      <header className="mb-8">
        <h1>Your Performance</h1>
        <p className="text-muted-foreground">
          Compare your interview performance with the global average
        </p>
      </header>

      {/* Role Selector */}
      {comparisonData.roles_available.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label htmlFor="role-select" className="text-sm font-medium">
                Select Role:
              </label>
              <Select
                value={selectedRoleId?.toString() || 'overall'}
                onValueChange={(value) => {
                  setSelectedRoleId(value === 'overall' ? null : parseInt(value))
                }}
              >
                <SelectTrigger id="role-select" className="w-[250px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall Performance</SelectItem>
                  {comparisonData.roles_available.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      {comparisonData.badges.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium mr-2">Achievements:</span>
              <TooltipProvider>
                {comparisonData.badges.map((badge) => (
                  <Tooltip key={badge}>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help">
                        {badge}
                        <Info className="h-4 w-4 ml-1 inline" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{BADGE_DESCRIPTIONS[badge] || badge}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Percentile Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Percentile Rank
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your score is higher than {percentile?.toFixed(0) || 0}% of users{selectedRoleId ? ' in this role' : ''}.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              {selectedRoleId 
                ? 'Your percentile within this role'
                : 'Your percentile across all users'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={percentileGaugeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      {percentileGaugeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {percentile !== null ? (
                        <AnimatedCounter from={0} to={percentile} />
                      ) : (
                        'N/A'
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">Percentile</div>
                  </div>
                </div>
              </div>
              {percentile !== null && (
                <div className="w-full">
                  <Progress value={percentile} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Average Comparison Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Average Score Comparison
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {selectedRoleId 
                        ? `Your performance in this specific role: ${userAvg?.toFixed(1) || 'N/A'}. Global average for this role: ${globalAvg?.toFixed(1) || 'N/A'}.`
                        : `Average score across all your interview attempts: ${userAvg?.toFixed(1) || 'N/A'}. Average score across all users on the platform: ${globalAvg?.toFixed(1) || 'N/A'}.`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Your average vs global average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <RechartsTooltip content={<CustomBarTooltip />} />
                  <Bar 
                    dataKey="score" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {userAvg !== null ? <AnimatedCounter from={0} to={userAvg} /> : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Your Average</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {globalAvg !== null ? <AnimatedCounter from={0} to={globalAvg} /> : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Global Average</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Improvement Trend Line Chart */}
      {comparisonData.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Improvement Trend
            </CardTitle>
            <CardDescription>
              Your performance over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="attempt" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <RechartsTooltip content={<CustomTrendTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </AnimatedPage>
  )
}
