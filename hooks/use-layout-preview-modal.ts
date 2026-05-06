"use client";

/**
 * Hook for managing layout preview modal state.
 * 
 * Provides a simple interface for opening/closing the layout preview modal
 * and managing the current page.
 */

import { useState, useCallback } from "react";
import type { LayoutPagePreview } from "@/lib/layout-matching";

export interface UseLayoutPreviewModalResult {
  isOpen: boolean;
  currentPageNumber: number | undefined;
  open: (pageNumber?: number) => void;
  close: () => void;
  setPage: (pageNumber: number) => void;
}

export function useLayoutPreviewModal(
  initialPageNumber?: number
): UseLayoutPreviewModalResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPageNumber, setCurrentPageNumber] = useState<number | undefined>(initialPageNumber);
  
  const open = useCallback((pageNumber?: number) => {
    if (pageNumber !== undefined) {
      setCurrentPageNumber(pageNumber);
    }
    setIsOpen(true);
  }, []);
  
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const setPage = useCallback((pageNumber: number) => {
    setCurrentPageNumber(pageNumber);
  }, []);
  
  return {
    isOpen,
    currentPageNumber,
    open,
    close,
    setPage,
  };
}

/**
 * Find the best matching page for a sheet from available pages.
 */
export function findMatchingLayoutPage(
  sheetSlug: string,
  sheetName: string,
  layoutPages: LayoutPagePreview[]
): LayoutPagePreview | undefined {
  // First try to find by normalized title match
  const normalizedSheetName = sheetName.toUpperCase().replace(/[,\s]+/g, " ").trim();
  
  for (const page of layoutPages) {
    if (!page.title) continue;
    
    const normalizedPageTitle = page.title.toUpperCase().replace(/[,\s]+/g, " ").trim();
    
    // Exact match
    if (normalizedPageTitle === normalizedSheetName) {
      return page;
    }
    
    // Contains match
    if (normalizedPageTitle.includes(normalizedSheetName) || 
        normalizedSheetName.includes(normalizedPageTitle)) {
      return page;
    }
  }
  
  // No match found
  return undefined;
}
