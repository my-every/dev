"use client";

/**
 * I/O Module Termination Guide component.
 * Renders terminal matrix for Allen-Bradley-style I/O modules (AF family).
 *
 * Shows a grid layout with terminal numbers and highlights used terminals.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type TerminationGuideProps } from "@/lib/device-details/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeviceProperty } from "@/components/device/device-property";
import { cn } from "@/lib/utils";
import { Minus, Plus, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MODULE_COLUMNS = Array.from({ length: 16 }, (_, index) => index);
const TERMINAL_ROWS = [
  Array.from({ length: 16 }, (_, index) => String(index).padStart(2, "0")),
  Array.from({ length: 16 }, (_, index) => String(index + 16).padStart(2, "0")),
  Array.from({ length: 16 }, (_, index) => String(index + 32).padStart(2, "0")),
  Array.from({ length: 16 }, (_, index) => String(index + 48).padStart(2, "0")),
] as const;

const SIDE_RAILS = [
  { label: "COM -", terminal: "COM" },
  { label: "V+", terminal: "V+" },
  { label: "SH", terminal: "SH" },
] as const;
const GUIDE_BASE_WIDTH = 1080;
const GUIDE_BASE_HEIGHT = 560;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.125;

type TerminalVisualState = "unused" | "connection" | "added" | "removed" | "disabled";

function getTerminalVisualState(
  terminal: string,
  usedTerminals: Set<string>,
  terminationsForTerminal: TerminationGuideProps["terminations"],
  disabled = false,
): TerminalVisualState {
  if (disabled) {
    return "disabled";
  }

  if (terminationsForTerminal.some((termination) => termination.changeState === "added")) {
    return "added";
  }

  if (terminationsForTerminal.some((termination) => termination.changeState === "removed")) {
    return "removed";
  }

  if (usedTerminals.has(terminal)) {
    return "connection";
  }

  return "unused";
}

function getTerminalButtonClasses(state: TerminalVisualState, selected = false) {
  return cn(
    "relative flex h-12 w-12 items-center justify-center rounded-xl border text-base font-semibold transition-all duration-150",
    selected && "ring-2 ring-offset-2 ring-offset-slate-100 ring-slate-500",
    state === "connection" && "border-blue-500 bg-blue-500 text-white shadow-sm hover:bg-blue-600",
    state === "added" && "border-lime-500 bg-lime-500 text-white shadow-sm hover:bg-lime-600",
    state === "removed" && "border-rose-400 bg-rose-400 text-white shadow-sm hover:bg-rose-500",
    state === "unused" && "border-slate-300 bg-slate-300 text-slate-50 hover:bg-slate-400",
    state === "disabled" && "border-slate-200 bg-slate-200 text-slate-50",
  );
}

function getRailLabelClasses(enabled: boolean) {
  return enabled ? "text-slate-700" : "text-slate-300";
}

interface NumericTerminalCellProps {
  terminal: string;
  state: TerminalVisualState;
  selected: boolean;
  terminationsForTerminal: TerminationGuideProps["terminations"];
  onTerminalClick?: (terminal: string) => void;
}

function NumericTerminalCell({
  terminal,
  state,
  selected,
  terminationsForTerminal,
  onTerminalClick,
}: NumericTerminalCellProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onTerminalClick?.(terminal)}
          className="flex flex-col items-center gap-3"
          aria-pressed={selected}
        >
          <span className={cn("text-[15px] font-medium tracking-[-0.02em]", selected ? "text-slate-700" : "text-slate-500")}>
            {terminal}
          </span>
          <span className={getTerminalButtonClasses(state, selected)}>
            {state === "unused" || state === "disabled" ? <span className="text-[26px] leading-none">×</span> : null}
          </span>
        </button>
      </TooltipTrigger>
      {terminationsForTerminal.length > 0 && (
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            {terminationsForTerminal.map((rec) => (
              <div key={`${rec.rowId}-${rec.wireNo}`} className="whitespace-nowrap">
                <strong>{rec.wireNo}</strong> ({rec.gaugeSize || "-"}) to {rec.toDeviceId}
              </div>
            ))}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

interface RailTerminalCellProps {
  label: string;
  terminal: string;
  state: TerminalVisualState;
  selected: boolean;
  enabled: boolean;
  align: "left" | "right";
  terminationsForTerminal: TerminationGuideProps["terminations"];
  onTerminalClick?: (terminal: string) => void;
}

function RailTerminalCell({
  label,
  terminal,
  state,
  selected,
  enabled,
  align,
  terminationsForTerminal,
  onTerminalClick,
}: RailTerminalCellProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => enabled && onTerminalClick?.(terminal)}
          disabled={!enabled}
          className={cn(
            "flex min-w-16 flex-col items-center gap-3 disabled:cursor-default",
            align === "left" ? "mr-1" : "ml-1",
          )}
          aria-pressed={selected}
        >
          <span className={cn("text-[15px] font-semibold tracking-[-0.02em]", getRailLabelClasses(enabled))}>
            {label}
          </span>
          <span className={getTerminalButtonClasses(state, selected)}>
            {state === "unused" || state === "disabled" ? <span className="text-[26px] leading-none">×</span> : null}
          </span>
        </button>
      </TooltipTrigger>
      {terminationsForTerminal.length > 0 && (
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            {terminationsForTerminal.map((rec) => (
              <div key={`${rec.rowId}-${rec.wireNo}`} className="whitespace-nowrap">
                <strong>{rec.wireNo}</strong> ({rec.gaugeSize || "-"}) to {rec.toDeviceId}
              </div>
            ))}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function IOModuleTerminationGuide({
  deviceId,
  description,
  terminations,
  usedTerminals,
  usedTerminalList = [],
  partNumbers = [],
  selectedTerminal = null,
  onTerminalClick,
}: TerminationGuideProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(GUIDE_BASE_WIDTH);
  const [contentHeight, setContentHeight] = useState(GUIDE_BASE_HEIGHT);
  const [zoom, setZoom] = useState(1);
  const usedCount = usedTerminals.size;
  const totalCount = 64;
  const normalizedDeviceId = deviceId.toUpperCase();
  const hasShTermination = usedTerminals.has("SH");

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      setContainerWidth(node.clientWidth || GUIDE_BASE_WIDTH);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      setContentHeight(node.offsetHeight || GUIDE_BASE_HEIGHT);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!containerWidth) {
      return 1;
    }

    return Math.min(1, containerWidth / GUIDE_BASE_WIDTH);
  }, [containerWidth]);

  const effectiveScale = fitScale * zoom;
  const guideHeight = contentHeight * effectiveScale;
  const displayedTerminations = useMemo(() => {
    if (!selectedTerminal) {
      return terminations;
    }

    return terminations.filter((termination) => termination.terminal === selectedTerminal);
  }, [selectedTerminal, terminations]);

  const terminationMap = useMemo(() => {
    const map = new Map<string, typeof terminations>();

    for (const termination of terminations) {
      const key = termination.terminal;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(termination);
    }

    return map;
  }, [terminations]);

  const getTerminationsForTerminal = (terminal: string) => {
    return terminationMap.get(terminal) ?? [];
  };

  const handleZoomIn = () => {
    setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(3))));
  };

  const handleZoomOut = () => {
    setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(3))));
  };

  const handleFit = () => {
    setZoom(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
  
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {usedCount}/{totalCount} used
          </Badge>
          <div className="flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomOut}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full px-2 text-[11px]" onClick={handleFit}>
              <Search className="mr-1 h-3 w-3" />
              Fit
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomIn}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {partNumbers.length > 0 ? (
            <DeviceProperty
              type="referenceImageCarousel"
              pn={partNumbers}
              preferredDescription={description}
              className="w-full"
              imageClassName="object-contain"
              fallback={
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  No reference images available for this device.
                </div>
              }
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No part numbers available to resolve reference images.
            </div>
          )}

      <div ref={containerRef} className="rounded-4xl border border-slate-200 bg-slate-100 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-6 sm:py-5">
        <TooltipProvider>
          <div className="relative mx-auto overflow-hidden" style={{ height: guideHeight }}>
            <div
              ref={contentRef}
              className="absolute left-1/2 top-0 flex flex-col gap-6"
              style={{
                width: GUIDE_BASE_WIDTH,
                transform: `translateX(-50%) scale(${effectiveScale})`,
                transformOrigin: "top center",
              }}
            >
              <div className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))_72px] items-center gap-x-6">
                <div />
                {MODULE_COLUMNS.map((column) => (
                  <div key={column} className="text-center text-[15px] font-medium text-slate-400">
                    {column}
                  </div>
                ))}
                <div />
              </div>

              {TERMINAL_ROWS.map((row, rowIndex) => {
                const rail = SIDE_RAILS[rowIndex - 1];
                const railEnabled = rail ? (rail.terminal === "SH" ? normalizedDeviceId.startsWith("AF") && hasShTermination : usedTerminals.has(rail.terminal)) : false;

                return (
                  <div key={rowIndex} className="grid grid-cols-[72px_repeat(16,minmax(0,1fr))_72px] items-start gap-x-6 gap-y-4">
                    {rail ? (
                      <RailTerminalCell
                        label={rail.label}
                        terminal={rail.terminal}
                        state={getTerminalVisualState(rail.terminal, usedTerminals, getTerminationsForTerminal(rail.terminal), !railEnabled)}
                        selected={selectedTerminal === rail.terminal}
                        enabled={railEnabled}
                        align="left"
                        terminationsForTerminal={getTerminationsForTerminal(rail.terminal)}
                        onTerminalClick={onTerminalClick}
                      />
                    ) : (
                      <div />
                    )}

                    {row.map((terminal) => {
                      const terminationsForTerminal = getTerminationsForTerminal(terminal);
                      return (
                        <NumericTerminalCell
                          key={terminal}
                          terminal={terminal}
                          state={getTerminalVisualState(terminal, usedTerminals, terminationsForTerminal)}
                          selected={selectedTerminal === terminal}
                          terminationsForTerminal={terminationsForTerminal}
                          onTerminalClick={onTerminalClick}
                        />
                      );
                    })}

                    {rail ? (
                      <RailTerminalCell
                        label={rail.label}
                        terminal={rail.terminal}
                        state={getTerminalVisualState(rail.terminal, usedTerminals, getTerminationsForTerminal(rail.terminal), !railEnabled)}
                        selected={selectedTerminal === rail.terminal}
                        enabled={railEnabled}
                        align="right"
                        terminationsForTerminal={getTerminationsForTerminal(rail.terminal)}
                        onTerminalClick={onTerminalClick}
                      />
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </div>

      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-300 text-slate-50">×</div>
          <span>Unused</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-blue-500"></div>
          <span>Connection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-lime-500"></div>
          <span>Added</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-rose-400"></div>
          <span>Deleted</span>
        </div>
      </div>

      {usedTerminalList.length > 0 ? (
        <div className="space-y-3 rounded-3xl border border-border/50 bg-background/70 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Used Terminals</h3>
            <p className="text-xs text-muted-foreground">Click a terminal to filter the connected wires list.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {usedTerminalList.map((terminal) => (
              <button
                key={terminal}
                type="button"
                onClick={() => onTerminalClick?.(terminal)}
              >
                <Badge variant={selectedTerminal === terminal ? "default" : "secondary"} className="font-mono text-xs">
                  {terminal}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
        <div className="space-y-3 rounded-3xl border border-border/50 bg-background/70 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Connected Wires</h3>
            <p className="text-xs text-muted-foreground">{selectedTerminal ? `Filtered to terminal ${selectedTerminal}.` : "Showing live connections for this module."}</p>
          </div>

          {selectedTerminal ? (
            <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <span>
                Filtering terminal <strong>{selectedTerminal}</strong> with {displayedTerminations.length} connection{displayedTerminations.length === 1 ? "" : "s"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onTerminalClick?.(selectedTerminal)}>
                Clear
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {displayedTerminations.slice(0, 10).map((term) => (
              <div
                key={`${term.rowId}-${term.wireNo}`}
                className="rounded border border-border/50 bg-muted/30 p-3 text-xs"
              >
                <div className="font-mono font-semibold">{term.wireNo || "-"}</div>
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <div>From: {term.fromDeviceId}</div>
                  <div>To: {term.toDeviceId}</div>
                  {term.terminal ? <div>Terminal: {term.terminal}</div> : null}
                  <div>Gauge: {term.gaugeSize || "-"}</div>
                </div>
              </div>
            ))}

            {displayedTerminations.length === 0 ? (
              <div className="rounded border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No connected wires found.
              </div>
            ) : null}

            {displayedTerminations.length > 10 ? (
              <p className="text-xs text-muted-foreground">
                +{displayedTerminations.length - 10} more connections
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-border/50 bg-background/70 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Reference Images</h3>
            <p className="text-xs text-muted-foreground">Module reference images are grouped with the guide for side-by-side inspection.</p>
          </div>
 
        </div>
      </div>
    </div>
  );
}
