"use client";

/**
 * Wire No. Search Component
 * 
 * A focused search control for searching Wire No. values only.
 * Displays match count and provides clear functionality.
 */

import { useRef, useEffect } from "react";
import { Search, X, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ============================================================================
// Types
// ============================================================================

interface WireNoSearchProps {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Callback to clear search */
  onClear: () => void;
  /** Number of matches found */
  matchCount: number;
  /** Total number of rows */
  totalRows: number;
  /** Whether search is active */
  isActive: boolean;
  /** Whether search mode is enabled */
  searchModeEnabled: boolean;
  /** Toggle search mode */
  onToggleSearchMode: () => void;
  /** Callback when input focus changes */
  onFocusChange?: (focused: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WireNoSearch({
  value,
  onChange,
  onClear,
  matchCount,
  totalRows,
  isActive,
  searchModeEnabled,
  onToggleSearchMode,
  onFocusChange,
}: WireNoSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search mode is enabled
  useEffect(() => {
    if (searchModeEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchModeEnabled]);

  return (
    <Popover open={searchModeEnabled} onOpenChange={(open) => {
      if (!open) onToggleSearchMode();
    }}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={onToggleSearchMode}
        >
          <Hash className="h-4 w-4" />
          Wire No.
          {isActive && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {matchCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Search Wire No.</span>
            {isActive && (
              <span className="text-xs text-muted-foreground">
                {matchCount} of {totalRows} rows
              </span>
            )}
          </div>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="e.g., FU0139, 0V, KA0243..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => onFocusChange?.(true)}
              onBlur={() => onFocusChange?.(false)}
              className="pl-8 pr-8"
            />
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                onClick={onClear}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {isActive && matchCount === 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-center text-sm text-muted-foreground">
              No wire numbers matched &ldquo;{value}&rdquo;
            </div>
          )}

          {!isActive && (
            <p className="text-xs text-muted-foreground">
              Search for specific wire numbers. Matching cells will be highlighted in the table.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Highlighted Cell Component
// ============================================================================

interface HighlightedWireNoCellProps {
  /** The Wire No. value */
  wireNo: string;
  /** The search query to highlight */
  query: string;
  /** Whether this row has a match */
  hasMatch: boolean;
}

/**
 * Renders a Wire No. cell with highlighted matching text.
 */
export function HighlightedWireNoCell({
  wireNo,
  query,
  hasMatch,
}: HighlightedWireNoCellProps) {
  if (!hasMatch || !query.trim()) {
    return <span className={!wireNo ? "text-muted-foreground" : ""}>{wireNo || "-"}</span>;
  }

  // Split into segments for highlighting
  const segments: { text: string; highlighted: boolean }[] = [];
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedWireNo = wireNo.toLowerCase();
  
  let lastIndex = 0;
  let searchIndex = 0;

  while (searchIndex < normalizedWireNo.length) {
    const foundIndex = normalizedWireNo.indexOf(normalizedQuery, searchIndex);
    
    if (foundIndex === -1) {
      if (lastIndex < wireNo.length) {
        segments.push({ text: wireNo.slice(lastIndex), highlighted: false });
      }
      break;
    }
    
    if (foundIndex > lastIndex) {
      segments.push({ text: wireNo.slice(lastIndex, foundIndex), highlighted: false });
    }
    
    segments.push({
      text: wireNo.slice(foundIndex, foundIndex + normalizedQuery.length),
      highlighted: true,
    });
    
    lastIndex = foundIndex + normalizedQuery.length;
    searchIndex = foundIndex + 1;
  }

  if (segments.length === 0) {
    segments.push({ text: wireNo, highlighted: false });
  }

  return (
    <span>
      {segments.map((segment, idx) => (
        segment.highlighted ? (
          <mark
            key={idx}
            className="bg-amber-300 text-amber-950 rounded px-0.5 font-semibold"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      ))}
    </span>
  );
}
