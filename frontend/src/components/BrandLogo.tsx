'use client'

import { motion } from 'framer-motion'
import { Briefcase } from 'lucide-react'

export function BrandLogo() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center justify-center space-y-2"
    >
      <div className="p-4 bg-primary text-primary-foreground rounded-full">
        <Briefcase className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">AIVA</h1>
    </motion.div>
  );
}
