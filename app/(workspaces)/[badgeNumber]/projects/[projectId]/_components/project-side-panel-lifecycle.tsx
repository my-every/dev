"use client";

import { useEffect, useState } from "react";

import {
  ProjectLifecycleStepper,
  type ProjectActionStateSummary,
} from "@/components/projects/project-lifecycle-stepper";
import type { ProjectManifest } from "@/types/project-manifest";

interface ProjectSidePanelLifecycleProps {
  project: ProjectManifest;
}

export function ProjectSidePanelLifecycle({ project }: ProjectSidePanelLifecycleProps) {
  const [summary, setSummary] = useState<ProjectActionStateSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${encodeURIComponent(project.id)}/action-state`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { summary?: ProjectActionStateSummary } | null) => {
        if (!cancelled) {
          setSummary(payload?.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Lifecycle
      </div>
      <ProjectLifecycleStepper
        project={project}
        summary={summary}
        orientation="vertical"
        className="rounded-lg bg-muted/30 px-2 py-2"
      />
    </div>
  );
}
