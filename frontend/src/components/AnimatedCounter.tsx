'use client'

import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface AnimatedCounterProps {
  from: number;
  to: number;
}

export function AnimatedCounter({ from, to }: AnimatedCounterProps) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => latest.toFixed(1));
  const ref = useRef(null);
  const inView = useInView(ref);

  useEffect(() => {
    if (inView) {
      animate(count, to, { duration: 1, ease: "easeOut" });
    }
  }, [inView, count, to]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}
