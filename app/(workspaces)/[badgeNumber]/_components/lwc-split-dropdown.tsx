"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LWCSplitDropdownOption = {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
};

type LWCSplitDropdownProps = {
  options: LWCSplitDropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  ariaLabel?: string;
  cycleOnPrimaryClick?: boolean;
  primaryIcon?: ReactNode;
  iconOnly?: boolean;
};

export function LWCSplitDropdown({
  options,
  selectedId,
  onSelect,
  className,
  ariaLabel = "Choose filter",
  cycleOnPrimaryClick = true,
  primaryIcon,
  iconOnly = false,
}: LWCSplitDropdownProps) {
  const [open, setOpen] = useState(false);

  if (options.length === 0) {
    return null;
  }

  const selectedOption =
    options.find((option) => option.id === selectedId) ?? options[0];

  const handlePrimaryClick = () => {
    if (!cycleOnPrimaryClick || options.length === 1) {
      onSelect(selectedOption.id);
      return;
    }

    const selectedIndex = options.findIndex(
      (option) => option.id === selectedOption.id
    );
    const nextIndex = (selectedIndex + 1) % options.length;
    onSelect(options[nextIndex].id);
  };

  return (
    <div
      className={cn(
        "inline-flex h-10 shrink-0 overflow-hidden rounded-2xl border border-border bg-background",
        className
      )}
    >
      <button
        type="button"
        onClick={handlePrimaryClick}
        className={cn(
          "inline-flex items-center gap-2.5 px-3 text-sm text-foreground transition-colors hover:bg-accent",
          iconOnly && "justify-center px-2.5"
        )}
        aria-label={`${selectedOption.label} filter`}
        title={selectedOption.label}
      >
        {iconOnly ? (
          primaryIcon ??
          (selectedOption.icon ? (
            <selectedOption.icon className="h-4 w-4" />
          ) : (
            <span className="text-base leading-none">{selectedOption.label[0]}</span>
          ))
        ) : (
          <>
            {selectedOption.icon ? (
              <selectedOption.icon className="h-4 w-4 text-muted-foreground" />
            ) : null}
            <span>{selectedOption.label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {selectedOption.count ?? 0}
            </span>
          </>
        )}
      </button>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center border-l border-border px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={ariaLabel}
          >
            {open ? (
              <ChevronsDownUp className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2",
                selectedOption.id === option.id && "bg-accent"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {option.icon ? (
                  <option.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span>{option.label}</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {option.count ?? 0}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
