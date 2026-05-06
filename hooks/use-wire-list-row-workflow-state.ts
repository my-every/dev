"use client";

/**
 * Wire List Row Workflow State Hook
 * 
 * Manages the checkbox and comment state for workflow columns.
 * Persists via Share-backed sheet state keyed by project + sheet.
 */

import { useState, useCallback, useEffect } from "react";
import {
  loadWorkflowState,
  saveWorkflowState,
  clearWorkflowState,
  type SheetWorkflowState,
} from "@/lib/persistence/project-storage";

// ============================================================================
// Types
// ============================================================================

export interface WorkflowRowState {
  fromChecked: boolean;
  toChecked: boolean;
  ipvChecked: boolean;
  comment: string;
}

export interface UseWireListRowWorkflowStateOptions {
  /** Project ID for persistence key */
  projectId?: string;
  /** Sheet slug for persistence key */
  sheetSlug?: string;
  /** Whether to persist to localStorage */
  persist?: boolean;
}

export interface UseWireListRowWorkflowStateReturn {
  /** Get state for a row */
  getRowState: (rowId: string) => WorkflowRowState;
  /** Set from checkbox state */
  setFromChecked: (rowId: string, checked: boolean) => void;
  /** Set to checkbox state */
  setToChecked: (rowId: string, checked: boolean) => void;
  /** Set IPV checkbox state */
  setIpvChecked: (rowId: string, checked: boolean) => void;
  /** Set comment */
  setComment: (rowId: string, comment: string) => void;
  /** Clear all state */
  clearAllState: () => void;
  /** Get count of completed rows (both from and to checked) */
  getCompletedCount: () => number;
  /** Map of all row states */
  rowStates: Map<string, WorkflowRowState>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ROW_STATE: WorkflowRowState = {
  fromChecked: false,
  toChecked: false,
  ipvChecked: false,
  comment: "",
};

// ============================================================================
// Hook
// ============================================================================

export function useWireListRowWorkflowState({
  projectId,
  sheetSlug,
  persist = true,
}: UseWireListRowWorkflowStateOptions = {}): UseWireListRowWorkflowStateReturn {
  const canPersist = Boolean(projectId && sheetSlug && persist);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);

  const [rowStates, setRowStates] = useState<Map<string, WorkflowRowState>>(new Map());

  useEffect(() => {
    let cancelled = false;

    if (!canPersist || !projectId || !sheetSlug) {
      setRowStates(new Map());
      setHasLoadedPersistedState(true);
      return () => {
        cancelled = true;
      };
    }

    setHasLoadedPersistedState(false);

    void loadWorkflowState(projectId, sheetSlug).then((state) => {
      if (cancelled) return;
      setRowStates(new Map(Object.entries(state) as Array<[string, WorkflowRowState]>));
      setHasLoadedPersistedState(true);
    });

    return () => {
      cancelled = true;
    };
  }, [canPersist, projectId, sheetSlug]);

  useEffect(() => {
    if (!canPersist || !projectId || !sheetSlug || !hasLoadedPersistedState) return;

    const serializable = Object.fromEntries(rowStates.entries()) as SheetWorkflowState;
    void saveWorkflowState(projectId, sheetSlug, serializable);
  }, [rowStates, canPersist, hasLoadedPersistedState, projectId, sheetSlug]);

  const getRowState = useCallback((rowId: string): WorkflowRowState => {
    return rowStates.get(rowId) || { ...DEFAULT_ROW_STATE };
  }, [rowStates]);

  const updateRowState = useCallback((rowId: string, updates: Partial<WorkflowRowState>) => {
    setRowStates(prev => {
      const newMap = new Map(prev);
      const currentState = prev.get(rowId) || { ...DEFAULT_ROW_STATE };
      newMap.set(rowId, { ...currentState, ...updates });
      return newMap;
    });
  }, []);

  const setFromChecked = useCallback((rowId: string, checked: boolean) => {
    updateRowState(rowId, { fromChecked: checked });
  }, [updateRowState]);

  const setToChecked = useCallback((rowId: string, checked: boolean) => {
    updateRowState(rowId, { toChecked: checked });
  }, [updateRowState]);

  const setIpvChecked = useCallback((rowId: string, checked: boolean) => {
    updateRowState(rowId, { ipvChecked: checked });
  }, [updateRowState]);

  const setComment = useCallback((rowId: string, comment: string) => {
    updateRowState(rowId, { comment });
  }, [updateRowState]);

  const clearAllState = useCallback(() => {
    setRowStates(new Map());
    if (canPersist && projectId && sheetSlug) {
      void clearWorkflowState(projectId, sheetSlug);
    }
  }, [canPersist, projectId, sheetSlug]);

  const getCompletedCount = useCallback(() => {
    let count = 0;
    for (const state of rowStates.values()) {
      if (state.fromChecked && state.toChecked) {
        count++;
      }
    }
    return count;
  }, [rowStates]);

  return {
    getRowState,
    setFromChecked,
    setToChecked,
    setIpvChecked,
    setComment,
    clearAllState,
    getCompletedCount,
    rowStates,
  };
}
