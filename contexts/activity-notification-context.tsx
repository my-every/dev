"use client";

/**
 * ActivityNotificationContext
 *
 * Manages activity notification state for auto-opening/closing the activity aside.
 * When a new activity is logged, it triggers a flash notification that:
 * 1. Opens the activity aside
 * 2. Highlights the new entry
 * 3. Auto-closes after 3 seconds (unless user hovers/interacts)
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type { ActivityEntry } from "@/types/activity";

const AUTO_CLOSE_DELAY = 3000; // 3 seconds

interface ActivityNotificationContextValue {
  /** The most recent activity entry that triggered a notification */
  pendingActivity: ActivityEntry | null;
  /** ID of the activity to highlight in the timeline */
  highlightedActivityId: string | null;
  /** Whether the aside flash animation is active */
  isFlashActive: boolean;
  /** Notify that a new activity was logged - triggers aside open + highlight */
  notifyActivity: (entry: ActivityEntry) => void;
  /** Clear the pending notification */
  clearNotification: () => void;
  /** Pause auto-close (e.g., when user hovers over aside) */
  pauseAutoClose: () => void;
  /** Resume auto-close countdown */
  resumeAutoClose: () => void;
  /** Cancel auto-close entirely (e.g., user clicked inside aside) */
  cancelAutoClose: () => void;
}

const ActivityNotificationContext = createContext<ActivityNotificationContextValue | null>(null);

interface ActivityNotificationProviderProps {
  children: ReactNode;
  /** Callback to open the activity aside */
  onOpenAside?: () => void;
  /** Callback to close the activity aside */
  onCloseAside?: () => void;
}

export function ActivityNotificationProvider({
  children,
  onOpenAside,
  onCloseAside,
}: ActivityNotificationProviderProps) {
  const [pendingActivity, setPendingActivity] = useState<ActivityEntry | null>(null);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);

  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const remainingTimeRef = useRef(AUTO_CLOSE_DELAY);
  const pauseStartTimeRef = useRef<number | null>(null);

  const clearAutoCloseTimeout = useCallback(() => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  }, []);

  const startAutoCloseTimeout = useCallback((delay: number = AUTO_CLOSE_DELAY) => {
    clearAutoCloseTimeout();
    if (isCancelledRef.current) return;

    remainingTimeRef.current = delay;
    autoCloseTimeoutRef.current = setTimeout(() => {
      if (!isPausedRef.current && !isCancelledRef.current) {
        setIsFlashActive(false);
        setHighlightedActivityId(null);
        setPendingActivity(null);
        onCloseAside?.();
      }
    }, delay);
  }, [clearAutoCloseTimeout, onCloseAside]);

  const notifyActivity = useCallback((entry: ActivityEntry) => {
    // Reset state for new notification
    isCancelledRef.current = false;
    isPausedRef.current = false;
    remainingTimeRef.current = AUTO_CLOSE_DELAY;

    setPendingActivity(entry);
    setHighlightedActivityId(entry.id);
    setIsFlashActive(true);

    // Open the aside
    onOpenAside?.();

    // Start auto-close countdown
    startAutoCloseTimeout(AUTO_CLOSE_DELAY);

    // Clear highlight after animation completes (keep aside open until auto-close)
    setTimeout(() => {
      setIsFlashActive(false);
    }, 1000); // Flash animation duration
  }, [onOpenAside, startAutoCloseTimeout]);

  const clearNotification = useCallback(() => {
    clearAutoCloseTimeout();
    setPendingActivity(null);
    setHighlightedActivityId(null);
    setIsFlashActive(false);
    isCancelledRef.current = false;
    isPausedRef.current = false;
  }, [clearAutoCloseTimeout]);

  const pauseAutoClose = useCallback(() => {
    if (isPausedRef.current || isCancelledRef.current) return;

    isPausedRef.current = true;
    pauseStartTimeRef.current = Date.now();
    clearAutoCloseTimeout();
  }, [clearAutoCloseTimeout]);

  const resumeAutoClose = useCallback(() => {
    if (!isPausedRef.current || isCancelledRef.current) return;

    isPausedRef.current = false;

    // Calculate remaining time
    if (pauseStartTimeRef.current && autoCloseTimeoutRef.current === null) {
      const elapsed = Date.now() - pauseStartTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      if (remaining > 0) {
        startAutoCloseTimeout(remaining);
      } else {
        // Time expired while paused, close now
        setIsFlashActive(false);
        setHighlightedActivityId(null);
        setPendingActivity(null);
        onCloseAside?.();
      }
    }

    pauseStartTimeRef.current = null;
  }, [onCloseAside, startAutoCloseTimeout]);

  const cancelAutoClose = useCallback(() => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    clearAutoCloseTimeout();
    // Keep aside open, clear highlight
    setHighlightedActivityId(null);
    setIsFlashActive(false);
  }, [clearAutoCloseTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoCloseTimeout();
    };
  }, [clearAutoCloseTimeout]);

  const value: ActivityNotificationContextValue = {
    pendingActivity,
    highlightedActivityId,
    isFlashActive,
    notifyActivity,
    clearNotification,
    pauseAutoClose,
    resumeAutoClose,
    cancelAutoClose,
  };

  return (
    <ActivityNotificationContext.Provider value={value}>
      {children}
    </ActivityNotificationContext.Provider>
  );
}

export function useActivityNotification(): ActivityNotificationContextValue {
  const context = useContext(ActivityNotificationContext);

  if (!context) {
    // Return a no-op implementation if used outside provider
    return {
      pendingActivity: null,
      highlightedActivityId: null,
      isFlashActive: false,
      notifyActivity: () => {},
      clearNotification: () => {},
      pauseAutoClose: () => {},
      resumeAutoClose: () => {},
      cancelAutoClose: () => {},
    };
  }

  return context;
}
