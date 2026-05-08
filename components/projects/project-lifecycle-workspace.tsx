"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  Box,
  Cable,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Eye,
  GitMerge,
  Hammer,
  Lock,
  Loader2,
  Package,
  Power,
  PlayCircle,
  ShieldAlert,
  Zap,
  ClipboardPenLine,
  Upload,
  Tags,
} from "lucide-react";

import { useProjectContext } from "@/contexts/project-context";
import { useAssignmentDependencyGraph } from "@/hooks/use-assignment-dependency-graph";
import { PROJECT_LIFECYCLE_GATES, type ProjectLifecycleGateStatus } from "@/types/d380-assignment-stages";
import { buildProjectLifecycleTabs, type ProjectLifecycleCardState, type ProjectLifecycleTabId } from "@/lib/view-models/project-lifecycle-tabs";
import { CompactLifecycleBar } from "@/components/projects/project-lifecycle-snapshot";
import { ProjectUploadFlow } from "@/components/projects/project-upload-flow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type LifecycleWorkspacePresentation = "page" | "modal";

interface ProjectLifecycleWorkspaceProps {
  projectId: string;
  presentation?: LifecycleWorkspacePresentation;
  onRequestClose?: () => void;
}

const GATE_STATUS_CLASSES: Record<ProjectLifecycleGateStatus, string> = {
  LOCKED: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  READY: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const CARD_STATE_CLASSES: Record<ProjectLifecycleCardState, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/5",
  current: "border-blue-500/30 bg-blue-500/5",
  blocked: "border-amber-500/30 bg-amber-500/5",
  completed: "border-muted-foreground/20 bg-muted/30",
  locked: "border-border/70 bg-card",
  not_applicable: "border-dashed border-muted-foreground/20 bg-muted/20",
};

const KANBAN_COLUMN_ORDER: ProjectLifecycleCardState[] = [
  "current",
  "ready",
  "blocked",
  "completed",
  "locked",
];

const KANBAN_COLUMN_LABELS: Record<ProjectLifecycleCardState, string> = {
  current: "Current",
  ready: "Ready",
  blocked: "Blocked",
  completed: "Completed",
  locked: "Locked",
  not_applicable: "Not Applicable",
};

const TAB_ICON_MAP: Record<ProjectLifecycleTabId, typeof Package> = {
  LEGALS_READY: ClipboardPenLine,
  PROJECT_UPLOAD: Upload,
  BRANDLIST_COMPLETE: Tags,
  BRANDING_READY: Award,
  READY_TO_LAY: Package,
  BUILD_UP: Hammer,
  READY_TO_WIRE: Eye,
  WIRING: Cable,
  WIRING_IPV: Eye,
  READY_TO_HANG: ClipboardCheck,
  BOX_BUILD: Box,
  READY_TO_CROSS_WIRE: Eye,
  CROSS_WIRE: GitMerge,
  CROSS_WIRE_IPV: Eye,
  READY_TO_TEST: ClipboardCheck,
  TEST_1ST_PASS: Zap,
  POWER_CHECK: Power,
  BIQ: Award,
};

function LifecycleCardStateBadge({ state }: { state: ProjectLifecycleCardState }) {
  if (state === "ready") {
    return <Badge className="gap-1 rounded-full bg-emerald-500 hover:bg-emerald-500"><PlayCircle className="h-3 w-3" />Ready</Badge>;
  }
  if (state === "current") {
    return <Badge className="gap-1 rounded-full bg-blue-500 hover:bg-blue-500"><Clock3 className="h-3 w-3" />Current</Badge>;
  }
  if (state === "blocked") {
    return <Badge variant="destructive" className="gap-1 rounded-full"><ShieldAlert className="h-3 w-3" />Blocked</Badge>;
  }
  if (state === "completed") {
    return <Badge variant="secondary" className="gap-1 rounded-full"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
  }
  if (state === "not_applicable") {
    return <Badge variant="outline" className="rounded-full">Not Applicable</Badge>;
  }
  return <Badge variant="outline" className="gap-1 rounded-full"><Lock className="h-3 w-3" />Locked</Badge>;
}

export function ProjectLifecycleWorkspace({
  projectId,
  presentation = "page",
  onRequestClose,
}: ProjectLifecycleWorkspaceProps) {
  const { currentProject, assignmentMappings, loadProject } = useProjectContext();
  const [activeTab, setActiveTab] = useState<ProjectLifecycleTabId | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const tabRefs = useRef<Partial<Record<ProjectLifecycleTabId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (currentProject?.id !== projectId) {
      loadProject(projectId);
    }
  }, [currentProject?.id, loadProject, projectId]);

  const graphState = useAssignmentDependencyGraph(
    currentProject?.id === projectId ? projectId : null,
    currentProject?.id === projectId ? assignmentMappings : [],
  );

  const lifecycleModel = useMemo(() => {
    if (!currentProject || currentProject.id !== projectId) {
      return null;
    }

    return buildProjectLifecycleTabs({
      project: currentProject,
      assignments: assignmentMappings,
      graph: graphState.graph,
    });
  }, [assignmentMappings, currentProject, graphState.graph, projectId]);

  useEffect(() => {
    if (!lifecycleModel) {
      return;
    }

    setActiveTab((current) => {
      if (current && lifecycleModel.tabs.some((tab) => tab.id === current)) {
        return current;
      }

      return lifecycleModel.recommendedTabId;
    });
  }, [lifecycleModel]);

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    const activeNode = tabRefs.current[activeTab];
    activeNode?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeTab]);

  if (!currentProject || currentProject.id !== projectId || !lifecycleModel) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading project lifecycle…</p>
        </div>
      </div>
    );
  }

  const selectedTab = lifecycleModel.tabs.find((tab) => tab.id === activeTab) ?? lifecycleModel.tabs[0];
  const content = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
       <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PROJECT_LIFECYCLE_GATES.map((gate) => {
            const gateState = currentProject.lifecycleGates?.find((entry) => entry.gateId === gate.id);
            const status = gateState?.status ?? "LOCKED";
            return (
              <div
                key={gate.id}
                className={cn("rounded-2xl border px-4 py-3", GATE_STATUS_CLASSES[status])}
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.24em]">
                  {gate.shortLabel}
                </div>
                <div className="mt-1 text-sm font-semibold">{gate.label}</div>
                <div className="mt-1 text-xs opacity-80">{gate.description}</div>
              </div>
            );
          })}
        </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full font-mono">
                {currentProject.pdNumber || "No PD#"}
              </Badge>
              {currentProject.revision ? (
                <Badge variant="secondary" className="rounded-full">
                  Rev {currentProject.revision}
                </Badge>
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{currentProject.name}</h1>
              <p className="text-sm text-muted-foreground">
                Lifecycle orchestration for every assignment in this project, with dependency-based unlocks across stages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {presentation === "modal" && onRequestClose ? (
              <Button variant="outline" onClick={onRequestClose}>
                Close
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/projects/${encodeURIComponent(projectId)}`}>
                Open Project
              </Link>
            </Button>
          </div>
        </div>

        {graphState.snapshot ? (
          <CompactLifecycleBar
            snapshot={graphState.snapshot}
            crossWireReadiness={graphState.crossWireReadiness ?? undefined}
          />
        ) : null}

       
      </div>

      <Tabs value={selectedTab.id} onValueChange={(value) => setActiveTab(value as ProjectLifecycleTabId)} className="min-h-0 flex-1">
        <TabsList
          className="min-h-40 w-full justify-start items-stretch gap-3 overflow-x-auto overflow-y-hidden rounded-2xl bg-accent/50 px-2 py-3 snap-x snap-mandatory flex-nowrap whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {lifecycleModel.tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              className={cn(
                "snap-center min-h-31 min-w-31 shrink-0 flex-col items-center gap-2 rounded-none border border-transparent px-4 py-4 text-center shadow-none",
                "data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm",
                !tab.isUnlocked && "opacity-70",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  tab.isUnlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {(() => {
                  const Icon = TAB_ICON_MAP[tab.id];
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="font-medium">{tab.label}</span>
                  {!tab.isUnlocked ? <Lock className="h-3.5 w-3.5" /> : null}
                </div>
                {tab.chipLabel ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {tab.chipLabel}
                  </Badge>
                ) : null}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {lifecycleModel.tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4 space-y-4">
            {(() => {
              const tabColumns = KANBAN_COLUMN_ORDER.map((state) => ({
                state,
                label: KANBAN_COLUMN_LABELS[state],
                cards: tab.cards.filter((card) => card.applicable && card.state === state),
              })).filter((column) => column.cards.length > 0);

              return (
                <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{tab.label}</h2>
                <p className="text-sm text-muted-foreground">{tab.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{tab.assignmentCount} assignments</span>
                <span>{tab.completedCount} completed</span>
                {tab.blockedCount > 0 ? <span>{tab.blockedCount} blocked</span> : null}
              </div>
            </div>

            {!tab.isUnlocked && tab.lockedReason ? (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>{tab.label} is still locked</AlertTitle>
                <AlertDescription>{tab.lockedReason}</AlertDescription>
              </Alert>
            ) : null}

            {tab.id === "PROJECT_UPLOAD"
              && tab.isUnlocked
              && !(currentProject.activeWorkbookRevisionId && currentProject.activeLayoutRevisionId) && (
              <Card className="rounded-2xl border-primary/20 bg-primary/5">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Project Upload is ready</div>
                    <p className="text-sm text-muted-foreground">
                      Legals are ready. Upload the workbook and layout files to unlock downstream brand and floor stages.
                    </p>
                  </div>
                  <Button className="gap-2 self-start md:self-auto" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Upload Project
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-4">
              {tabColumns.map((column) => (
                <div key={column.state} className="min-w-0 space-y-3 max-w-40">
                  <div className="flex items-center justify-between rounded-2xl border bg-muted/30 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">{column.label}</div>
                      <div className="text-xs text-muted-foreground">{column.cards.length} assignments</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {column.cards.map((card) => (
                      <Card key={`${tab.id}-${column.state}-${card.assignmentSlug}`} className={cn("overflow-hidden rounded-2xl", CARD_STATE_CLASSES[card.state])}>
                        <CardHeader className="space-y-3 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-lg">{card.sheetName}</CardTitle>
                              <CardDescription className="mt-1">
                                {card.rowCount.toLocaleString()} rows · {card.swsType}
                              </CardDescription>
                            </div>
                            <LifecycleCardStateBadge state={card.state} />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Current Stage</span>
                              <span className="font-medium text-foreground">{card.currentStageLabel}</span>
                            </div>
                            <Progress value={card.progressPercent} className="h-2" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">{card.summary}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full">
                              {card.selectedStatus.replaceAll("_", " ")}
                            </Badge>
                            {!card.applicable ? (
                              <Badge variant="outline" className="rounded-full">
                                Skipped in this flow
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              {card.blockedReasons[0] ?? "Dependency-aware lifecycle card"}
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={card.href}>
                                Open
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
                </>
              );
            })()}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={uploadOpen}
        onOpenChange={(nextOpen) => {
          setUploadOpen(nextOpen);
          if (!nextOpen) {
            loadProject(projectId);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] min-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Project Files</DialogTitle>
            <DialogDescription>
              Upload the workbook and layout files for {currentProject.name}.
            </DialogDescription>
          </DialogHeader>

          <ProjectUploadFlow
            mode="revision"
            projectId={currentProject.id}
            initialProjectName={currentProject.name}
            initialPdNumber={currentProject.pdNumber}
            initialUnitNumber={currentProject.unitNumber}
            initialRevision={currentProject.revision}
            onCancel={() => setUploadOpen(false)}
            onClose={() => {
              setUploadOpen(false);
              loadProject(projectId);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );

  if (presentation === "modal") {
    return <div className="flex h-full min-h-0 flex-col bg-background">{content}</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {content}
      </div>
    </main>
  );
}
