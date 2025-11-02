// frontend/src/components/ReportCharts.tsx
'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Line, LineChart, Legend, LabelList } from 'recharts';

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
    .slice() // Create a copy to avoid mutating the original prop
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .map(item => ({
      date: new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Average Score': item.average_score ? Number(item.average_score.toFixed(1)) : 0,
    }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey="date" stroke="#555" fontSize={12} />
          <YAxis domain={[0, 10]} allowDecimals={false} stroke="#555" fontSize={12} />
          <Tooltip 
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '14px' }} />
          <Line
            type="monotone"
            dataKey="Average Score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

