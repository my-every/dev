/**
 * Hook for scrollspy behavior between sidebar and main wire list.
 * 
 * Handles:
 * - Scrolling to enhanced rows when sidebar items are clicked
 * - Highlighting the active row
 * - Tracking which row is currently visible
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseOriginalWireListScrollspyOptions {
  /** Callback to scroll main table to a row */
  onScrollToRow?: (rowId: string) => void;
  /** Duration of highlight effect in ms */
  highlightDuration?: number;
}

interface UseOriginalWireListScrollspyResult {
  /** Currently active (highlighted) row ID */
  activeRowId: string | null;
  /** Row ID being scrolled to */
  scrollingToRowId: string | null;
  /** Scroll to a row and highlight it */
  scrollToRow: (rowId: string) => void;
  /** Clear the active highlight */
  clearActiveRow: () => void;
  /** Check if a row is the active row */
  isActiveRow: (rowId: string) => boolean;
  /** Register a row element for intersection observation */
  registerRowElement: (rowId: string, element: HTMLElement | null) => void;
  /** Currently visible row ID (from intersection observer) */
  visibleRowId: string | null;
}

export function useOriginalWireListScrollspy({
  onScrollToRow,
  highlightDuration = 2000,
}: UseOriginalWireListScrollspyOptions = {}): UseOriginalWireListScrollspyResult {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [scrollingToRowId, setScrollingToRowId] = useState<string | null>(null);
  const [visibleRowId, setVisibleRowId] = useState<string | null>(null);
  
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rowElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isMountedRef = useRef(false);
  
  // Clear highlight after duration
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);
  
  // Setup intersection observer for visible row tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry
        let mostVisible: IntersectionObserverEntry | null = null;
        let maxRatio = 0;
        
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            mostVisible = entry;
            maxRatio = entry.intersectionRatio;
          }
        }
        
        if (mostVisible) {
          const rowId = (mostVisible.target as HTMLElement).dataset.rowId;
          if (rowId) {
            setVisibleRowId(rowId);
          }
        }
      },
      {
        threshold: [0.25, 0.5, 0.75, 1],
        rootMargin: "-100px 0px -100px 0px", // Account for sticky headers
      }
    );
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);
  
  const scrollToRow = useCallback((rowId: string) => {
    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }
    
    setScrollingToRowId(rowId);
    setActiveRowId(rowId);
    
    // Call the scroll callback
    onScrollToRow?.(rowId);
    
    // Clear scrolling state after a moment
    scrollingTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setScrollingToRowId(null);
    }, 500);
    
    // Clear highlight after duration
    highlightTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setActiveRowId(null);
    }, highlightDuration);
  }, [onScrollToRow, highlightDuration]);
  
  const clearActiveRow = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setActiveRowId(null);
  }, []);
  
  const isActiveRow = useCallback((rowId: string) => {
    return activeRowId === rowId;
  }, [activeRowId]);
  
  const registerRowElement = useCallback((rowId: string, element: HTMLElement | null) => {
    if (element) {
      element.dataset.rowId = rowId;
      rowElementsRef.current.set(rowId, element);
      observerRef.current?.observe(element);
    } else {
      const existing = rowElementsRef.current.get(rowId);
      if (existing) {
        observerRef.current?.unobserve(existing);
        rowElementsRef.current.delete(rowId);
      }
    }
  }, []);
  
  return {
    activeRowId,
    scrollingToRowId,
    scrollToRow,
    clearActiveRow,
    isActiveRow,
    registerRowElement,
    visibleRowId,
  };
}
