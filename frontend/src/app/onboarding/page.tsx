'use client'

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Step1_ProfileBasics } from '@/components/onboarding/Step1_ProfileBasics';
import { Step2_SetGoal } from '@/components/onboarding/Step2_SetGoal';
import { Step3_ResumeUpload } from '@/components/onboarding/Step3_ResumeUpload';
import { Step_StudentProfile } from '@/components/onboarding/Step_StudentProfile';
import { BrandLogo } from '@/components/BrandLogo';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0 }),
};

function OnboardingContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitialStep = () => parseInt(searchParams.get('step') || '1');
  
  const [[step, direction], setStep] = useState([getInitialStep(), 0]);

  useEffect(() => {
    refreshUser();
  }, [step, refreshUser]);

  const paginate = (newDirection: number) => {
    router.push(`/onboarding?step=${step + newDirection}`, { scroll: false });
    setStep([step + newDirection, newDirection]);
  };
  
  const renderStep = () => {
    switch (step) {
      case 1:
        return <Step1_ProfileBasics onCompleted={() => paginate(1)} />;
      case 2:
        return <Step2_SetGoal onCompleted={() => paginate(1)} />;
      case 3:
        if (user?.primary_goal === 'student') {
            return <Step_StudentProfile onCompleted={() => paginate(1)} />;
        }
        return <Step3_ResumeUpload />;
      case 4:
        return <Step3_ResumeUpload />;
      default:
        return <Step1_ProfileBasics onCompleted={() => paginate(1)} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 overflow-hidden">
      <BrandLogo />
      <div className="w-full max-w-xl relative h-[28rem]">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute w-full"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }>
        <OnboardingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
