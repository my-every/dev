"use client";

import type { ProjectManifest } from "@/types/project-manifest";
import { ProjectDetailsTabsContent } from "@/components/projects/project-details-tabs-content";

export interface DashboardProjectAsideProps {
  project: ProjectManifest;
}

export function DashboardProjectAside({ project }: DashboardProjectAsideProps) {
  return <ProjectDetailsTabsContent project={project} mode="aside" />;
}
