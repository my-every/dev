"use client";

/**
 * Sheet metadata panel component.
 * Displays extracted project metadata from sheet preamble rows.
 */

import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SheetMetadataInfo } from "@/lib/workbook/types";

interface SheetMetadataPanelProps {
  metadata: SheetMetadataInfo;
}

/**
 * Metadata field labels for display.
 */
const METADATA_LABELS: Record<string, string> = {
  projectNumber: "Project #",
  projectName: "Project Name",
  revision: "Revision",
  controlsDE: "Controls DE",
  phone: "Phone",
  from: "From",
};

export function SheetMetadataPanel({ metadata }: SheetMetadataPanelProps) {
  // Get entries with values
  const entries = Object.entries(metadata).filter(
    ([_, value]) => value !== undefined && value !== ""
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          
          <div className="flex-1">
            <h3 className="text-sm font-medium text-secondary-foreground mb-2">
              Project Information
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground whitespace-nowrap">
                    {METADATA_LABELS[key] || key}:
                  </dt>
                  <dd className="text-sm font-medium text-foreground truncate">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
