/**
 * Clickable Device ID Cell - Wraps device ID values in the wire list table.
 * Opens the device details aside when clicked.
 */

"use client";

import { Button } from "@/components/ui/button";
import { formatDeviceIdForDisplay } from "@/lib/wiring-domain";
import { ExternalLink } from "lucide-react";

interface ClickableDeviceIdCellProps {
  deviceId: string;
  onClick?: (deviceId: string) => void;
  isFrom?: boolean;
}

/**
 * Renders a device ID as a clickable button that opens the device details panel.
 */
export function ClickableDeviceIdCell({
  deviceId,
  onClick,
  isFrom = false,
}: ClickableDeviceIdCellProps) {
  const displayDeviceId = formatDeviceIdForDisplay(deviceId);

  if (!displayDeviceId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(deviceId);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="group h-auto gap-1 px-2 py-1 font-mono text-sm hover:bg-accent"
      title={`Click to view details for ${displayDeviceId}`}
    >
      <span className="font-semibold text-foreground">{displayDeviceId}</span>
      <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Button>
  );
}
