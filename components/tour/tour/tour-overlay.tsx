"use client";

/**
 * Tour Overlay - Visual components for the tour experience
 * 
 * Provides:
 * - Spotlight/highlight effect on target elements
 * - Tooltip with step content
 * - Navigation controls
 * - Language switcher
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Globe, Check, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTour, type TourLanguage } from "./tour-context";

// ============================================================================
// Spotlight Overlay
// ============================================================================

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useTargetRect(selector: string | undefined): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const element = document.querySelector(selector);
      if (element) {
        const domRect = element.getBoundingClientRect();
        setRect({
          top: domRect.top,
          left: domRect.left,
          width: domRect.width,
          height: domRect.height,
        });
      } else {
        setRect(null);
      }
    };

    // Initial update
    updateRect();

    // Update on scroll and resize
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    // Observe DOM changes
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      observer.disconnect();
    };
  }, [selector]);

  return rect;
}

// ============================================================================
// Language Switcher
// ============================================================================

interface LanguageSwitcherProps {
  compact?: boolean;
}

function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTour();

  const languages: { code: TourLanguage; label: string; flag: string }[] = [
    { code: "en", label: "English", flag: "EN" },
    { code: "es", label: "Espanol", flag: "ES" },
  ];

  if (compact) {
    return (
      <button
        onClick={() => setLanguage(language === "en" ? "es" : "en")}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Switch language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{language.toUpperCase()}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            language === lang.code
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={`Switch to ${lang.label}`}
        >
          <span>{lang.flag}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  const { language } = useTour();
  
  const labels = {
    en: { of: "of" },
    es: { of: "de" },
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              i === current
                ? "w-4 bg-primary"
                : i < current
                  ? "bg-primary/60"
                  : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {current + 1} {labels[language].of} {total}
      </span>
    </div>
  );
}

// ============================================================================
// Tour Tooltip
// ============================================================================

interface TooltipPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  transformOrigin: string;
  adjustedPosition: "top" | "bottom" | "left" | "right" | "center";
}

const TOOLTIP_WIDTH = 340;
const TOOLTIP_HEIGHT = 280; // Approximate max height
const VIEWPORT_PADDING = 16;

function calculateTooltipPosition(
  targetRect: TargetRect | null,
  preferredPosition: "top" | "bottom" | "left" | "right" | "center",
  padding: number = 16
): TooltipPosition {
  if (!targetRect || preferredPosition === "center") {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transformOrigin: "center center",
      adjustedPosition: "center",
    };
  }

  const { top, left, width, height } = targetRect;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate available space in each direction
  const spaceAbove = top;
  const spaceBelow = viewportHeight - (top + height);
  const spaceLeft = left;
  const spaceRight = viewportWidth - (left + width);

  // Determine best position if preferred position doesn't fit
  let position = preferredPosition;

  // Check if preferred position has enough space
  const minSpaceNeeded = TOOLTIP_HEIGHT + padding * 2;
  const minHorizontalSpace = TOOLTIP_WIDTH + padding * 2;

  if (position === "bottom" && spaceBelow < minSpaceNeeded) {
    position = spaceAbove > spaceBelow ? "top" : "bottom";
  } else if (position === "top" && spaceAbove < minSpaceNeeded) {
    position = spaceBelow > spaceAbove ? "bottom" : "top";
  } else if (position === "left" && spaceLeft < minHorizontalSpace) {
    position = spaceRight > spaceLeft ? "right" : "left";
  } else if (position === "right" && spaceRight < minHorizontalSpace) {
    position = spaceLeft > spaceRight ? "left" : "right";
  }

  // Calculate clamped horizontal position to keep tooltip in viewport
  const clampedCenterX = Math.min(
    Math.max(TOOLTIP_WIDTH / 2 + VIEWPORT_PADDING, centerX),
    viewportWidth - TOOLTIP_WIDTH / 2 - VIEWPORT_PADDING
  );

  // Calculate clamped vertical position
  const clampedCenterY = Math.min(
    Math.max(TOOLTIP_HEIGHT / 2 + VIEWPORT_PADDING, centerY),
    viewportHeight - TOOLTIP_HEIGHT / 2 - VIEWPORT_PADDING
  );

  switch (position) {
    case "top":
      return {
        bottom: viewportHeight - top + padding,
        left: clampedCenterX,
        transformOrigin: "bottom center",
        adjustedPosition: position,
      };
    case "bottom":
      return {
        top: Math.min(top + height + padding, viewportHeight - TOOLTIP_HEIGHT - VIEWPORT_PADDING),
        left: clampedCenterX,
        transformOrigin: "top center",
        adjustedPosition: position,
      };
    case "left":
      return {
        top: clampedCenterY,
        right: viewportWidth - left + padding,
        transformOrigin: "center right",
        adjustedPosition: position,
      };
    case "right":
      return {
        top: clampedCenterY,
        left: Math.min(left + width + padding, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
        transformOrigin: "center left",
        adjustedPosition: position,
      };
    default:
      return {
        top: clampedCenterY,
        left: clampedCenterX,
        transformOrigin: "center center",
        adjustedPosition: position,
      };
  }
}

// ============================================================================
// Main Tour Overlay Component
// ============================================================================

export function TourOverlay() {
  const {
    isActive,
    currentConfig,
    currentStepIndex,
    getCurrentStep,
    getStepContent,
    nextStep,
    prevStep,
    endTour,
    isFirstStep,
    isLastStep,
    language,
  } = useTour();

  const currentStep = getCurrentStep();
  const content = getStepContent();
  const targetRect = useTargetRect(currentStep?.target);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Labels in both languages
  const labels = {
    en: {
      next: "Next",
      prev: "Previous",
      finish: "Finish",
      skip: "Skip tour",
      close: "Close",
    },
    es: {
      next: "Siguiente",
      prev: "Anterior",
      finish: "Finalizar",
      skip: "Saltar tour",
      close: "Cerrar",
    },
  };

  const l = labels[language];

  // Scroll target into view
  useEffect(() => {
    if (currentStep?.target) {
      const element = document.querySelector(currentStep.target);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }
  }, [currentStep?.target]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          if (currentConfig?.allowClose !== false) {
            endTour();
          }
          break;
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextStep();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (!isFirstStep()) {
            prevStep();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentConfig, nextStep, prevStep, endTour, isFirstStep]);

  // Auto-advance if configured
  useEffect(() => {
    if (!currentStep?.autoAdvance) return;

    const timer = setTimeout(nextStep, currentStep.autoAdvance);
    return () => clearTimeout(timer);
  }, [currentStep?.autoAdvance, nextStep, currentStepIndex]);

  if (!isActive || !currentConfig || !content) return null;

  const preferredPosition = currentStep?.position || "bottom";
  const tooltipPos = calculateTooltipPosition(targetRect, preferredPosition);
  const position = tooltipPos.adjustedPosition;
  const showProgress = currentConfig.showProgress !== false;
  const totalSteps = currentConfig.steps.length;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
        {/* Backdrop with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          {targetRect && position !== "center" ? (
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <mask id="spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <motion.rect
                    initial={{
                      x: targetRect.left - 8,
                      y: targetRect.top - 8,
                      width: targetRect.width + 16,
                      height: targetRect.height + 16,
                    }}
                    animate={{
                      x: targetRect.left - 8,
                      y: targetRect.top - 8,
                      width: targetRect.width + 16,
                      height: targetRect.height + 16,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    rx="8"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(0, 0, 0, 0.6)"
                mask="url(#spotlight-mask)"
              />
            </svg>
          ) : (
            <div className="absolute inset-0 bg-black/60" />
          )}
        </motion.div>

        {/* Highlight ring around target */}
        {targetRect && position !== "center" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="pointer-events-none absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}

        {/* Interactive area over target (if allowed) */}
        {currentStep?.allowInteraction && targetRect && (
          <div
            className="absolute z-10"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "absolute z-20 w-[340px] max-w-[calc(100vw-32px)] rounded-xl border bg-card p-4 shadow-2xl",
            position === "center" && "-translate-x-1/2 -translate-y-1/2",
            position === "top" && "-translate-x-1/2",
            position === "bottom" && "-translate-x-1/2",
            position === "left" && "-translate-y-1/2",
            position === "right" && "-translate-y-1/2"
          )}
          style={{
            top: tooltipPos.top,
            bottom: tooltipPos.bottom,
            left: tooltipPos.left,
            right: tooltipPos.right,
            transformOrigin: tooltipPos.transformOrigin,
          }}
        >
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              {showProgress && (
                <Badge variant="secondary" className="text-xs">
                  {currentStepIndex + 1}/{totalSteps}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher compact />
              {currentConfig.allowClose !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={endTour}
                  aria-label={l.close}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">
              {content.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {content.description}
            </p>
          </div>

          {/* Progress dots */}
          {showProgress && totalSteps > 1 && (
            <div className="mt-4">
              <ProgressIndicator current={currentStepIndex} total={totalSteps} />
            </div>
          )}

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {currentConfig.allowSkip && !isLastStep() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={endTour}
                  className="text-xs text-muted-foreground"
                >
                  {l.skip}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isFirstStep() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {l.prev}
                </Button>
              )}
              <Button
                size="sm"
                onClick={nextStep}
                className="gap-1"
              >
                {isLastStep() ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {l.finish}
                  </>
                ) : (
                  <>
                    {l.next}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
