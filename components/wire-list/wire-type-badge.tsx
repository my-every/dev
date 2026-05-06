"use client";

/**
 * Wire type display component.
 * Shows wire type codes (JC, SC, W) matching the reference format.
 */

import { formatWireType } from "@/lib/workbook/wire-list-normalizer";

interface WireTypeBadgeProps {
  value: string | number | boolean | Date | null;
}

export function WireTypeBadge({ value }: WireTypeBadgeProps) {
  const typeInfo = formatWireType(value);

  if (typeInfo.code === "-") {
    return <span className="text-muted-foreground">-</span>;
  }

  // Display just the code (JC, SC, W) to match the reference format
  return <span className="font-medium">{typeInfo.code}</span>;
}
