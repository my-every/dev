"use client";

import type { ProjectManifest } from "@/types/project-manifest";

export type ProjectTabId =
  | "overview"
  | "legals"
  | "files"
  | "parts"
  | "sws"
  | "assignments"
  | "biq"
  | "team"
  | "settings";

export type ProjectDetailsSubtabId = "summary" | "units" | "assignments" | "settings";

export interface ProjectTabProps {
  project: ProjectManifest;
  projectColor: string;
  onProjectRefresh?: () => Promise<ProjectManifest | null>;
  onNavigateToTab?: (tabId: ProjectTabId) => void;
  onOpenBrandReview?: () => void;
  actionStateRefreshKey?: number;
}

export interface ProjectLegalsTabProps extends ProjectTabProps {
  onProjectRefresh: () => Promise<ProjectManifest | null>;
}

export interface ProjectAssignmentsTabProps extends ProjectTabProps {
  hasLegals: boolean;
}
