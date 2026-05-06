import { notFound } from "next/navigation";

import { PageContent } from "@/components/layout/page-content";
import { ProjectDetailsWorkspaceNoTabsExample } from "@/app/(workspaces)/[badgeNumber]/projects/[projectId]/_components/project-details-workspace-no-tabs-example";
import { ProjectDetailsSidePanel } from "@/app/(workspaces)/[badgeNumber]/projects/[projectId]/_components/project-details-side-panel";
import { ProjectActivityTab } from "@/components/projects/tabs/project-activity-tab";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { getDashboardProjectStatus } from "@/lib/projects/dashboard-status";

type ProjectDetailsWorkspacePageProps = {
    params: Promise<{
        badgeNumber: string;
        projectId: string;
    }>;
};

export default async function ProjectDetailsWorkspacePage({ params }: ProjectDetailsWorkspacePageProps) {
    const { badgeNumber, projectId } = await params;
    const project = await readProjectManifest(projectId);

    if (!project) {
        notFound();
    }

    const status = getDashboardProjectStatus(project);
    return (
        <PageContent
            title="Project Details"
            subtitle={project.name}
            variant="wide"
            showPanel={true}
            showAside={true}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
       
            commandSearchGroups={[
                {
                    heading: "Projects",
                    items: [
                        {
                            id: "projects-root",
                            label: "Projects Workspace",
                            href: `/${badgeNumber}/projects`,
                            keywords: ["projects", "workspace"],
                        },
                        {
                            id: `project-${project.id}`,
                            label: project.name,
                            href: `/${badgeNumber}/projects/${encodeURIComponent(project.id)}`,
                            keywords: [project.id, project.name, project.pdNumber, project.unitNumber ?? ""].filter(Boolean),
                        },
                    ],
                },
            ]}
            commandSearchPlaceholder="Search project details"
            sidePanel={
                <ProjectDetailsSidePanel
                    project={project}
                    badgeNumber={badgeNumber}
                    statusLabel={status.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())}
                />
            }
          
        >
            
               <ProjectDetailsWorkspaceNoTabsExample project={project} />
        </PageContent>
    );
}
