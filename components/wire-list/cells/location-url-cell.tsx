"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";
import { useProjectContext } from "@/contexts/project-context";
import { getSheetRoutePath } from "@/hooks/use-sheet-route";

interface LocationUrlCellProps {
  location?: string | null;
  projectId?: string;
  currentSheetSlug?: string;
  className?: string;
}

export function LocationUrlCell({
  location,
  projectId,
  currentSheetSlug,
  className = "",
}: LocationUrlCellProps) {
  const { currentProject, currentProjectId } = useProjectContext();
  const displayLocation = (location || "").trim();

  if (!displayLocation) {
    return <span className="text-muted-foreground">-</span>;
  }

  // In manifest architecture, we can't look up which sheet contains a location
  // without loading all sheet schemas. For now, just render the location as text.
  // TODO: Add location → sheet mapping to manifest for cross-sheet linking.
  const project = currentProjectId === projectId ? currentProject : null;

  if (!projectId || !project) {
    return <span className={className}>{displayLocation}</span>;
  }

  return <span className={className}>{displayLocation}</span>;
}
