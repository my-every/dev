"use client";

import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Replace,
  Search,
  WholeWord,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { BrandListReplacePreview, BrandListSearchMatch } from "@/lib/wire-brand-list/editor-types";
import type { UseBrandListSearchReturn } from "@/components/wire-list/use-brand-list-search";

interface BrandListSearchPanelProps {
  search: UseBrandListSearchReturn;
  onReplaceCurrent: (preview: BrandListReplacePreview) => void;
  onReplaceAll: () => void;
  onJumpToMatch: (match: BrandListSearchMatch) => void;
}

export function BrandListSearchPanel({
  search,
  onReplaceCurrent,
  onReplaceAll,
  onJumpToMatch,
}: BrandListSearchPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [search.searchOpen]);

  if (!search.searchOpen) return null;

  const currentPreview = search.replacePreviews[search.activeMatchIndex] ?? null;
  const safeCount = search.matches.length;

  return (
    <div
      className="shrink-0 border-b bg-background shadow-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          search.closeSearch();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          search.goToNextMatch();
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          search.goToPreviousMatch();
        }
      }}
    >
      <div className="flex items-stretch gap-0">
        {/* Toggle replace */}
        <button
          type="button"
          className="flex w-8 shrink-0 items-center justify-center border-r hover:bg-muted/40"
          onClick={() => {
            if (search.replaceOpen) {
              search.openSearch();
            } else {
              search.openReplace();
            }
          }}
          aria-label={search.replaceOpen ? "Collapse replace" : "Expand replace"}
        >
          {search.replaceOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col divide-y">
          {/* Find row */}
          <div className="flex min-w-0 items-center gap-2 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search.searchOptions.query}
              onChange={(e) => search.setSearchQuery(e.target.value)}
              placeholder="Find..."
              className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />

            {/* Match options */}
            <div className="flex items-center gap-0.5">
              <ToggleIconButton
                active={search.searchOptions.matchCase}
                onClick={() => search.setMatchCase(!search.searchOptions.matchCase)}
                title="Match Case"
              >
                <CaseSensitive className="h-3.5 w-3.5" />
              </ToggleIconButton>
              <ToggleIconButton
                active={search.searchOptions.matchWholeCell}
                onClick={() => search.setMatchWholeCell(!search.searchOptions.matchWholeCell)}
                title="Match Whole Cell"
              >
                <WholeWord className="h-3.5 w-3.5" />
              </ToggleIconButton>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Scope */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => search.setScope("current-sheet")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  search.searchOptions.scope === "current-sheet"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Sheet
              </button>
              <button
                type="button"
                onClick={() => search.setScope("all-sheets")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  search.searchOptions.scope === "all-sheets"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                All
              </button>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Match count */}
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {safeCount === 0
                ? "No results"
                : `${search.activeMatchIndex + 1} / ${safeCount}`}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={safeCount === 0}
                onClick={search.goToPreviousMatch}
                title="Previous match (Shift+Enter)"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={safeCount === 0}
                onClick={search.goToNextMatch}
                title="Next match (Enter)"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={search.closeSearch}
              title="Close (Escape)"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Replace row */}
          {search.replaceOpen && (
            <div className="flex min-w-0 items-center gap-2 px-3 py-2">
              <Replace className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                value={search.replaceWith}
                onChange={(e) => search.setReplaceWith(e.target.value)}
                placeholder="Replace with..."
                className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-[11px]"
                disabled={!currentPreview || currentPreview.status !== "safe"}
                onClick={() => currentPreview && onReplaceCurrent(currentPreview)}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-[11px]"
                disabled={safeCount === 0}
                onClick={onReplaceAll}
              >
                Replace All
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Match preview list (when scope = all-sheets or replace open) */}
      {safeCount > 0 && (search.searchOptions.scope === "all-sheets" || search.replaceOpen) && (
        <div className="max-h-48 overflow-y-auto border-t bg-muted/20">
          {(search.replaceOpen ? search.replacePreviews : search.matches.map((m) => ({ match: m, previousValue: m.cellValue, nextValue: m.cellValue, status: "unchanged" as const }))).map(
            (item, index) => {
              const isActive = index === search.activeMatchIndex;
              const isReplace = search.replaceOpen;
              const preview = item as BrandListReplacePreview;
              return (
                <button
                  key={preview.match.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-2 text-left text-xs hover:bg-muted/50",
                    isActive && "bg-primary/10",
                  )}
                  onClick={() => {
                    search.goToMatch(index);
                    onJumpToMatch(preview.match);
                  }}
                >
                  <span className="mt-0.5 shrink-0">
                    {isActive ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-border" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {preview.match.sheetName} — Row {preview.match.rowIndex + 1} — {preview.match.columnLabel}
                    </span>
                    {isReplace && preview.status === "safe" ? (
                      <span className="flex items-center gap-1 truncate text-muted-foreground">
                        <span className="line-through">{preview.previousValue}</span>
                        <span className="text-foreground">{preview.nextValue}</span>
                      </span>
                    ) : (
                      <span className="block truncate text-muted-foreground">
                        <HighlightedValue
                          value={preview.match.cellValue}
                          start={preview.match.matchStart}
                          end={preview.match.matchEnd}
                        />
                      </span>
                    )}
                  </span>
                  {isReplace && (
                    <Badge
                      variant={
                        preview.status === "blocked"
                          ? "solid"
                          : "outline"
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {preview.status}
                    </Badge>
                  )}
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function ToggleIconButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function HighlightedValue({
  value,
  start,
  end,
}: {
  value: string;
  start: number;
  end: number;
}) {
  if (start < 0 || end <= start) return <>{value}</>;
  return (
    <>
      {value.slice(0, start)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 text-yellow-900">{value.slice(start, end)}</mark>
      {value.slice(end)}
    </>
  );
}
