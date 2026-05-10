"use client";

import {
  forwardRef,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Check,
  AlertCircle,
  Download,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/theme/shape-context";
import { useActivityNotification } from "@/contexts/activity-notification-context";
import type { ActivityEntry } from "@/types/activity";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActionButtonState =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "download-ready";

export interface ActionResult {
  success: boolean;
  message?: string;
  downloadUrl?: string;
  activity?: ActivityEntry;
}

// ─── Variants ────────────────────────────────────────────────────────────────

const actionButtonVariants = cva(
  [
    "group relative inline-flex items-center justify-center outline-none cursor-pointer",
    "text-box-trim-both text-box-edge-cap-alphabetic",
    "transition-all duration-200",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
    "overflow-hidden",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-background hover:bg-primary/90 active:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary",
        accent: "bg-accent text-accent-foreground hover:bg-accent/80 active:bg-accent",
        outline: "border border-border text-foreground bg-transparent hover:bg-muted active:bg-muted/60",
        ghost: "text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground active:bg-muted/60",
        success: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
      },
      size: {
        xs: "h-6 py-1 px-2 text-[10px] gap-1 [&_svg]:h-3 [&_svg]:w-3",
        sm: "h-7 py-1.5 px-2.5 text-[11px] gap-1 [&_svg]:h-3.5 [&_svg]:w-3.5",
        md: "h-9 py-2 px-3 text-[12px] gap-1.5 [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-10 py-2.5 px-4 text-[13px] gap-1.5 [&_svg]:h-4.5 [&_svg]:w-4.5",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "sm",
    },
  }
);

// ─── State Icons ─────────────────────────────────────────────────────────────

const STATE_ICONS: Record<ActionButtonState, LucideIcon | null> = {
  idle: null,
  loading: Loader2,
  success: Check,
  error: AlertCircle,
  "download-ready": Download,
};

const STATE_COLORS: Record<ActionButtonState, string> = {
  idle: "",
  loading: "",
  success: "text-green-600",
  error: "text-destructive",
  "download-ready": "text-blue-600",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface ActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    VariantProps<typeof actionButtonVariants> {
  /** The action to perform when clicked. Should return an ActionResult. */
  onAction?: () => Promise<ActionResult> | ActionResult;
  /** Simple click handler for non-async actions */
  onClick?: () => void;
  /** Icon to show in idle state */
  icon?: LucideIcon;
  /** Show icon on the right side instead of left */
  iconRight?: boolean;
  /** Label text */
  children: ReactNode;
  /** Success message to show briefly */
  successMessage?: string;
  /** Error message to show briefly */
  errorMessage?: string;
  /** Duration to show success/error state (ms) */
  feedbackDuration?: number;
  /** Whether to integrate with activity notification */
  notifyActivity?: boolean;
  /** External state control */
  state?: ActionButtonState;
  /** External state change handler */
  onStateChange?: (state: ActionButtonState) => void;
  /** Download URL when in download-ready state */
  downloadUrl?: string;
  /** Download filename */
  downloadFilename?: string;
  /** Custom loading text */
  loadingText?: string;
  /** Custom success text */
  successText?: string;
  /** Custom error text */
  errorText?: string;
}

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      className,
      variant = "outline",
      size = "sm",
      onAction,
      onClick,
      icon: IdleIcon,
      iconRight = false,
      children,
      successMessage,
      errorMessage,
      feedbackDuration = 2000,
      notifyActivity = false,
      state: externalState,
      onStateChange,
      downloadUrl: externalDownloadUrl,
      downloadFilename,
      loadingText,
      successText,
      errorText,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalState, setInternalState] = useState<ActionButtonState>("idle");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(externalDownloadUrl ?? null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shape = useShape();
    const { notifyActivity: triggerActivityNotification } = useActivityNotification();

    // Use external state if provided, otherwise internal
    const state = externalState ?? internalState;
    const setState = useCallback(
      (newState: ActionButtonState) => {
        if (externalState === undefined) {
          setInternalState(newState);
        }
        onStateChange?.(newState);
      },
      [externalState, onStateChange]
    );

    // Sync external download URL
    useEffect(() => {
      if (externalDownloadUrl) {
        setDownloadUrl(externalDownloadUrl);
      }
    }, [externalDownloadUrl]);

    // Clear feedback timeout on unmount
    useEffect(() => {
      return () => {
        if (feedbackTimeoutRef.current) {
          clearTimeout(feedbackTimeoutRef.current);
        }
      };
    }, []);

    const handleClick = useCallback(async () => {
      // Handle simple click
      if (onClick && !onAction) {
        onClick();
        return;
      }

      // Handle download-ready state
      if (state === "download-ready" && downloadUrl) {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = downloadFilename ?? "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset to idle after download
        setTimeout(() => setState("idle"), 500);
        return;
      }

      // Handle async action
      if (!onAction) return;

      try {
        setState("loading");
        setFeedbackMessage(null);

        const result = await onAction();

        if (result.success) {
          setState("success");
          setFeedbackMessage(successMessage ?? result.message ?? null);

          // Handle download URL from result
          if (result.downloadUrl) {
            setDownloadUrl(result.downloadUrl);
            // Transition to download-ready after brief success
            setTimeout(() => setState("download-ready"), 1000);
          } else {
            // Reset to idle after feedback duration
            feedbackTimeoutRef.current = setTimeout(() => {
              setState("idle");
              setFeedbackMessage(null);
            }, feedbackDuration);
          }

          // Trigger activity notification if enabled and activity provided
          if (notifyActivity && result.activity) {
            triggerActivityNotification(result.activity);
          }
        } else {
          setState("error");
          setFeedbackMessage(errorMessage ?? result.message ?? "Action failed");

          // Reset to idle after feedback duration
          feedbackTimeoutRef.current = setTimeout(() => {
            setState("idle");
            setFeedbackMessage(null);
          }, feedbackDuration);
        }
      } catch (err) {
        setState("error");
        setFeedbackMessage(
          errorMessage ?? (err instanceof Error ? err.message : "An error occurred")
        );

        // Reset to idle after feedback duration
        feedbackTimeoutRef.current = setTimeout(() => {
          setState("idle");
          setFeedbackMessage(null);
        }, feedbackDuration);
      }
    }, [
      onClick,
      onAction,
      state,
      downloadUrl,
      downloadFilename,
      setState,
      successMessage,
      errorMessage,
      feedbackDuration,
      notifyActivity,
      triggerActivityNotification,
    ]);

    // Determine current icon
    const StateIcon = STATE_ICONS[state];
    const CurrentIcon = state === "idle" ? IdleIcon : StateIcon;
    const iconColorClass = STATE_COLORS[state];

    // Determine current text
    const getText = () => {
      switch (state) {
        case "loading":
          return loadingText ?? children;
        case "success":
          return successText ?? feedbackMessage ?? children;
        case "error":
          return errorText ?? feedbackMessage ?? children;
        case "download-ready":
          return "Download Ready";
        default:
          return children;
      }
    };

    // Determine variant override based on state
    const getVariant = () => {
      if (state === "success") return "success";
      if (state === "error") return "destructive";
      if (state === "download-ready") return "accent";
      return variant;
    };

    const isLoading = state === "loading";
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          actionButtonVariants({ variant: getVariant(), size }),
          shape.button,
          // Pulse animation for download-ready
          state === "download-ready" && "animate-pulse",
          className
        )}
        disabled={isDisabled}
        onClick={handleClick}
        aria-busy={isLoading}
        aria-live="polite"
        {...props}
      >
        {/* Left icon */}
        {!iconRight && CurrentIcon && (
          <CurrentIcon
            className={cn(
              "shrink-0 transition-all duration-200",
              isLoading && "animate-spin",
              iconColorClass
            )}
          />
        )}

        {/* Text content with slide animation */}
        <span
          className={cn(
            "truncate transition-all duration-200",
            state !== "idle" && "font-medium"
          )}
        >
          {getText()}
        </span>

        {/* Right icon */}
        {iconRight && CurrentIcon && (
          <CurrentIcon
            className={cn(
              "shrink-0 transition-all duration-200",
              isLoading && "animate-spin",
              iconColorClass
            )}
          />
        )}
      </button>
    );
  }
);

ActionButton.displayName = "ActionButton";

export { ActionButton, actionButtonVariants };
export type { ActionButtonProps };
