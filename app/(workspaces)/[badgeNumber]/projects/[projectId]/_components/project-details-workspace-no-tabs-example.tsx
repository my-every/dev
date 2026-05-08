"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers, PanelTop, Rows4, Settings2, UserRound } from "lucide-react";

import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";
import { UsersTeamsAvatarGroup } from "@/app/(workspaces)/[badgeNumber]/users/_components/users-teams-avatar-group";
import { ProjectManifestEditor } from "@/components/manifest/project-manifest-editor";

import { ProjectOverviewSummaryTab, type OverviewActionModalType } from "@/components/projects/tabs/project-overview-summary-tab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectContext } from "@/contexts/project-context";
import {
  ProjectAssignmentsTab,
  ProjectFilesTab,
  ProjectLegalsTab,
  ProjectPartNumbersTab,
  ProjectSettingsTab,
  ProjectSwsTab,
} from "@/components/projects/tabs";
import type { ProjectDetailsSubtabId, ProjectTabId } from "@/components/projects/tabs/project-tab-types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSheetReviewModal } from "@/components/wire-list/multi-sheet-review-modal";
import { LayoutPdfWorkspaceDialog } from "@/components/projects/layout-pdf-workspace-dialog";
import { MultiWireListPrintWorkspaceDialog } from "@/components/projects/multi-wire-list-print-workspace-dialog";
import { SheetDetailModal } from "@/components/projects/sheet-detail-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasUploadedLegals } from "@/lib/projects/dashboard-status";
import type { ProjectManifest } from "@/types/project-manifest";
import type { WorkspaceUserRecord } from "@/app/(workspaces)/[badgeNumber]/users/_components/users-types";

interface ProjectDetailsWorkspaceNoTabsExampleProps {
  project: ProjectManifest;
}

interface TeamResponse {
  members?: Array<{
    badge: string;
    fullName: string;
    preferredName?: string | null;
    role?: string | null;
    shift?: string | null;
    primaryLwc?: string | null;
  }>;
}

const SUBTAB_QUERY_KEY = "section";

const SUBTABS: { id: ProjectDetailsSubtabId; label: string; icon: ReactNode }[] = [
  { id: "summary", label: "Summary", icon: <PanelTop className="h-4 w-4" /> },
  { id: "units", label: "Units", icon: <Layers className="h-4 w-4" /> },
  { id: "assignments", label: "Assignments", icon: <Rows4 className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <UserRound className="h-4 w-4" /> },
  { id: "engineer", label: "Engineer", icon: <Settings2 className="h-4 w-4" /> },
];

const ACTION_MODAL_LABELS: Record<OverviewActionModalType, string> = {
  legals: "Legals",
  files: "Files",
  parts: "Part Numbers",
  sws: "SWS",
  layout: "Layouts",
  "wire-print": "Wire Lists",
  "brand-workspace": "Brand List",
  "sheet-workspace": "Sheet Workspace",
};

function ProjectActionModal({
  open,
  title,
  onOpenChange,
  children,
}: {
  open: boolean;
  title: string;
  onOpenChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-hidden p-0 sm:max-w-280">
        <DialogHeader className="border-b border-border/60 px-5 py-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="h-[78vh] overflow-hidden px-4 py-3">
          <ScrollArea className="h-full pr-2">{children}</ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectUnitsPanel({
  project,
  onOpenAction,
}: {
  project: ProjectManifest;
  onOpenAction: (tabId: ProjectTabId) => void;
}) {
  const operationalAssignments = Object.values(project.assignments ?? {}).filter((assignment) => assignment.kind === "operational");
  const stageCount = new Map<string, number>();

  for (const assignment of operationalAssignments) {
    const key = assignment.stage ?? "PENDING";
    stageCount.set(key, (stageCount.get(key) ?? 0) + 1);
  }

  const stageEntries = Array.from(stageCount.entries()).sort((a, b) => b[1] - a[1]);
  const units = [
    {
      id: `${project.id}-unit-${project.unitNumber ?? "1"}`,
      name: `${project.name}${project.unitNumber ? ` · Unit ${project.unitNumber}` : ""}`,
      pdNumber: project.pdNumber,
      assignmentCount: operationalAssignments.length,
      status: project.status,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Units</p>
          <p className="mt-1 text-2xl font-semibold">{units.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Operational Assignments</p>
          <p className="mt-1 text-2xl font-semibold">{operationalAssignments.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active Stages</p>
          <p className="mt-1 text-2xl font-semibold">{stageEntries.length}</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Units</p>
          <div className="mt-2 space-y-2">
            {units.map((unit) => (
              <div key={unit.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">{unit.pdNumber}</p>
                  </div>
                  <Badge variant="solid" size="sm" className="h-5 px-2 text-[10px]">{unit.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{unit.assignmentCount} assignments</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenAction("assignments")}>
                    Open assignments
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Stage Distribution</p>
          <div className="mt-2 space-y-2">
            {stageEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assignment stages have been captured yet.</p>
            ) : (
              stageEntries.map(([stageId, count]) => (
                <div key={stageId} className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1.5 text-xs">
                  <span>{stageId.replace(/[_-]+/g, " ")}</span>
                  <Badge variant="dot" size="sm" className="h-5 px-2 text-[10px]">{count}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectDetailsWorkspaceNoTabsExample({ project }: ProjectDetailsWorkspaceNoTabsExampleProps) {
  const [liveProject, setLiveProject] = useState(project);
  const [teamUsers, setTeamUsers] = useState<WorkspaceUserRecord[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [brandReviewOpen, setBrandReviewOpen] = useState(false);
  const [layoutWorkspaceOpen, setLayoutWorkspaceOpen] = useState(false);
  const [wirePrintWorkspaceOpen, setWirePrintWorkspaceOpen] = useState(false);
  const [sheetWorkspaceOpen, setSheetWorkspaceOpen] = useState(false);
  const [actionStateRefreshKey, setActionStateRefreshKey] = useState(0);
  const [openActionModal, setOpenActionModal] = useState<OverviewActionModalType | null>(null);
  const [subtab, setSubtab] = useState<ProjectDetailsSubtabId>("summary");
  const { saveProject } = useProjectContext();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const model = liveProject;
  const projectColor = model.color || "#ffcc61";
  const hasLegals = hasUploadedLegals(model);
  const operationalSheets = useMemo(
    () =>
      (model.sheets ?? [])
        .filter((sheet) => sheet.kind === "operational")
        .map((sheet) => ({ slug: sheet.slug, name: sheet.name, rowCount: sheet.rowCount })),
    [model.sheets],
  );
  const canOpenLayoutWorkspace = hasLegals;
  const canOpenWirePrintWorkspace = hasLegals && operationalSheets.length > 0;
  const firstOperationalSheetSlug = operationalSheets[0]?.slug ?? null;
  const activityMode = (searchParams.get("activityMode") ?? "").toLowerCase();
  const activityScenario = searchParams.get("activityScenario") ?? "all";
  const isBrandWorkspaceAction = (searchParams.get("action") ?? "") === "brand-workspace";
  const brandListActivitiesApiUrl = useMemo(() => {
    const encodedProjectId = encodeURIComponent(model.id);
    if (activityMode === "demo") {
      return `/api/projects/${encodedProjectId}/activity/demo?scenario=${encodeURIComponent(activityScenario)}&limit=200`;
    }
    return `/api/projects/${encodedProjectId}/activity?limit=200`;
  }, [activityMode, activityScenario, model.id]);
  const assignmentMeta = useMemo(
    () =>
      Object.values(model.assignments ?? {})
        .map((assignment) => assignment.boardAssignment)
        .filter(Boolean),
    [model.assignments],
  );
  const assignedBadges = useMemo(
    () => Array.from(new Set(assignmentMeta.map((meta) => meta?.assignedBadge).filter((badge): badge is string => Boolean(badge)))),
    [assignmentMeta],
  );
  const users = useMemo(
    () => assignedBadges.map((badge) => teamUsers.find((member) => member.badge === badge) ?? {
      badge,
      fullName: badge,
      role: "",
    }),
    [assignedBadges, teamUsers],
  );

  useEffect(() => {
    setLiveProject(project);
  }, [project]);

  useEffect(() => {
    const param = searchParams.get(SUBTAB_QUERY_KEY);
    if (param === "summary" || param === "units" || param === "assignments" || param === "settings" || param === "engineer") {
      setSubtab(param);
      return;
    }
    setSubtab("summary");
  }, [searchParams]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "sws") {
      setOpenActionModal("sws");
      return;
    }
    if (action === "brand-workspace") {
      setBrandReviewOpen(true);
      return;
    }
    if (action === "layout-workspace") {
      setLayoutWorkspaceOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Skip non-essential team hydration when deep-linking straight into brand workspace.
    if (isBrandWorkspaceAction || brandReviewOpen) {
      return;
    }

    let cancelled = false;

    async function loadTeam() {
      try {
        const [firstShift, secondShift] = await Promise.all([
          fetch(`/api/users/team?shift=1st`, { cache: "no-store" }),
          fetch(`/api/users/team?shift=2nd`, { cache: "no-store" }),
        ]);

        const payloads = await Promise.all([
          firstShift.ok ? (firstShift.json() as Promise<TeamResponse>) : Promise.resolve({ members: [] }),
          secondShift.ok ? (secondShift.json() as Promise<TeamResponse>) : Promise.resolve({ members: [] }),
        ]);

        const uniqueByBadge = new Map<string, WorkspaceUserRecord>();
        for (const member of [...(payloads[0].members ?? []), ...(payloads[1].members ?? [])]) {
          if (!member?.badge) continue;
          uniqueByBadge.set(member.badge, {
            badge: member.badge,
            fullName: member.fullName,
            preferredName: member.preferredName,
            role: member.role ?? "",
            shift: member.shift,
            primaryLwc: member.primaryLwc,
          });
        }

        if (!cancelled) {
          setTeamUsers(Array.from(uniqueByBadge.values()));
        }
      } catch {
        if (!cancelled) {
          setTeamUsers([]);
        }
      }
    }

    void loadTeam();
    return () => {
      cancelled = true;
    };
  }, [brandReviewOpen, isBrandWorkspaceAction]);

  const updateSubtab = useCallback(
    (next: ProjectDetailsSubtabId) => {
      setSubtab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "summary") {
        params.delete(SUBTAB_QUERY_KEY);
      } else {
        params.set(SUBTAB_QUERY_KEY, next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  const handleNavigateToTab = useCallback(
    (tabId: ProjectTabId) => {
      if (tabId === "assignments") {
        updateSubtab("assignments");
        return;
      }
      if (tabId === "overview") {
        updateSubtab("summary");
        return;
      }
      if (tabId === "settings") {
        updateSubtab("settings");
        return;
      }
      if (tabId === "legals" || tabId === "files" || tabId === "parts" || tabId === "sws") {
        setOpenActionModal(tabId);
        return;
      }
    },
    [updateSubtab],
  );

  const handleOpenActionModal = useCallback((modal: OverviewActionModalType) => {
    if (modal === "brand-workspace") {
      setBrandReviewOpen(true);
      return;
    }
    if (modal === "sheet-workspace") {
      if (!firstOperationalSheetSlug) {
        return;
      }
      setSheetWorkspaceOpen(true);
      return;
    }
    if (modal === "layout") {
      setLayoutWorkspaceOpen(true);
      return;
    }
    if (modal === "wire-print") {
      setWirePrintWorkspaceOpen(true);
      return;
    }
    setOpenActionModal(modal);
  }, [firstOperationalSheetSlug]);

  const modalContent = useMemo(() => {
    if (!openActionModal) return null;

    if (openActionModal === "legals") {
      return (
        <ProjectLegalsTab
          project={model}
          projectColor={projectColor}
          onProjectRefresh={refreshProjectState}
          onNavigateToTab={handleNavigateToTab}
        />
      );
    }

    if (openActionModal === "files") {
      return (
        <ProjectFilesTab
          project={model}
          projectColor={projectColor}
          onProjectRefresh={refreshProjectState}
          onNavigateToTab={handleNavigateToTab}
        />
      );
    }

    if (openActionModal === "parts") {
      return (
        <ProjectPartNumbersTab
          project={model}
          projectColor={projectColor}
          onProjectRefresh={refreshProjectState}
          onNavigateToTab={handleNavigateToTab}
        />
      );
    }

    return (
      <ProjectSwsTab
        project={model}
        projectColor={projectColor}
        onProjectRefresh={refreshProjectState}
        onNavigateToTab={handleNavigateToTab}
        initialSheetSlug={searchParams.get("swsSheetSlug") ?? undefined}
        initialMode={(searchParams.get("swsMode") as "PRINT_MANUAL" | "TABLET_INTERACTIVE" | null) ?? undefined}
      />
    );
  }, [handleNavigateToTab, model, openActionModal, projectColor, refreshProjectState, searchParams]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/80">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <div className="flex items-center gap-3">
            <ProjectIcon name={model.name} color={projectColor} interactive={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted-foreground">
                {model.pdNumber ? <span className="font-mono">{model.pdNumber}</span> : null}
                {model.pdNumber && model.unitNumber ? " / " : null}
                {model.unitNumber ? <span>Unit {model.unitNumber}</span> : null}
                {!model.pdNumber && !model.unitNumber ? model.filename : null}
              </p>
              <h2 className="truncate text-lg font-semibold">{model.name}</h2>
            </div>
            {!brandReviewOpen && !isBrandWorkspaceAction ? (
              <div className="hidden md:flex">
                <UsersTeamsAvatarGroup
                  users={users}
                  max={6}
                  size={32}
                  selectedUserBadge={selectedBadge}
                  onSelectUser={(user) => setSelectedBadge(user.badge)}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 px-5 pb-3 pt-3">
          <Tabs value={subtab} onValueChange={(value) => updateSubtab(value as ProjectDetailsSubtabId)}>
            <TabsList className="h-10 w-fit rounded-xl bg-muted/35 p-1">
              {SUBTABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  id={`project-${project.id}-details-tab-trigger-${tab.id}`}
                  aria-controls={`project-${project.id}-details-tab-content-${tab.id}`}
                  value={tab.id}
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  <span className="mr-1.5">{tab.icon}</span>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {subtab !== "engineer" ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-5 pb-5 pt-2">
              {subtab === "summary" && !brandReviewOpen && !isBrandWorkspaceAction ? (
                <ProjectOverviewSummaryTab
                  project={model}
                  projectColor={projectColor}
                  onProjectRefresh={refreshProjectState}
                  onNavigateToTab={handleNavigateToTab}
                  onOpenBrandReview={() => setBrandReviewOpen(true)}
                  actionStateRefreshKey={actionStateRefreshKey}
                  badgeNumber={undefined}
                  onOpenActionModal={handleOpenActionModal}
                  availableActions={{
                    layout: canOpenLayoutWorkspace,
                    "wire-print": canOpenWirePrintWorkspace,
                    "sheet-workspace": operationalSheets.length > 0,
                  }}
                  onExportProjectPdf={() => {
                    if (!canOpenLayoutWorkspace) return;
                    window.open(`/api/projects/${encodeURIComponent(model.id)}/layout-pdf?raw=1`, "_blank", "noopener,noreferrer");
                  }}
                />
              ) : null}

              {subtab === "units" ? <ProjectUnitsPanel project={model} onOpenAction={handleNavigateToTab} /> : null}

              {subtab === "assignments" ? (
                <ProjectAssignmentsTab
                  project={model}
                  projectColor={projectColor}
                  hasLegals={hasLegals}
                  onProjectRefresh={refreshProjectState}
                  onNavigateToTab={handleNavigateToTab}
                />
              ) : null}

              {subtab === "settings" ? (
                <ProjectSettingsTab
                  project={model}
                  projectColor={projectColor}
                  onProjectRefresh={refreshProjectState}
                  onNavigateToTab={handleNavigateToTab}
                />
              ) : null}
            </div>
          </ScrollArea>
        ) : null}

        {subtab === "engineer" ? (
          <div className="flex-1 min-h-0 overflow-hidden border-t border-border/50">
            <ProjectManifestEditor
              project={model}
              onProjectRefresh={refreshProjectState}
            />
          </div>
        ) : null}
      </div>

      <ProjectActionModal
        open={openActionModal !== null}
        title={openActionModal ? ACTION_MODAL_LABELS[openActionModal] : "Action"}
        onOpenChange={(next) => {
          if (!next) {
            setOpenActionModal(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("action");
            params.delete("swsSheetSlug");
            params.delete("swsMode");
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            void refreshProjectState();
          }
        }}
      >
        {modalContent}
      </ProjectActionModal>

      <MultiSheetReviewModal
        projectId={model.id}
        activitiesApiUrl={brandListActivitiesApiUrl}
        open={brandReviewOpen}
        onOpenChange={(next) => {
          setBrandReviewOpen(next);
          if (next) {
            return;
          }

          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        }}
        showTrigger={false}
        title="Branding List"
        combineLabel="Combined Brand List"
      />

      <LayoutPdfWorkspaceDialog
        open={layoutWorkspaceOpen}
        onOpenChange={(nextOpen) => {
          setLayoutWorkspaceOpen(nextOpen);
          if (nextOpen) {
            return;
          }
          const params = new URLSearchParams(searchParams.toString());
          params.delete("action");
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        }}
        endpoint={`/api/projects/${encodeURIComponent(model.id)}/layout-pdf`}
        quickBackLabel="Back to Projects"
        onQuickBack={() => {
          setLayoutWorkspaceOpen(false);
          const workspaceBadge = pathname.split("/").filter(Boolean)[0] ?? "";
          router.push(`/${workspaceBadge}/projects`);
        }}
      />

      <MultiWireListPrintWorkspaceDialog
        open={wirePrintWorkspaceOpen}
        onOpenChange={setWirePrintWorkspaceOpen}
        projectId={model.id}
        projectName={model.name}
        projectColor={projectColor}
        sheets={operationalSheets}
      />

      {firstOperationalSheetSlug ? (
        <SheetDetailModal
          open={sheetWorkspaceOpen}
          onOpenChange={setSheetWorkspaceOpen}
          projectId={model.id}
          sheetName={firstOperationalSheetSlug}
        />
      ) : null}
    </>
  );
}
