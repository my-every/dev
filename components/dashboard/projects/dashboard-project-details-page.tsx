"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useProjectContext } from "@/contexts/project-context";
import { useDashboardAside } from "@/app/profile/[badgeNumber]/(dashboard)/dashboard-aside-context";
import { Button } from "@/components/ui/button";
import { ProjectDetailsTabsContent } from "@/components/projects/project-details-tabs-content";

export function DashboardProjectDetailsPage({
  badgeNumber,
  projectId,
  fromTab,
}: {
  badgeNumber: string;
  projectId: string;
  fromTab?: string | null;
}) {
  const { currentProject, currentProjectId, loadProject, isLoading } = useProjectContext();
  const { setSelectedProject } = useDashboardAside();

  useEffect(() => {
    setSelectedProject(null);
  }, [setSelectedProject]);

  useEffect(() => {
    if (projectId && currentProjectId !== projectId) {
      loadProject(projectId);
    }
  }, [currentProjectId, loadProject, projectId]);

  const backHref = `/profile/${badgeNumber}/projects${fromTab ? `?tab=${encodeURIComponent(fromTab)}` : ""}`;

  if (isLoading || currentProjectId !== projectId || !currentProject) {
    return (
      <main className="min-h-full bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:px-5">
          <Button asChild variant="ghost" size="sm" className="w-fit gap-2">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
          <div className="flex min-h-[50vh] items-center justify-center gap-2 rounded-3xl border border-border/60 bg-card/60 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading dashboard project details...
          </div>
        </div>
      </main>
    );
  }

  return (
    <ProjectDetailsTabsContent project={currentProject} mode="page" />
  );
}
