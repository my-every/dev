"use client";

/**
 * Tour Trigger - Button component to start tours
 * 
 * Provides a consistent UI for initiating tours across the application.
 * Supports both icon-only and labeled variants.
 */

import { HelpCircle, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTour, type TourConfig, type TourLanguage } from "./tour-context";

// ============================================================================
// Types
// ============================================================================

interface TourTriggerProps {
  /** Tour configuration to start when clicked */
  tourConfig: TourConfig;
  /** Visual variant */
  variant?: "default" | "outline" | "ghost" | "subtle";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show label text */
  showLabel?: boolean;
  /** Custom label (overrides default) */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show pulse animation for new users */
  pulse?: boolean;
  /** Icon to display */
  icon?: "help" | "play" | "sparkles";
}

// ============================================================================
// Component
// ============================================================================

export function TourTrigger({
  tourConfig,
  variant = "outline",
  size = "sm",
  showLabel = true,
  label,
  className,
  pulse = false,
  icon = "help",
}: TourTriggerProps) {
  const { startTour, hasSeenTour, language } = useTour();

  const hasNotSeenTour = !hasSeenTour(tourConfig.id);
  const showPulse = pulse && hasNotSeenTour;

  // Labels in both languages
  const labels: Record<TourLanguage, { default: string; tooltip: string }> = {
    en: {
      default: "Take a tour",
      tooltip: "Learn how to use this page",
    },
    es: {
      default: "Hacer tour",
      tooltip: "Aprende a usar esta pagina",
    },
  };

  const l = labels[language];
  const buttonLabel = label || l.default;

  const IconComponent = {
    help: HelpCircle,
    play: Play,
    sparkles: Sparkles,
  }[icon];

  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-9 text-sm",
    lg: "h-10 text-sm",
  };

  const buttonVariant = variant === "subtle" ? "ghost" : variant;

  const handleClick = () => {
    startTour(tourConfig);
  };

  const button = (
    <Button
      variant={buttonVariant}
      size={showLabel ? "sm" : "icon"}
      onClick={handleClick}
      className={cn(
        sizeClasses[size],
        showLabel && "gap-1.5 px-3",
        !showLabel && size === "sm" && "h-8 w-8",
        !showLabel && size === "md" && "h-9 w-9",
        !showLabel && size === "lg" && "h-10 w-10",
        showPulse && "relative",
        variant === "subtle" && "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {showPulse && (
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      )}
      <IconComponent className={cn(
        size === "sm" && "h-3.5 w-3.5",
        size === "md" && "h-4 w-4",
        size === "lg" && "h-5 w-5"
      )} />
      {showLabel && <span>{buttonLabel}</span>}
    </Button>
  );

  if (!showLabel) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{l.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

// ============================================================================
// Floating Tour Button
// ============================================================================

interface FloatingTourButtonProps extends Omit<TourTriggerProps, "variant" | "showLabel"> {
  /** Position on screen */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Show expanded label on hover */
  expandOnHover?: boolean;
}

export function FloatingTourButton({
  tourConfig,
  position = "bottom-right",
  size = "md",
  className,
  pulse = true,
  icon = "help",
  expandOnHover = true,
}: FloatingTourButtonProps) {
  const { startTour, hasSeenTour, language, isActive } = useTour();

  const hasNotSeenTour = !hasSeenTour(tourConfig.id);
  const showPulse = pulse && hasNotSeenTour;

  const labels: Record<TourLanguage, { short: string; full: string }> = {
    en: { short: "Help", full: "Take a Tour" },
    es: { short: "Ayuda", full: "Hacer Tour" },
  };

  const l = labels[language];

  const positionClasses = {
    "bottom-right": "bottom-6 right-6 sm:bottom-8 sm:right-8",
    "bottom-left": "bottom-6 left-6 sm:bottom-8 sm:left-8",
    "top-right": "top-6 right-6 sm:top-8 sm:right-8",
    "top-left": "top-6 left-6 sm:top-8 sm:left-8",
  };

  const IconComponent = {
    help: HelpCircle,
    play: Play,
    sparkles: Sparkles,
  }[icon];

  const handleClick = () => {
    startTour(tourConfig);
  };

  // Hide when tour is active
  if (isActive) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "group fixed z-50 flex items-center gap-2 rounded-full border border-border/50 bg-card/95 text-foreground shadow-lg backdrop-blur-sm transition-all duration-300",
              "hover:scale-105 hover:shadow-xl hover:border-primary/50 hover:bg-card",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "active:scale-100",
              // Size variants
              size === "sm" && "h-11 px-3",
              size === "md" && "h-12 px-3.5",
              size === "lg" && "h-14 px-4",
              // Expand on hover
              expandOnHover && "pr-3.5 sm:pr-4",
              positionClasses[position],
              className
            )}
            aria-label={l.full}
          >
            {/* Pulse ring effect */}
            {showPulse && (
              <>
                <span className="absolute inset-0 rounded-full">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                </span>
                <span className="absolute -right-1 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              </>
            )}
            
            {/* Icon with gradient background */}
            <span className={cn(
              "relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
              size === "sm" && "h-7 w-7",
              size === "md" && "h-8 w-8",
              size === "lg" && "h-9 w-9",
            )}>
              <IconComponent className={cn(
                size === "sm" && "h-4 w-4",
                size === "md" && "h-4.5 w-4.5",
                size === "lg" && "h-5 w-5"
              )} />
            </span>
            
            {/* Expandable label */}
            {expandOnHover && (
              <span className={cn(
                "overflow-hidden whitespace-nowrap font-medium transition-all duration-300",
                "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                size === "lg" && "text-sm",
              )}>
                {l.full}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={position.includes("right") ? "left" : "right"} 
          className="hidden group-hover:hidden sm:block"
        >
          <p>{l.full}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
