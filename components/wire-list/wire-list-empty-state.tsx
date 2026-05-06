"use client";

/**
 * Empty state component for wire list when no data is available.
 */

import { FileSpreadsheet } from "lucide-react";

interface WireListEmptyStateProps {
  title?: string;
  message?: string;
}

export function WireListEmptyState({
  title = "No Data Available",
  message = "This sheet does not contain any data rows to display.",
}: WireListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 p-12 text-center">
      <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
