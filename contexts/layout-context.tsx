"use client";

/**
 * Context for sharing layout PDF data across pages.
 * 
 * This context holds the rendered layout pages
 * so they can be accessed from detail pages.
 * 
 * Data is persisted to Share-backed project state for reload durability,
 * with IndexedDB kept as a local cache/fallback for older projects.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  LayoutPagePreview,
  CompatibilityResult,
} from "@/lib/layout-matching";
import {
  saveLayoutPages,
  loadLayoutPages,
  clearLayoutStorage,
} from "@/lib/storage/layout-storage";
import { useProjectContext } from "@/contexts/project-context";

interface LayoutContextValue {
  // Data
  layoutPages: LayoutPagePreview[];
  compatibility: CompatibilityResult | null;

  // Setters
  setLayoutPages: (pages: LayoutPagePreview[]) => void;
  setCompatibility: (result: CompatibilityResult | null) => void;

  // Helpers
  getPageForSheet: (sheetSlug: string) => LayoutPagePreview | undefined;
  clearLayoutData: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
  children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const { currentProjectId, currentProject } = useProjectContext();
  const [layoutPages, setLayoutPagesState] = useState<LayoutPagePreview[]>([]);
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track if we're currently saving to avoid race conditions
  const isSavingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load persisted layout data for the active project.
  useEffect(() => {
    let isCancelled = false;

    async function loadFromStorage() {
      if (!currentProjectId) {
        if (!isMountedRef.current || isCancelled) {
          return;
        }

        setLayoutPagesState([]);
        setCompatibility(null);
        setIsLoaded(true);
        return;
      }

      try {
        const pages = await loadLayoutPages(currentProjectId);

        if (!isMountedRef.current || isCancelled) {
          return;
        }

        setLayoutPagesState(pages);
        setCompatibility(null);
      } catch (err) {
        if (!isMountedRef.current || isCancelled) {
          return;
        }

        console.error("Failed to load layout data from persisted storage:", err);
      } finally {
        if (!isMountedRef.current || isCancelled) {
          return;
        }

        setIsLoaded(true);
      }
    }

    loadFromStorage();

    return () => {
      isCancelled = true;
    };
  }, [currentProjectId]);

  // Wrapper to save pages to persisted storage and the local cache.
  const setLayoutPages = useCallback((pages: LayoutPagePreview[]) => {
    setLayoutPagesState(pages);
    if (!currentProjectId) return;

    // Save to IndexedDB asynchronously
    if (!isSavingRef.current) {
      isSavingRef.current = true;
      saveLayoutPages(pages, currentProjectId, {
        pdNumber: currentProject?.pdNumber,
        projectName: currentProject?.name,
      })
        .catch(err => console.error("Failed to save layout pages:", err))
        .finally(() => { isSavingRef.current = false; });
    }
  }, [currentProject?.name, currentProject?.pdNumber, currentProjectId]);

  const getPageForSheet = useCallback((_sheetSlug: string): LayoutPagePreview | undefined => {
    // Layout pages are matched by pageNumber stored in assignment mappings.
    // The caller should use getPageByNumber instead.
    return undefined;
  }, []);

  const clearLayoutData = useCallback(() => {
    setLayoutPagesState([]);
    setCompatibility(null);

    // Clear IndexedDB asynchronously
    clearLayoutStorage(currentProjectId ?? undefined)
      .catch(err => console.error("Failed to clear layout storage:", err));
  }, [currentProjectId]);

  const value: LayoutContextValue = {
    layoutPages,
    compatibility,
    setLayoutPages,
    setCompatibility,
    getPageForSheet,
    clearLayoutData,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

/**
 * Hook to access layout context.
 */
export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext);

  if (!context) {
    // Return a safe default if used outside provider
    return {
      layoutPages: [],
      compatibility: null,
      setLayoutPages: () => { },
      setCompatibility: () => { },
      getPageForSheet: () => undefined,
      clearLayoutData: () => { },
    };
  }

  return context;
}

/**
 * Hook to check if layout data is available for a specific sheet.
 */
export function useSheetLayoutPreview(sheetSlug: string) {
  const { getPageForSheet, layoutPages } = useLayout();

  const page = getPageForSheet(sheetSlug);

  return {
    page,
    hasLayout: !!page,
    allPages: layoutPages,
  };
}
