"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroLoaderProps {
  onComplete?: () => void;
  className?: string;
  // Timing customization (in ms)
  thunderCenterDuration?: number;
  sideBySideDuration?: number;
  solarDisplayDuration?: number;
  // Style customization
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

type IntroPhase = "thunder-center" | "side-by-side" | "exit-together" | "solar-in" | "solar-out" | "complete";

// Thunder bolt SVG component - responsive sizing via className
function ThunderBoltIcon({ 
  fillColor = "#EDBA3A",
  className 
}: { 
  fillColor?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fillColor}
    >
      <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
    </svg>
  );
}

export function IntroLoader({
  onComplete,
  className,
  thunderCenterDuration = 800,
  sideBySideDuration = 1500,
  solarDisplayDuration = 1800,
  accentColor = "#EDBA3A",
  backgroundColor = "#020617",
  textColor = "#ffffff",
}: IntroLoaderProps) {
  const [phase, setPhase] = useState<IntroPhase>("thunder-center");

  const advancePhase = useCallback(() => {
    setPhase((current) => {
      switch (current) {
        case "thunder-center":
          return "side-by-side";
        case "side-by-side":
          return "exit-together";
        case "exit-together":
          return "solar-in";
        case "solar-in":
          return "solar-out";
        case "solar-out":
          return "complete";
        default:
          return current;
      }
    });
  }, []);

  // Phase timing controller
  useEffect(() => {
    let timer: NodeJS.Timeout;

    switch (phase) {
      case "thunder-center":
        timer = setTimeout(advancePhase, thunderCenterDuration);
        break;
      case "side-by-side":
        timer = setTimeout(advancePhase, sideBySideDuration);
        break;
      case "exit-together":
        timer = setTimeout(advancePhase, 600);
        break;
      case "solar-in":
        timer = setTimeout(advancePhase, solarDisplayDuration);
        break;
      case "solar-out":
        timer = setTimeout(advancePhase, 600);
        break;
      case "complete":
        onComplete?.();
        break;
    }

    return () => clearTimeout(timer);
  }, [phase, advancePhase, onComplete, thunderCenterDuration, sideBySideDuration, solarDisplayDuration]);

  const showThunderAndText = phase === "thunder-center" || phase === "side-by-side" || phase === "exit-together";
  const showText = phase === "side-by-side" || phase === "exit-together";
  const showSolar = phase === "solar-in" || phase === "solar-out";

  // Thunder slides right when text appears
  const getThunderX = () => {
    if (phase === "thunder-center") return 0;
    return 0; // No additional x offset - gap handles spacing
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center overflow-hidden ${className || ""}`}
      style={{ backgroundColor }}
    >
      {/* Main content: Thunder + Text as single animated group */}
      <AnimatePresence>
        {showThunderAndText && (
          <motion.div
            key="thunder-text-group"
            className="flex items-center justify-center gap-3 md:gap-5"
            initial={{ opacity: 1 }}
            animate={{ 
              opacity: phase === "exit-together" ? 0 : 1,
              y: phase === "exit-together" ? -80 : 0,
              scale: phase === "exit-together" ? 0.8 : 1,
            }}
            exit={{ opacity: 0, y: -80, scale: 0.8 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* "Powered By" text - fades in when moving to side-by-side */}
            <motion.span
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-wide whitespace-nowrap"
              style={{ color: textColor }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: showText ? 1 : 0,
                x: showText ? 0 : -20,
              }}
              transition={{ 
                duration: 0.5, 
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Powered By
            </motion.span>

            {/* Thunder bolt icon - starts centered, stays in place as text appears */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ 
                scale: 1, 
                rotate: 0,
                x: getThunderX(),
              }}
              transition={{ 
                scale: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                rotate: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                x: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
              }}
            >
              <ThunderBoltIcon 
                fillColor={accentColor} 
                className="w-14 h-14 sm:w-18 sm:h-18 md:w-22 md:h-22 lg:w-28 lg:h-28"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solar Turbines logo section */}
      <AnimatePresence>
        {showSolar && (
          <motion.div
            key="solar-section"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "solar-out" ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: phase === "solar-out" ? 1.05 : 1, 
                opacity: phase === "solar-out" ? 0 : 1 
              }}
              transition={{ 
                duration: 0.6, 
                ease: [0.22, 1, 0.36, 1]
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/SolarTurbines-Dark.svg"
                alt="Solar Turbines - A Caterpillar Company"
                style={{ width: "min(85vw, 550px)", height: "auto" }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IntroLoader;
