"use client";

/**
 * Tour Context - Global state management for application tours
 * 
 * Provides:
 * - Tour visibility state
 * - Current step tracking
 * - Language selection (English/Spanish)
 * - Persistence of user preferences
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type TourLanguage = "en" | "es";

export interface TourStepContent {
  title: string;
  description: string;
}

export interface TourStep {
  id: string;
  /** CSS selector for the target element */
  target?: string;
  /** Content in both languages */
  content: {
    en: TourStepContent;
    es: TourStepContent;
  };
  /** Position of the tooltip relative to the target */
  position?: "top" | "bottom" | "left" | "right" | "center";
  /** Allow interaction with the highlighted element */
  allowInteraction?: boolean;
  /** Auto-advance after this delay (ms) */
  autoAdvance?: number;
  /** Callback when this step becomes active */
  onEnter?: () => void;
  /** Callback when leaving this step */
  onExit?: () => void;
}

export interface TourConfig {
  id: string;
  steps: TourStep[];
  /** Show progress indicator */
  showProgress?: boolean;
  /** Allow closing the tour */
  allowClose?: boolean;
  /** Allow skipping steps */
  allowSkip?: boolean;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
}

interface TourContextValue {
  // State
  isActive: boolean;
  currentTourId: string | null;
  currentStepIndex: number;
  language: TourLanguage;
  currentConfig: TourConfig | null;
  
  // Actions
  startTour: (config: TourConfig) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  setLanguage: (lang: TourLanguage) => void;
  
  // Helpers
  getCurrentStep: () => TourStep | null;
  getStepContent: () => TourStepContent | null;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
  hasSeenTour: (tourId: string) => boolean;
  markTourSeen: (tourId: string) => void;
  resetTourHistory: () => void;
}

// Storage keys
const TOUR_LANGUAGE_KEY = "tour_language";
const TOUR_HISTORY_KEY = "tour_seen_history";

// ============================================================================
// Context
// ============================================================================

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [language, setLanguageState] = useState<TourLanguage>("en");
  const [currentConfig, setCurrentConfig] = useState<TourConfig | null>(null);
  const [seenTours, setSeenTours] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Handle SSR
  useEffect(() => {
    setMounted(true);
    
    // Load persisted language preference
    try {
      const storedLang = localStorage.getItem(TOUR_LANGUAGE_KEY);
      if (storedLang === "en" || storedLang === "es") {
        setLanguageState(storedLang);
      }
      
      // Load tour history
      const storedHistory = localStorage.getItem(TOUR_HISTORY_KEY);
      if (storedHistory) {
        setSeenTours(new Set(JSON.parse(storedHistory)));
      }
    } catch (err) {
      console.error("Failed to load tour preferences:", err);
    }
  }, []);

  // Persist language preference
  const setLanguage = useCallback((lang: TourLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_LANGUAGE_KEY, lang);
    }
  }, []);

  // Start a tour with the given configuration
  const startTour = useCallback((config: TourConfig) => {
    setCurrentConfig(config);
    setCurrentTourId(config.id);
    setCurrentStepIndex(0);
    setIsActive(true);
    
    // Call onEnter for first step
    if (config.steps[0]?.onEnter) {
      config.steps[0].onEnter();
    }
  }, []);

  // End the current tour
  const endTour = useCallback(() => {
    if (currentConfig?.onComplete && currentStepIndex === (currentConfig.steps.length - 1)) {
      currentConfig.onComplete();
    }
    
    // Call onExit for current step
    const currentStep = currentConfig?.steps[currentStepIndex];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }
    
    setIsActive(false);
    setCurrentConfig(null);
    setCurrentTourId(null);
    setCurrentStepIndex(0);
  }, [currentConfig, currentStepIndex]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    if (!currentConfig) return;
    
    const currentStep = currentConfig.steps[currentStepIndex];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }
    
    if (currentStepIndex < currentConfig.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      
      const nextStepObj = currentConfig.steps[nextIndex];
      if (nextStepObj?.onEnter) {
        nextStepObj.onEnter();
      }
    } else {
      // Last step - end tour
      if (currentConfig.onComplete) {
        currentConfig.onComplete();
      }
      markTourSeen(currentConfig.id);
      endTour();
    }
  }, [currentConfig, currentStepIndex, endTour]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (!currentConfig || currentStepIndex === 0) return;
    
    const currentStep = currentConfig.steps[currentStepIndex];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }
    
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    
    const prevStepObj = currentConfig.steps[prevIndex];
    if (prevStepObj?.onEnter) {
      prevStepObj.onEnter();
    }
  }, [currentConfig, currentStepIndex]);

  // Go to a specific step
  const goToStep = useCallback((index: number) => {
    if (!currentConfig || index < 0 || index >= currentConfig.steps.length) return;
    
    const currentStep = currentConfig.steps[currentStepIndex];
    if (currentStep?.onExit) {
      currentStep.onExit();
    }
    
    setCurrentStepIndex(index);
    
    const targetStep = currentConfig.steps[index];
    if (targetStep?.onEnter) {
      targetStep.onEnter();
    }
  }, [currentConfig, currentStepIndex]);

  // Get current step
  const getCurrentStep = useCallback((): TourStep | null => {
    if (!currentConfig) return null;
    return currentConfig.steps[currentStepIndex] ?? null;
  }, [currentConfig, currentStepIndex]);

  // Get current step content in selected language
  const getStepContent = useCallback((): TourStepContent | null => {
    const step = getCurrentStep();
    if (!step) return null;
    return step.content[language];
  }, [getCurrentStep, language]);

  // Check if at first step
  const isFirstStep = useCallback(() => currentStepIndex === 0, [currentStepIndex]);

  // Check if at last step
  const isLastStep = useCallback(() => {
    if (!currentConfig) return true;
    return currentStepIndex === currentConfig.steps.length - 1;
  }, [currentConfig, currentStepIndex]);

  // Check if user has seen a tour
  const hasSeenTour = useCallback((tourId: string) => seenTours.has(tourId), [seenTours]);

  // Mark a tour as seen
  const markTourSeen = useCallback((tourId: string) => {
    setSeenTours((prev) => {
      const updated = new Set(prev);
      updated.add(tourId);
      
      if (typeof window !== "undefined") {
        localStorage.setItem(TOUR_HISTORY_KEY, JSON.stringify([...updated]));
      }
      
      return updated;
    });
  }, []);

  // Reset tour history
  const resetTourHistory = useCallback(() => {
    setSeenTours(new Set());
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOUR_HISTORY_KEY);
    }
  }, []);

  const value = useMemo<TourContextValue>(() => ({
    isActive,
    currentTourId,
    currentStepIndex,
    language,
    currentConfig,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    setLanguage,
    getCurrentStep,
    getStepContent,
    isFirstStep,
    isLastStep,
    hasSeenTour,
    markTourSeen,
    resetTourHistory,
  }), [
    isActive,
    currentTourId,
    currentStepIndex,
    language,
    currentConfig,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    setLanguage,
    getCurrentStep,
    getStepContent,
    isFirstStep,
    isLastStep,
    hasSeenTour,
    markTourSeen,
    resetTourHistory,
  ]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Hook to access tour context
 */
export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

/**
 * Hook to safely access tour context (returns null if not in provider)
 */
export function useTourSafe() {
  return useContext(TourContext);
}
