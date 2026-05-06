"use client";

import type { ReactNode } from "react";
import { SheetMetadataPanel } from "./sheet-metadata-panel";
import type { SheetMetadataInfo, WireListParserDiagnostics } from "@/lib/workbook/types";

interface SemanticWireListShellProps {
  metadata?: SheetMetadataInfo;
  diagnostics?: WireListParserDiagnostics;
  locations: Array<{ location: string; count: number }>;
  selectedLocation: string;
  allLocationsLabel: string;
  totalDisplayRows: number;
  onLocationChange: (location: string) => void;
  toolbar: ReactNode;
  relayPluginRuns?: ReactNode;
  table: ReactNode;
  footer: ReactNode;
  fullScreenSearch: ReactNode;
  /** Floating toolbar at bottom */
  floatingToolbar?: ReactNode;
  /** Hide the toolbar (for print mode) */
  hideToolbar?: boolean;
  /** Hide the footer (for print mode) */
  hideFooter?: boolean;
  /** Hide location tabs (for print mode) */
  hideLocationTabs?: boolean;
  /** Hide the metadata summary card */
  hideMetadataPanel?: boolean;
  /** Use tighter vertical spacing for embedded layouts */
  compactSpacing?: boolean;
}

export function SemanticWireListShell({
  metadata,
  diagnostics,
  locations,
  selectedLocation,
  allLocationsLabel,
  totalDisplayRows,
  onLocationChange,
  toolbar,
  relayPluginRuns,
  table,
  footer,
  fullScreenSearch,
  floatingToolbar,
  hideToolbar = false,
  hideFooter = false,
  hideLocationTabs = false,
  hideMetadataPanel = false,
  compactSpacing = false,
}: SemanticWireListShellProps) {
  return (
    <div className={compactSpacing ? "flex h-full min-h-0 flex-col gap-0" : "flex h-full min-h-0 flex-col gap-4"}>
      {!hideMetadataPanel && metadata && Object.keys(metadata).filter((key) => !key.startsWith("_")).length > 0 && (
        <SheetMetadataPanel metadata={metadata} />
      )}

      {!hideLocationTabs && locations.length > 0 && (
        <div className={compactSpacing ? "flex flex-wrap items-center gap-2 border-b px-4 py-3" : "flex flex-wrap items-center gap-2"}>
          <button
            onClick={() => onLocationChange(allLocationsLabel)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              selectedLocation === allLocationsLabel
                ? "bg-amber-400 text-amber-950"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            ].join(" ")}
          >
            All
            <span
              className={[
                "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold min-w-6",
                selectedLocation === allLocationsLabel
                  ? "bg-amber-500/30 text-amber-950"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {totalDisplayRows}
            </span>
          </button>
          {locations.map(({ location, count }) => (
            <button
              key={location}
              onClick={() => onLocationChange(location)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                selectedLocation === location
                  ? "bg-amber-400 text-amber-950"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              {location}
              <span className="text-xs opacity-70">({count})</span>
            </button>
          ))}
        </div>
      )}

      {!hideToolbar && toolbar}
      {relayPluginRuns}
      <div className={compactSpacing ? "min-h-0 flex-1" : "min-h-0 flex-1"}>
        {table}
      </div>
      {!hideFooter && <div className={compactSpacing ? "shrink-0 border-t px-4 py-3" : "shrink-0"}>{footer}</div>}

      {diagnostics && process.env.NODE_ENV === "development" && (
        <details className="text-xs text-muted-foreground border rounded p-2 mt-4">
          <summary className="cursor-pointer font-medium">Parser Diagnostics</summary>
          <pre className="mt-2 overflow-auto">{JSON.stringify(diagnostics, null, 2)}</pre>
        </details>
      )}

      {fullScreenSearch}
      
      {/* Floating toolbar at bottom */}
      {floatingToolbar}
    </div>
  );
}
