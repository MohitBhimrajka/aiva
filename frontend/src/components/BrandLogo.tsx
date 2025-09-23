'use client'

import { motion } from 'framer-motion'
import { Briefcase } from 'lucide-react'

export function BrandLogo() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center justify-center space-y-2 mb-8"
    >
      <div className="p-4 bg-primary text-primary-foreground rounded-full">
        <Briefcase className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">AIVA</h1>
      <p className="text-sm text-muted-foreground mt-1 font-medium">AI Virtual Assistant</p>
    </motion.div>
  );
}
