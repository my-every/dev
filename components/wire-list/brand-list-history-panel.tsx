"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  CopyIcon,
  CornerUpLeft,
  Filter,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrandListChangeSource, BrandListHistoryEntry } from "@/lib/wire-brand-list/editor-types";
import type { UseBrandListHistoryReturn } from "@/components/wire-list/use-brand-list-history";

type HistoryFilter =
  | "all"
  | "current-sheet"
  | "manual-edits"
  | "replace"
  | "approval";

const SOURCE_LABELS: Record<BrandListChangeSource, string> = {
  "manual-edit": "Edit",
  paste: "Paste",
  replace: "Replace",
  regenerate: "Regenerate",
  approval: "Approval",
  undo: "Undo",
  redo: "Redo",
  import: "Import",
  merge: "Merge",
  revert: "Revert",
};

const SOURCE_COLORS: Partial<Record<BrandListChangeSource, string>> = {
  "manual-edit": "bg-blue-100 text-blue-800",
  replace: "bg-purple-100 text-purple-800",
  approval: "bg-emerald-100 text-emerald-800",
  undo: "bg-amber-100 text-amber-800",
  redo: "bg-amber-100 text-amber-800",
  revert: "bg-rose-100 text-rose-800",
  regenerate: "bg-orange-100 text-orange-800",
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

interface BrandListHistoryPanelProps {
  open: boolean;
  history: UseBrandListHistoryReturn;
  activeSheetSlug: string | null;
  activeSheetName: string | null;
  onClose: () => void;
  onJumpToCell: (entry: BrandListHistoryEntry) => void;
  onRevert: (entry: BrandListHistoryEntry) => void;
}

export function BrandListHistoryPanel({
  open,
  history,
  activeSheetSlug,
  activeSheetName,
  onClose,
  onJumpToCell,
  onRevert,
}: BrandListHistoryPanelProps) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filteredEntries = useMemo(() => {
    const all = [...history.entries].reverse(); // newest first
    switch (filter) {
      case "current-sheet":
        return all.filter((e) => e.sheetSlug === activeSheetSlug);
      case "manual-edits":
        return all.filter((e) => e.source === "manual-edit" || e.source === "paste");
      case "replace":
        return all.filter((e) => e.source === "replace");
      case "approval":
        return all.filter((e) => e.source === "approval");
      default:
        return all;
    }
  }, [history.entries, filter, activeSheetSlug]);

  if (!open) return null;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Change History</span>
          {filteredEntries.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {filteredEntries.length}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {(
          [
            { value: "all", label: "All" },
            { value: "current-sheet", label: activeSheetName ?? "Sheet" },
            { value: "manual-edits", label: "Edits" },
            { value: "replace", label: "Replace" },
            { value: "approval", label: "Approval" },
          ] as { value: HistoryFilter; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              filter === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Clock className="h-8 w-8 opacity-30" />
            <span className="text-sm">No history yet</span>
            <span className="text-xs">Changes will appear here as you edit.</span>
          </div>
        ) : (
          <div className="divide-y">
            {filteredEntries.map((entry) => (
              <HistoryEntryRow
                key={entry.id}
                entry={entry}
                onJumpToCell={onJumpToCell}
                onRevert={onRevert}
              />
            ))}
          </div>
        )}
      </div>

      {/* Undo/Redo footer */}
      <div className="flex items-center justify-between border-t px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {history.undoStack.length} undo{history.undoStack.length !== 1 ? "s" : ""} available
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
            title="Undo (Cmd+Z)"
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!history.canRedo}
            onClick={() => history.redo()}
            title="Redo (Cmd+Shift+Z)"
          >
            Redo
          </Button>
        </div>
      </div>
    </aside>
  );
}

function HistoryEntryRow({
  entry,
  onJumpToCell,
  onRevert,
}: {
  entry: BrandListHistoryEntry;
  onJumpToCell: (entry: BrandListHistoryEntry) => void;
  onRevert: (entry: BrandListHistoryEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sourceColor = SOURCE_COLORS[entry.source] ?? "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "group px-4 py-2.5 text-xs",
        entry.isReverted && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", sourceColor)}>
              {SOURCE_LABELS[entry.source]}
            </span>
            <span className="truncate font-medium text-foreground">
              {entry.columnLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
            <span className="truncate">{entry.sheetName}</span>
            <span>·</span>
            <span>Row {entry.rowIndex + 1}</span>
            <span>·</span>
            <span>{formatTimestamp(entry.timestamp)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Jump to cell"
            onClick={() => onJumpToCell(entry)}
          >
            <CornerUpLeft className="h-3 w-3" />
          </Button>
          {!entry.isReverted && entry.source !== "revert" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Revert this change"
              onClick={() => onRevert(entry)}
            >
              <CornerUpLeft className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Value diff */}
      <button
        type="button"
        className="mt-1 flex w-full items-start gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1 truncate text-muted-foreground">
            <span className="text-[10px] uppercase tracking-[0.06em]">Before</span>
            <span className="truncate font-mono text-[11px]">
              {entry.previousValue === null || entry.previousValue === ""
                ? <em className="opacity-50">empty</em>
                : String(entry.previousValue)}
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(String(entry.previousValue ?? ""));
              }}
              title="Copy previous value"
            >
              <CopyIcon className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-1 truncate">
            <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">After</span>
            <span className="truncate font-mono text-[11px] font-medium text-foreground">
              {entry.nextValue === null || entry.nextValue === ""
                ? <em className="opacity-50 text-muted-foreground">empty</em>
                : String(entry.nextValue)}
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(String(entry.nextValue ?? ""));
              }}
              title="Copy new value"
            >
              <CopyIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      </button>
    </div>
  );
}
