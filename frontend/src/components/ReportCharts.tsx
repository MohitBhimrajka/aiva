// frontend/src/components/ReportCharts.tsx
'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Area, AreaChart } from 'recharts';

interface ReportAnswer {
  ai_score: number;
  // We only need the score for this component
}

interface ReportChartsProps {
  answers: ReportAnswer[];
}

export function ScoreBarChart({ answers }: ReportChartsProps) {
  const chartData = answers.map((answer, index) => ({
    name: `Q${index + 1}`,
    score: answer.ai_score,
  }));

  return (
    // Set a fixed aspect ratio to prevent the chart from being too tall or short
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{
            top: 5,
            right: 20,
            left: -10, // Adjust to align Y-axis labels
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="name" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 10]} allowDecimals={false} stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: 'hsla(var(--primary), 0.1)' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              padding: '4px 8px',
            }}
          />
          <Bar dataKey="score" fill="hsl(var(--primary), 0.7)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="score" position="top" style={{ fill: 'hsl(var(--primary))', fontSize: '12px' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface HistoryItem {
  completed_at: string;
  average_score: number | null;
}

interface ProgressChartProps {
  history: HistoryItem[];
}

export function ProgressLineChart({ history }: ProgressChartProps) {
  // Sort history chronologically and format data for the chart
  const chartData = history
    .slice() 
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .map((item, index) => ({
      name: `Session ${index + 1}`,
      date: new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Average Score': item.average_score ? Number(item.average_score.toFixed(1)) : 0,
    }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            domain={[0, 10]} 
            allowDecimals={false} 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              color: 'hsl(var(--foreground))'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="Average Score" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorScore)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

