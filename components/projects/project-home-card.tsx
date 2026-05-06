"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileOutput,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  Layers,
  MoreVertical,
  Printer,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import FileCard from "@/components/projects/file-card";
import { LwcTypeField } from "@/components/projects/fields/lwc-type-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MultiSheetReviewModal } from "@/components/wire-list/multi-sheet-review-modal";
import { cn } from "@/lib/utils";
import type { ProjectManifest } from "@/types/project-manifest";

export type ProjectActionKey = "wireList" | "print" | "details" | "exports" | "lifecycle";

type ActionState = {
  enabled: boolean;
  reason?: string | null;
};

type ProjectActionStateResponse = {
  actions: Partial<Record<ProjectActionKey, ActionState>>;
  summary?: {
    brandListReady?: boolean;
    brandingCombinedRelativePath?: string | null;
  };
};

interface ProjectHomeCardProps {
  project: ProjectManifest;
  isActive?: boolean;
  onDelete: () => void;
  onAction: (action: ProjectActionKey, project: ProjectManifest) => void;
}

function deriveProjectStatus(project: ProjectManifest) {
  const aggregates = project.aggregates;

  if (!aggregates || aggregates.totalAssignments === 0) {
    return "Ready";
  }

  if (aggregates.completedAssignments >= aggregates.totalAssignments) {
    return "Complete";
  }

  if (aggregates.blockedAssignments > 0) {
    return "Blocked";
  }

  if (aggregates.inProgressAssignments > 0) {
    return "In Progress";
  }

  return "Not Started";
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Complete") return "default";
  if (status === "In Progress") return "secondary";
  if (status === "Blocked") return "destructive";
  return "outline";
}

const DEFAULT_ACTION_STATE: Record<ProjectActionKey, ActionState> = {
  wireList: { enabled: true },
  print: { enabled: true },
  details: { enabled: true },
  exports: { enabled: true },
  lifecycle: { enabled: true },
};

const DEFAULT_SUMMARY_STATE = {
  brandListReady: false,
  brandingCombinedRelativePath: null as string | null,
};

const ACTION_CARD_BASE_CLASS =
  "h-full min-h-[96px] w-full min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-xs";

const ACTION_BUTTON_BASE_CLASS =
  "h-full w-full justify-start rounded-none border-0 px-3 py-3 text-left";

const ACTION_ICON_WRAP_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center";

const ACTION_CONTENT_CLASS = "flex w-full items-start gap-2.5";

export function ProjectHomeCard({
  project,
  isActive = false,
  onDelete,
  onAction,
}: ProjectHomeCardProps) {
  const [actionState, setActionState] = useState<Record<ProjectActionKey, ActionState>>(DEFAULT_ACTION_STATE);
  const [summaryState, setSummaryState] = useState(DEFAULT_SUMMARY_STATE);
  const [isMultiSheetReviewOpen, setIsMultiSheetReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/projects/${encodeURIComponent(project.id)}/action-state`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json() as Promise<ProjectActionStateResponse>;
      })
      .then((payload) => {
        if (!cancelled) {
          setActionState({
            ...DEFAULT_ACTION_STATE,
            ...payload.actions,
          });
          setSummaryState({
            brandListReady: Boolean(payload.summary?.brandListReady),
            brandingCombinedRelativePath: payload.summary?.brandingCombinedRelativePath ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActionState(DEFAULT_ACTION_STATE);
          setSummaryState(DEFAULT_SUMMARY_STATE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const statusLabel = useMemo(() => deriveProjectStatus(project), [project]);
  const operationalSheetCount = useMemo(
    () => project.sheets.filter((sheet) => sheet.kind === "operational").length,
    [project.sheets],
  );

  const buildExportHref = useCallback(
    (relativePath: string) => {
      const normalizedRelativePath = relativePath.replace(/^exports\//, "");
      const encodedSegments = normalizedRelativePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      return `/api/projects/${encodeURIComponent(project.id)}/exports/files/${encodedSegments}?download=1`;
    },
    [project.id],
  );

  const handleDownloadReadyBrandList = useCallback(() => {
    if (!summaryState.brandingCombinedRelativePath) {
      return;
    }

    window.open(buildExportHref(summaryState.brandingCombinedRelativePath), "_blank", "noopener,noreferrer");
  }, [buildExportHref, summaryState.brandingCombinedRelativePath]);

  const actionButtons: Array<{
    key: ProjectActionKey;
    label: string;
    icon: typeof FileStack;
    fileFormat: "pdf" | "xlsx" | "json";
  }> = [
    { key: "wireList", label: "Wire Lists", icon: FileStack, fileFormat: "pdf" },
    { key: "print", label: "Print", icon: Printer, fileFormat: "pdf" },
    { key: "details", label: "Details", icon: FileSearch, fileFormat: "json" },
    { key: "exports", label: "Exports", icon: FileOutput, fileFormat: "xlsx" },
    { key: "lifecycle", label: "Lifecycle", icon: Layers, fileFormat: "json" },
  ];

  return (
    <Card
      className={cn(
        "gap-2 overflow-hidden rounded-none border-border/70 bg-card/85 py-0 shadow-sm transition-all",
        isActive && "ring-2 ring-primary/30",
      )}
    >
      <CardHeader className="px-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full font-mono">
                {project.pdNumber || "No PD#"}
              </Badge>
              <Badge variant={getStatusVariant(statusLabel)} className="rounded-full">
                {statusLabel}
              </Badge>
              <LwcTypeField
                mode="status"
                value={project.lwcType}
                className="rounded-full bg-secondary text-secondary-foreground"
              />
            </div>

            <div>
              <CardTitle className="truncate text-xl">{project.name}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Unit {project.unitNumber || project.unitType || "TBD"}</span>
                <span className="text-border">•</span>
                <span>{operationalSheetCount} panels</span>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete &quot;{project.name}&quot; and remove its stored project state.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <div className="grid w-full grid-cols-1 gap-2.5 rounded-2xl bg-accent/40 p-2.5 sm:grid-cols-2">
          {actionButtons.map((action) => {
            const state = actionState[action.key];

            const content = (
              <div className={ACTION_CONTENT_CLASS}>
                <div className={ACTION_ICON_WRAP_CLASS}>
                  <div className="origin-center scale-[0.68]">
                    <FileCard formatFile={action.fileFormat} />
                  </div>
                </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.95rem] font-medium leading-tight">{action.label}</span>
                    </div>
                  <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">
                    {state.enabled ? "Open workspace" : state.reason ?? "Unavailable"}
                  </span>
                </div>
              </div>
            );

            if (action.key === "wireList") {
              return (
                <div
                  key={action.key}
                  className={cn(
                    ACTION_CARD_BASE_CLASS,
                    "grid grid-cols-[minmax(0,1fr)_2.75rem]",
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(ACTION_BUTTON_BASE_CLASS, "min-w-0")}
                    disabled={!state.enabled}
                    title={state.reason ?? undefined}
                    onClick={() => onAction("wireList", project)}
                  >
                    {content}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-full w-11 rounded-none border-l border-border/70 px-0"
                        disabled={!state.enabled && !summaryState.brandListReady}
                        aria-label="Open wire list actions"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Wire List Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction("wireList", project)}>
                        <FileStack className="mr-2 h-4 w-4" />
                        Open Wire Lists
                      </DropdownMenuItem>
                      {summaryState.brandListReady && summaryState.brandingCombinedRelativePath ? (
                        <DropdownMenuItem onClick={handleDownloadReadyBrandList}>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                          Brand List Ready
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onAction("exports", project)}>
                          <Download className="mr-2 h-4 w-4" />
                          Open Brand Lists
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onAction("exports", project)}>
                        <FileOutput className="mr-2 h-4 w-4" />
                        Open Exports
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            }

            return (
              <Button
                key={action.key}
                type="button"
                variant="outline"
                className={cn(ACTION_CARD_BASE_CLASS, "px-0")}
                disabled={!state.enabled}
                title={state.reason ?? undefined}
                onClick={() => onAction(action.key, project)}
              >
                <div className="w-full px-3 py-3">{content}</div>
              </Button>
            );
          })}
        </div>

        <div className="mt-2.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/5 p-2.5">
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full justify-between rounded-xl px-4"
            disabled={operationalSheetCount === 0}
            onClick={() => setIsMultiSheetReviewOpen(true)}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="h-4 w-4" />
              Combine Excel Branding List
            </span>
            <span className="text-xs text-muted-foreground">
              {summaryState.brandListReady ? "Continue or download" : "Open review"}
            </span>
          </Button>
        </div>
      </CardContent>

      <MultiSheetReviewModal
        projectId={project.id}
        open={isMultiSheetReviewOpen}
        onOpenChange={setIsMultiSheetReviewOpen}
        showTrigger={false}
        title="Combine Excel Branding List"
        combineLabel="Combine Excel Branding List"
      />
    </Card>
  );
}
