"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectContext } from "@/contexts/project-context";
import {
  ProjectAssignmentsTab,
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
import { getDashboardProjectStatus, hasUploadedLegals } from "@/lib/projects/dashboard-status";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "legals", label: "Legals" },
  { id: "files", label: "Files" },
  { id: "parts", label: "Part Numbers" },
  { id: "sws", label: "SWS" },
  { id: "assignments", label: "Assignments" },
  { id: "biq", label: "BIQ" },
  { id: "team", label: "Team" },
  { id: "settings", label: "Settings" },
] satisfies Array<{ id: ProjectTabId; label: string }>;

interface ProjectDetailsWorkspaceContentProps {
  project: ProjectManifest;
  initialTab?: ProjectTabId;
}

export function ProjectDetailsWorkspaceContent({
  project,
  initialTab = "overview",
}: ProjectDetailsWorkspaceContentProps) {
  const [activeTab, setActiveTab] = useState<ProjectTabId>(initialTab);
  const [liveProject, setLiveProject] = useState(project);
  const [brandReviewOpen, setBrandReviewOpen] = useState(false);
  const [actionStateRefreshKey, setActionStateRefreshKey] = useState(0);
  const { saveProject } = useProjectContext();

  const model = liveProject;
  const projectColor = model.color || "#ffcc61";
  const hasLegals = hasUploadedLegals(model);
  const status = getDashboardProjectStatus(model);

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
    setActionStateRefreshKey((previous) => previous + 1);
    return payload.manifest;
  }, [project.id, saveProject]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/80">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <div className="flex items-center gap-3">
            <div
              className="flex shrink-0 items-center justify-center rounded-md p-2 shadow-sm"
              style={{
                backgroundColor: `${projectColor}15`,
                border: `1px solid ${projectColor}30`,
              }}
            >
              <FileSpreadsheet className="h-5 w-5" style={{ color: projectColor }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted-foreground">
                {model.pdNumber ? <span className="font-mono">{model.pdNumber}</span> : null}
                {model.pdNumber && model.unitNumber ? " / " : null}
                {model.unitNumber ? <span>Unit {model.unitNumber}</span> : null}
                {!model.pdNumber && !model.unitNumber ? model.filename : null}
              </p>
              <h2 className="truncate text-lg font-semibold">{model.name}</h2>
            </div>
        
          </div>
        </div>

        <div className="shrink-0 px-4 pb-1">
          <AnimatedTabs
            tabs={TABS}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as ProjectTabId)}
            variant="pill"
            layoutId="project-details-workspace-tabs"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-5 pt-4">
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
            {activeTab === "assignments" ? (
              <ProjectAssignmentsTab
                project={model}
                projectColor={projectColor}
                hasLegals={hasLegals}
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
          </div>
        </ScrollArea>
      </div>

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

function ProjectDetailsStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "secondary" | "outline" | "destructive"; className?: string }
  > = {
    legals_pending: {
      label: "Legals Pending",
      variant: "outline",
      className: "border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-950/30",
    },
    brandlist: {
      label: "BrandList",
      variant: "outline",
      className: "border-orange-300 bg-orange-50 text-orange-600 dark:bg-orange-950/30",
    },
    branding: {
      label: "Branding",
      variant: "outline",
      className: "border-purple-300 bg-purple-50 text-purple-600 dark:bg-purple-950/30",
    },
    kitting: {
      label: "Kitting",
      variant: "outline",
      className: "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30",
    },
    active: {
      label: "Active",
      variant: "outline",
      className: "border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
    },
    blocked: { label: "Blocked", variant: "destructive" },
    completed: {
      label: "Completed",
      variant: "outline",
      className: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30",
    },
    shipped: { label: "Shipped", variant: "secondary" },
  };

  const current = config[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={current.variant} className={cn("h-5 shrink-0 px-1.5 text-[10px]", current.className)}>
      {current.label}
    </Badge>
  );
}
