'use client'

import React, { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Briefcase, FileClock, Sparkles } from 'lucide-react';

const ONBOARDING_COMPLETED_KEY = 'aiva-onboarding-completed';

export function OnboardingGuide() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has completed onboarding before
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETED_KEY);

    // Show the guide if it's their first time
    if (!hasCompletedOnboarding) {
      // Use a short delay to allow the page to render first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500); // 1.5 second delay
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // If the dialog is being closed, mark onboarding as completed
    if (!open) {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    }
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Search for actions or just read the guide..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Welcome to AIVA! Here's how to get started:">
          <CommandItem disabled>
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            <span>Your AI-powered interview practice starts here.</span>
          </CommandItem>
          <CommandItem disabled>
            <Briefcase className="mr-2 h-4 w-4" />
            <span>
              <b>Step 1:</b> Select an interview role from the dashboard to begin a new session.
            </span>
          </CommandItem>
          <CommandItem disabled>
            <FileClock className="mr-2 h-4 w-4" />
            <span>
              <b>Step 2:</b> After completing a session, find your detailed report in &quot;My Reports&quot;.
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

