/**
 * Hook for managing recently navigated sidebar items.
 * 
 * Stores recent navigations in localStorage scoped by project and sheet.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type { RecentNavItem } from "@/lib/original-wire-list-sidebar";

interface UseOriginalWireListRecentOptions {
  /** Project ID for scoping storage */
  projectId: string;
  /** Sheet name for scoping storage */
  sheetName: string;
  /** Maximum number of recent items to keep */
  maxItems?: number;
}

interface UseOriginalWireListRecentResult {
  /** Recent navigation items */
  recentItems: RecentNavItem[];
  /** Add an item to recent list */
  addRecent: (item: Omit<RecentNavItem, "timestamp">) => void;
  /** Clear all recent items */
  clearRecent: () => void;
  /** Remove a specific recent item */
  removeRecent: (rowId: string) => void;
}

const STORAGE_KEY_PREFIX = "original-wire-list-recent";

function getStorageKey(projectId: string, sheetName: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}:${sheetName}`;
}

export function useOriginalWireListRecent({
  projectId,
  sheetName,
  maxItems = 15,
}: UseOriginalWireListRecentOptions): UseOriginalWireListRecentResult {
  const [recentItems, setRecentItems] = useState<RecentNavItem[]>([]);
  
  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    try {
      const key = getStorageKey(projectId, sheetName);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentNavItem[];
        setRecentItems(parsed);
      }
    } catch (error) {
      console.warn("[useOriginalWireListRecent] Failed to load from localStorage:", error);
    }
  }, [projectId, sheetName]);
  
  // Save to localStorage when items change
  const saveToStorage = useCallback((items: RecentNavItem[]) => {
    if (typeof window === "undefined") return;
    
    try {
      const key = getStorageKey(projectId, sheetName);
      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.warn("[useOriginalWireListRecent] Failed to save to localStorage:", error);
    }
  }, [projectId, sheetName]);
  
  const addRecent = useCallback((item: Omit<RecentNavItem, "timestamp">) => {
    setRecentItems(prev => {
      // Remove existing entry for this row if present
      const filtered = prev.filter(r => r.rowId !== item.rowId);
      
      // Add new item at the front
      const newItem: RecentNavItem = {
        ...item,
        timestamp: Date.now(),
      };
      
      const updated = [newItem, ...filtered].slice(0, maxItems);
      saveToStorage(updated);
      return updated;
    });
  }, [maxItems, saveToStorage]);
  
  const clearRecent = useCallback(() => {
    setRecentItems([]);
    
    if (typeof window === "undefined") return;
    
    try {
      const key = getStorageKey(projectId, sheetName);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("[useOriginalWireListRecent] Failed to clear localStorage:", error);
    }
  }, [projectId, sheetName]);
  
  const removeRecent = useCallback((rowId: string) => {
    setRecentItems(prev => {
      const updated = prev.filter(r => r.rowId !== rowId);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);
  
  return {
    recentItems,
    addRecent,
    clearRecent,
    removeRecent,
  };
}
