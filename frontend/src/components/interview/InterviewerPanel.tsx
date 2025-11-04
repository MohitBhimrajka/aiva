'use client'

import { Bot } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface InterviewerPanelProps {
  question: string | undefined;
  children: React.ReactNode; // For the avatar display
}

export function InterviewerPanel({ question, children }: InterviewerPanelProps) {
  return (
    <Card className="flex flex-col relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-primary/10 rounded-full">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold">AIVA Interviewer</h3>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-6">
        {/* This is where the Avatar video will go */}
        <div className="w-full max-w-[250px] aspect-square rounded-full mb-6 bg-gray-200 overflow-hidden">
          {children}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={question}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-2xl font-medium leading-relaxed"
          >
            {question}
          </motion.p>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

