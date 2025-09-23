'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

const animations = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedPage({ children, className }: AnimatedPageProps) {
  return (
    <motion.div
      variants={animations}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
