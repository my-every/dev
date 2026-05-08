"use client";

import { useCallback, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ManifestAssignmentStatus } from "@/types/project-manifest";

interface StatusOption {
  value: ManifestAssignmentStatus;
  label: string;
  dot: string;
  badge: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "NOT_STARTED",
    label: "Not Started",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    value: "INCOMPLETE",
    label: "Pending",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    value: "COMPLETE",
    label: "Completed",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    value: "GREEN_CHANGE",
    label: "Green Change",
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
];

export function StatusButtonCell({
  currentStatus,
  onSave,
}: {
  currentStatus: string;
  onSave: (newStatus: ManifestAssignmentStatus) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const current = STATUS_OPTIONS.find(
    (o) => o.value === currentStatus || o.value === currentStatus?.toUpperCase(),
  ) ?? STATUS_OPTIONS[0];

  const handleSelect = useCallback(
    async (option: StatusOption) => {
      if (option.value === current.value) { setIsOpen(false); return; }
      setIsSaving(true);
      try {
        await onSave(option.value);
        setIsOpen(false);
      } finally {
        setIsSaving(false);
      }
    },
    [current.value, onSave],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isSaving}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:ring-2 hover:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
            current.badge,
          )}
        >
          {isSaving ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full shrink-0", current.dot)} />
          )}
          {current.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[300] w-52 p-1.5" align="start" sideOffset={4}>
        <div className="space-y-0.5">
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === current.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void handleSelect(option)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", option.dot)} />
                <span className="flex-1">{option.label}</span>
                {isActive && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
