"use client";

import { useCallback, useEffect, useState } from "react";

import { useProjectContext } from "@/contexts/project-context";
import type { ProjectManifest } from "@/types/project-manifest";
import { getDashboardProjectStatus } from "@/lib/projects/dashboard-status";
import { ProjectDetailsShell } from "@/components/projects/project-details-shell";
import {
  ProjectBiqTab,
  ProjectFilesTab,
  ProjectLegalsTab,
  ProjectOverviewTab,
  ProjectPartNumbersTab,
  ProjectSettingsTab,
  ProjectSwsTab,
  ProjectTeamTab,
} from "@/components/projects/tabs";
import type { ProjectTabId } from "@/components/projects/tabs/project-tab-types";
import { MultiSheetReviewModal } from "@/components/wire-list/multi-sheet-review-modal";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "legals", label: "Legals" },
  { id: "files", label: "Files" },
  { id: "parts", label: "Part Numbers" },
  { id: "sws", label: "SWS" },
  { id: "biq", label: "BIQ" },
  { id: "team", label: "Team" },
  { id: "settings", label: "Settings" },
] satisfies Array<{ id: ProjectTabId; label: string }>;

interface ProjectDetailsTabsContentProps {
  project: ProjectManifest;
  mode?: "aside" | "modal" | "page";
  initialTab?: ProjectTabId;
  onProjectUpdated?: (project: ProjectManifest) => void;
}

export function ProjectDetailsTabsContent({
  project,
  mode = "aside",
  initialTab = "overview",
  onProjectUpdated,
}: ProjectDetailsTabsContentProps) {
  const [activeTab, setActiveTab] = useState<ProjectTabId>(initialTab);
  const [liveProject, setLiveProject] = useState(project);
  const [brandReviewOpen, setBrandReviewOpen] = useState(false);
  const [actionStateRefreshKey, setActionStateRefreshKey] = useState(0);
  const { saveProject } = useProjectContext();

  const model = liveProject;
  const projectColor = model.color || "#ffcc61";
  const derivedStatus = getDashboardProjectStatus(model);

  useEffect(() => {
    setLiveProject(project);
  }, [project]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const refreshProjectState = useCallback(async () => {
    const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { manifest?: ProjectManifest };
    if (!payload.manifest) {
      return null;
    }

    setLiveProject(payload.manifest);
    saveProject(payload.manifest);
    onProjectUpdated?.(payload.manifest);
    setActionStateRefreshKey((prev) => prev + 1);
    return payload.manifest;
  }, [onProjectUpdated, project.id, saveProject]);

  return (
    <>
      <ProjectDetailsShell
        project={model}
        projectColor={projectColor}
        status={derivedStatus}
        activeTab={activeTab}
        tabs={TABS}
        onTabChange={setActiveTab}
        mode={mode}
      >
        {activeTab === "overview" ? (
          <ProjectOverviewTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
            onOpenBrandReview={() => setBrandReviewOpen(true)}
            actionStateRefreshKey={actionStateRefreshKey}
          />
        ) : null}
        {activeTab === "legals" ? (
          <ProjectLegalsTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "files" ? (
          <ProjectFilesTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "parts" ? (
          <ProjectPartNumbersTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "sws" ? (
          <ProjectSwsTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "biq" ? (
          <ProjectBiqTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "team" ? (
          <ProjectTeamTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
        {activeTab === "settings" ? (
          <ProjectSettingsTab
            project={model}
            projectColor={projectColor}
            onProjectRefresh={refreshProjectState}
            onNavigateToTab={setActiveTab}
          />
        ) : null}
      </ProjectDetailsShell>

      <MultiSheetReviewModal
        projectId={model.id}
        open={brandReviewOpen}
        onOpenChange={setBrandReviewOpen}
        showTrigger={false}
        title="Combine Excel Branding List"
        combineLabel="Combine Excel Branding List"
      />

    </>
  );
}
