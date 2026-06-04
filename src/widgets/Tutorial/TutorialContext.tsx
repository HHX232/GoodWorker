'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export interface TutorialStep {
  stepNumber: number | null;
  elementId: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  waitForAction?: boolean;
}

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  isPaused: boolean;
  startTutorial: (steps: TutorialStep[]) => void;
  stopTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepNumber: number) => void;
  pauseTutorial: () => void;
  resumeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const startTutorial = useCallback((tutorialSteps: TutorialStep[]) => {
    const filteredSteps = tutorialSteps
      .filter(step => step.stepNumber !== null)
      .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));
    
    setSteps(filteredSteps);
    setCurrentStep(0);
    setIsActive(true);
    setIsPaused(filteredSteps[0]?.waitForAction || false);
  }, []);

  const stopTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    setIsPaused(false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      const nextIndex = prev + 1;
      if (nextIndex < steps.length) {
        setIsPaused(steps[nextIndex]?.waitForAction || false);
        return nextIndex;
      } else {
        // Завершаем туториал
        setTimeout(() => stopTutorial(), 0);
        return prev;
      }
    });
  }, [steps, stopTutorial]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev > 0) {
        const prevIndex = prev - 1;
        setIsPaused(steps[prevIndex]?.waitForAction || false);
        return prevIndex;
      }
      return prev;
    });
  }, [steps]);

  const goToStep = useCallback((stepNumber: number) => {
    const stepIndex = steps.findIndex(step => step.stepNumber === stepNumber);
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex);
      setIsPaused(steps[stepIndex]?.waitForAction || false);
    }
  }, [steps]);

  const pauseTutorial = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTutorial = useCallback(() => {
    setIsPaused(false);
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        isPaused,
        startTutorial,
        stopTutorial,
        nextStep,
        prevStep,
        goToStep,
        pauseTutorial,
        resumeTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}