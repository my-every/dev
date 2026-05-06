"use client";

/**
 * Full Screen Search Component
 * 
 * A comprehensive search feature that:
 * - Renders only search results, hiding other page elements
 * - Provides pagination with active page highlighting
 * - Saves recent searches to localStorage
 * - Shows loading skeleton during data fetching
 * - Displays empty state when no results found
 * - Is fully responsive and accessible
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  FileSearch,
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

const RECENT_SEARCHES_KEY = "wire-list-recent-searches";
const MAX_RECENT_SEARCHES = 10;
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============================================================================
// Types
// ============================================================================

interface FullScreenSearchProps {
  /** All rows to search */
  rows: SemanticWireListRow[];
  /** Whether search mode is active */
  isOpen: boolean;
  /** Close search mode */
  onClose: () => void;
  /** Current sheet name for context */
  sheetName?: string;
  /** Loading state */
  isLoading?: boolean;
}

interface SearchResult {
  row: SemanticWireListRow;
  matchedFields: string[];
  relevanceScore: number;
}

interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount: number;
}

// ============================================================================
// Local Storage Helpers
// ============================================================================

function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string, resultCount: number): void {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const recent = getRecentSearches();
    // Remove duplicates
    const filtered = recent.filter(
      (s) => s.query.toLowerCase() !== query.toLowerCase()
    );
    // Add new search at the start
    const updated = [
      { query, timestamp: Date.now(), resultCount },
      ...filtered,
    ].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Silently fail
  }
}

// ============================================================================
// Search Logic
// ============================================================================

function searchRows(
  rows: SemanticWireListRow[],
  query: string
): SearchResult[] {
  if (!query.trim()) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];

  for (const row of rows) {
    const matchedFields: string[] = [];
    let relevanceScore = 0;

    // Search across all relevant fields
    const searchableFields = [
      { key: "wireNo", value: row.wireNo, weight: 3 },
      { key: "fromDeviceId", value: row.fromDeviceId, weight: 2 },
      { key: "toDeviceId", value: row.toDeviceId, weight: 2 },
      { key: "wireType", value: row.wireType, weight: 1 },
      { key: "wireId", value: row.wireId, weight: 1.5 },
      { key: "gauge", value: row.gauge, weight: 1 },
      { key: "fromLocation", value: row.fromLocation, weight: 1 },
      { key: "toLocation", value: row.toLocation, weight: 1 },
    ];

    for (const field of searchableFields) {
      const value = (field.value || "").toLowerCase();
      if (!value) continue;

      for (const term of queryTerms) {
        if (value.includes(term)) {
          if (!matchedFields.includes(field.key)) {
            matchedFields.push(field.key);
          }
          // Exact match gets higher score
          if (value === term) {
            relevanceScore += field.weight * 2;
          } else if (value.startsWith(term)) {
            relevanceScore += field.weight * 1.5;
          } else {
            relevanceScore += field.weight;
          }
        }
      }
    }

    if (matchedFields.length > 0) {
      results.push({ row, matchedFields, relevanceScore });
    }
  }

  // Sort by relevance score (highest first)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================================================================
// Sub-Components
// ============================================================================

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-6 w-24" />
      </div>
      
      {/* Table skeleton */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/50 p-3">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-3 flex gap-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton 
                  key={j} 
                  className="h-4" 
                  style={{ width: `${60 + Math.random() * 60}px` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <FileSearch className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No results found
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        We couldn&apos;t find any wire list entries matching{" "}
        <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>.
        Try adjusting your search terms or check for typos.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        <span className="text-xs text-muted-foreground">Try searching for:</span>
        {["FU", "KA", "WHT", "BLK", "0V"].map((suggestion) => (
          <Badge key={suggestion} variant="outline" className="text-xs cursor-pointer hover:bg-accent">
            {suggestion}
          </Badge>
        ))}
      </div>
    </motion.div>
  );
}

function RecentSearches({
  searches,
  onSelect,
  onClear,
}: {
  searches: RecentSearch[];
  onSelect: (query: string) => void;
  onClear: () => void;
}) {
  if (searches.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Recent Searches</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClear}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((search, idx) => (
          <button
            key={`${search.query}-${idx}`}
            onClick={() => onSelect(search.query)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
              "text-sm bg-muted hover:bg-accent transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
          >
            <span>{search.query}</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {search.resultCount}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalResults,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{startResult}</span>
        {" - "}
        <span className="font-medium text-foreground">{endResult}</span>
        {" of "}
        <span className="font-medium text-foreground">{totalResults}</span>
        {" results"}
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={cn(
            "h-8 rounded-md border border-input bg-background px-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
          aria-label="Select rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Page navigation */}
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {/* First page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-muted-foreground"
                aria-hidden
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-8 w-8 text-sm",
                  currentPage === page && "font-bold"
                )}
                onClick={() => onPageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </Button>
            )
          )}
        </div>

        {/* Next page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim() || !text) return <>{text || "-"}</>;

  const queryTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const lowerText = text.toLowerCase();

  // Find all match positions
  const matches: { start: number; end: number }[] = [];
  for (const term of queryTerms) {
    let pos = 0;
    while ((pos = lowerText.indexOf(term, pos)) !== -1) {
      matches.push({ start: pos, end: pos + term.length });
      pos += 1;
    }
  }

  if (matches.length === 0) return <>{text}</>;

  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start <= last.end) {
      last.end = Math.max(last.end, match.end);
    } else {
      merged.push({ ...match });
    }
  }

  // Build segments
  const segments: { text: string; highlighted: boolean }[] = [];
  let lastEnd = 0;
  for (const match of merged) {
    if (match.start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, match.start), highlighted: false });
    }
    segments.push({ text: text.slice(match.start, match.end), highlighted: true });
    lastEnd = match.end;
  }
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), highlighted: false });
  }

  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlighted ? (
          <mark
            key={idx}
            className="bg-amber-300 text-amber-950 rounded px-0.5 font-semibold"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        )
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FullScreenSearch({
  rows,
  isOpen,
  onClose,
  sheetName,
  isLoading = false,
}: FullScreenSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load recent searches on mount
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (isMountedRef.current) {
      setRecentSearches(getRecentSearches());
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounce search query
  useEffect(() => {
    if (!isOpen) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setDebouncedQuery(query);
      setCurrentPage(1);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, query]);

  // Perform search
  const results = useMemo(() => {
    return searchRows(rows, debouncedQuery);
  }, [rows, debouncedQuery]);

  // Save to recent searches when query changes with results
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (debouncedQuery.trim() && results.length > 0) {
      saveRecentSearch(debouncedQuery, results.length);

      if (isMountedRef.current) {
        setRecentSearches(getRecentSearches());
      }
    }
  }, [isOpen, debouncedQuery, results.length]);

  // Paginate results
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));

  // Handle page size change
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Handle recent search selection
  const handleSelectRecentSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    inputRef.current?.focus();
  }, []);

  // Handle clear recent searches
  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container max-w-6xl mx-auto px-4 py-4">
              <div className="flex items-center gap-4">
                {/* Back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                  aria-label="Close search"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                {/* Search input */}
                <div className="relative flex-1 max-w-2xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="search"
                    placeholder="Search wire list entries..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base"
                    aria-label="Search wire list"
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Result count badge */}
                {debouncedQuery && !isSearching && (
                  <Badge
                    variant={results.length > 0 ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {/* Sheet context */}
              {sheetName && (
                <p className="mt-2 ml-12 text-sm text-muted-foreground">
                  Searching in: <span className="font-medium">{sheetName}</span>
                </p>
              )}
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div className="container max-w-6xl mx-auto px-4 py-6">
              {isLoading || isSearching ? (
                <SearchSkeleton />
              ) : !debouncedQuery ? (
                /* Initial state with recent searches */
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-md">
                    <RecentSearches
                      searches={recentSearches}
                      onSelect={handleSelectRecentSearch}
                      onClear={handleClearRecentSearches}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Search Wire List
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Search across all fields including wire numbers, device IDs,
                      wire types, colors, and locations.
                    </p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <EmptyState query={debouncedQuery} />
              ) : (
                /* Results */
                <div>
                  {/* Results table */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold">#</TableHead>
                          <TableHead className="font-semibold">Wire No.</TableHead>
                          <TableHead className="font-semibold">From</TableHead>
                          <TableHead className="font-semibold">To</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">Color</TableHead>
                          <TableHead className="font-semibold">Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedResults.map((result, idx) => {
                          const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                          return (
                            <TableRow
                              key={result.row.rowId || idx}
                              className="hover:bg-accent/50"
                            >
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                {rowNumber}
                              </TableCell>
                              <TableCell className="font-medium">
                                <HighlightedText
                                  text={result.row.wireNo}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                              <TableCell>
                                <HighlightedText
                                  text={result.row.fromDeviceId}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                              <TableCell>
                                <HighlightedText
                                  text={result.row.toDeviceId}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                              <TableCell>
                                <HighlightedText
                                  text={result.row.wireType}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                              <TableCell>
                                <HighlightedText
                                  text={result.row.wireId}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                              <TableCell>
                                <HighlightedText
                                  text={result.row.gauge}
                                  query={debouncedQuery}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalResults={results.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={handlePageSizeChange}
                    />
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
