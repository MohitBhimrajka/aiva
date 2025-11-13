// frontend/src/contexts/BreadcrumbContext.tsx

'use client'

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// Define the shape of the context data
interface BreadcrumbContextType {
  // A map where the key is the full path (e.g., '/report/123')
  // and the value is the desired display name (e.g., 'Software Engineer Report')
  dynamicPaths: Record<string, string>;
  setDynamicPath: (path: string, name: string) => void;
}

// Create the context with a default value
const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

// Create the provider component
export const BreadcrumbProvider = ({ children }: { children: ReactNode }) => {
  const [dynamicPaths, setDynamicPaths] = useState<Record<string, string>>({});

  const setDynamicPath = useCallback((path: string, name: string) => {
    setDynamicPaths(prev => ({
      ...prev,
      [path]: name,
    }));
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ dynamicPaths, setDynamicPath }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

// Create a custom hook for easy consumption
export const useBreadcrumbs = () => {
  const context = useContext(BreadcrumbContext);
  if (context === undefined) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
  }
  return context;
};

