"use client";

import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  BrandListChangeEntry,
  BrandListChangeSource,
  BrandListColumnKey,
  BrandListHistoryEntry,
  BrandListUndoRedoTransaction,
} from "@/lib/wire-brand-list/editor-types";

const COLUMN_LABELS: Record<BrandListColumnKey, string> = {
  fromDeviceId: "From Device",
  wireNo: "Wire No.",
  wireId: "Wire ID",
  gaugeSize: "Gauge",
  length: "Length",
  toDeviceId: "To Device",
  toLocation: "To Location",
  bundleDisplay: "Bundle Display",
};

const MAX_UNDO_STACK = 100;

export interface BrandListHistoryState {
  entries: BrandListHistoryEntry[];
  undoStack: BrandListUndoRedoTransaction[];
  redoStack: BrandListUndoRedoTransaction[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface UseBrandListHistoryReturn extends BrandListHistoryState {
  pushChange: (change: Omit<BrandListChangeEntry, "id" | "timestamp" | "columnLabel">) => void;
  pushBulkTransaction: (
    changes: Omit<BrandListChangeEntry, "id" | "timestamp" | "columnLabel">[],
    source: BrandListChangeSource,
    label: string,
  ) => void;
  undo: () => BrandListUndoRedoTransaction | null;
  redo: () => BrandListUndoRedoTransaction | null;
  revertEntry: (entryId: string) => BrandListChangeEntry | null;
  clearHistory: () => void;
}

function buildEntry(
  raw: Omit<BrandListChangeEntry, "id" | "timestamp" | "columnLabel">,
): BrandListHistoryEntry {
  return {
    ...raw,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    columnLabel: COLUMN_LABELS[raw.column] ?? raw.column,
  };
}

export function useBrandListHistory(): UseBrandListHistoryReturn {
  const [entries, setEntries] = useState<BrandListHistoryEntry[]>([]);
  const [undoStack, setUndoStack] = useState<BrandListUndoRedoTransaction[]>([]);
  const [redoStack, setRedoStack] = useState<BrandListUndoRedoTransaction[]>([]);

  // Keep a ref so callbacks are always current without re-creating
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const pushChange = useCallback(
    (raw: Omit<BrandListChangeEntry, "id" | "timestamp" | "columnLabel">) => {
      const entry = buildEntry(raw);
      const tx: BrandListUndoRedoTransaction = {
        id: uuidv4(),
        timestamp: entry.timestamp,
        source: raw.source,
        label: `Edit ${COLUMN_LABELS[raw.column] ?? raw.column}`,
        changes: [entry],
      };
      setEntries((prev) => [...prev, entry]);
      setUndoStack((prev) => {
        const next = [...prev, tx];
        return next.length > MAX_UNDO_STACK ? next.slice(next.length - MAX_UNDO_STACK) : next;
      });
      setRedoStack([]);
    },
    [],
  );

  const pushBulkTransaction = useCallback(
    (
      raws: Omit<BrandListChangeEntry, "id" | "timestamp" | "columnLabel">[],
      source: BrandListChangeSource,
      label: string,
    ) => {
      const now = new Date().toISOString();
      const builtEntries = raws.map((r) => ({
        ...buildEntry(r),
        timestamp: now,
      }));
      const tx: BrandListUndoRedoTransaction = {
        id: uuidv4(),
        timestamp: now,
        source,
        label,
        changes: builtEntries,
      };
      setEntries((prev) => [...prev, ...builtEntries]);
      setUndoStack((prev) => {
        const next = [...prev, tx];
        return next.length > MAX_UNDO_STACK ? next.slice(next.length - MAX_UNDO_STACK) : next;
      });
      setRedoStack([]);
    },
    [],
  );

  const undo = useCallback((): BrandListUndoRedoTransaction | null => {
    let popped: BrandListUndoRedoTransaction | null = null;
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      popped = next.pop()!;
      return next;
    });
    if (!popped) return null;
    const tx = popped as BrandListUndoRedoTransaction;
    // Record the undo action in history
    const undoEntries: BrandListHistoryEntry[] = tx.changes.map((c) => ({
      ...c,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: "undo" as BrandListChangeSource,
      previousValue: c.nextValue,
      nextValue: c.previousValue,
      columnLabel: c.columnLabel,
    }));
    setEntries((prev) => [...prev, ...undoEntries]);
    setRedoStack((prev) => {
      const redoTx: BrandListUndoRedoTransaction = {
        ...tx,
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        source: "redo",
        label: `Undo: ${tx.label}`,
        // For redo: swap previousValue/nextValue
        changes: tx.changes.map((c) => ({
          ...c,
          previousValue: c.nextValue,
          nextValue: c.previousValue,
        })),
      };
      return [...prev, redoTx];
    });
    return tx;
  }, []);

  const redo = useCallback((): BrandListUndoRedoTransaction | null => {
    let popped: BrandListUndoRedoTransaction | null = null;
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      popped = next.pop()!;
      return next;
    });
    if (!popped) return null;
    const tx = popped as BrandListUndoRedoTransaction;
    const redoEntries: BrandListHistoryEntry[] = tx.changes.map((c) => ({
      ...c,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: "redo" as BrandListChangeSource,
      columnLabel: c.columnLabel,
    }));
    setEntries((prev) => [...prev, ...redoEntries]);
    setUndoStack((prev) => {
      const undoTx: BrandListUndoRedoTransaction = {
        ...tx,
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        source: "undo",
        label: `Redo: ${tx.label}`,
        changes: tx.changes.map((c) => ({
          ...c,
          previousValue: c.nextValue,
          nextValue: c.previousValue,
        })),
      };
      const next = [...prev, undoTx];
      return next.length > MAX_UNDO_STACK ? next.slice(next.length - MAX_UNDO_STACK) : next;
    });
    return tx;
  }, []);

  const revertEntry = useCallback((entryId: string): BrandListChangeEntry | null => {
    const all = entriesRef.current;
    const target = all.find((e) => e.id === entryId);
    if (!target) return null;
    const revertChange: BrandListChangeEntry = {
      ...target,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: "revert",
      previousValue: target.nextValue,
      nextValue: target.previousValue,
    };
    setEntries((prev) => [...prev, { ...revertChange }]);
    return revertChange;
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    entries,
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushChange,
    pushBulkTransaction,
    undo,
    redo,
    revertEntry,
    clearHistory,
  };
}
