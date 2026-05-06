"use client";

import { FullScreenLoader } from "@/components/loaders/full-screen-loader";
import { IntroLoader } from "@/components/loaders/intro-loader";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface StartUpLoaderProps {
  /** Whether intro sequence plays at beginning or end */
  introPosition?: "start" | "end";
  /** Duration before D380 loader exits (in ms) */
  d380Duration?: number;
  /** Callback when entire startup sequence completes */
  onComplete?: () => void;
  /** Background color for the loader */
  backgroundColor?: string;
  /** Accent color (yellow brand color) */
  accentColor?: string;
  /** IntroLoader timing props */
  introTimings?: {
    thunderAnimateDuration?: number;
    textDisplayDuration?: number;
    solarDisplayDuration?: number;
  };
  /** Custom className for the container */
  className?: string;
}

type PhaseIntroFirst = "intro" | "d380" | "fadeout" | "complete";
type PhaseIntroLast = "d380" | "intro" | "fadeout" | "complete";
type Phase = PhaseIntroFirst | PhaseIntroLast;

export function StartUpLoader({
  introPosition = "start",
  d380Duration = 8000,
  onComplete,
  backgroundColor = "#020617",
  accentColor = "#EDBA3A",
  introTimings = {
    thunderAnimateDuration: 800,
    textDisplayDuration: 1500,
    solarDisplayDuration: 1800,
  },
  className,
}: StartUpLoaderProps) {
  // Determine initial phase based on introPosition
  const initialPhase: Phase = introPosition === "start" ? "intro" : "d380";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [isD380Exiting, setIsD380Exiting] = useState(false);

  // Handle D380 timer - only starts when D380 is the current phase
  useEffect(() => {
    if (phase !== "d380") return;
    
    const timer = setTimeout(() => {
      setIsD380Exiting(true);
    }, d380Duration);
    
    return () => clearTimeout(timer);
  }, [phase, d380Duration]);

  // Handle D380 exit completion
  const handleD380ExitComplete = useCallback(() => {
    if (introPosition === "end") {
      // D380 -> Intro -> Fadeout -> Complete
      setPhase("intro");
    } else {
      // Intro already played, D380 -> Fadeout -> Complete
      setPhase("fadeout");
      setTimeout(() => {
        setPhase("complete");
        onComplete?.();
      }, 800);
    }
  }, [introPosition, onComplete]);

  // Handle intro sequence completion
  const handleIntroComplete = useCallback(() => {
    if (introPosition === "start") {
      // Intro -> D380 (reset exit state for fresh D380)
      setIsD380Exiting(false);
      setPhase("d380");
    } else {
      // D380 already played, Intro -> Fadeout -> Complete
      setPhase("fadeout");
      setTimeout(() => {
        setPhase("complete");
        onComplete?.();
      }, 800);
    }
  }, [introPosition, onComplete]);

  // Don't render anything after complete
  if (phase === "complete") {
    return null;
  }

  const showD380 = phase === "d380";
  const showIntro = phase === "intro";
  const showFadeout = phase === "fadeout";

  return (
    <div className={`fixed inset-0 overflow-hidden ${className || ""}`}>
      {/* Background layer - stays throughout */}
      <motion.div 
        className="fixed inset-0 z-0"
        style={{ backgroundColor }}
        animate={{ 
          opacity: phase === "fadeout" ? 0 : 1 
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      
      {/* D380 Loader */}
      <AnimatePresence>
        {showD380 && (
          <motion.div
            key="d380-wrapper"
            className="fixed inset-0 z-10"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <FullScreenLoader 
              isExiting={isD380Exiting} 
              onExitComplete={handleD380ExitComplete} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Intro Loader - Thunder + "Powered By" + Solar Turbines */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro-wrapper"
            className="fixed inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <IntroLoader 
              onComplete={handleIntroComplete}
              thunderAnimateDuration={introTimings.thunderAnimateDuration}
              textDisplayDuration={introTimings.textDisplayDuration}
              solarDisplayDuration={introTimings.solarDisplayDuration}
              accentColor={accentColor}
              backgroundColor={backgroundColor}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Full page fade out overlay */}
      <AnimatePresence>
        {showFadeout && (
          <motion.div
            key="fadeout"
            className="fixed inset-0 z-40"
            style={{ backgroundColor }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default StartUpLoader;
