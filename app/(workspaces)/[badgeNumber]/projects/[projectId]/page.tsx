import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Loader2 } from "lucide-react";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { ProjectDetailsWorkspace } from "@/components/projects/project-details-workspace";
import type { ProjectManifest } from "@/types/project-manifest";

type ProjectDetailsWorkspacePageProps = {
  params: Promise<{
    badgeNumber: string;
    projectId: string;
  }>;
  searchParams: Promise<{
    section?: string;
  }>;
};

export default async function ProjectDetailsWorkspacePage({
  params,
  searchParams,
}: ProjectDetailsWorkspacePageProps) {
  const { badgeNumber, projectId } = await params;
  const { section } = await searchParams;

  // Verify project exists
  const project = await readProjectManifest(projectId);
  if (!project) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProjectDetailsWorkspace
        projectId={projectId}
        badgeNumber={badgeNumber}
        initialSection={section || "details"}
        initialProject={project as ProjectManifest}
      />
    </Suspense>
  );
}
