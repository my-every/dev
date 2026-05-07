"use client";

import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProjectRevisionTreeRow, RevisionFilesystemNode } from "@/lib/revision/types";

interface RevisionFilesystemTreeTableProps {
  rows: ProjectRevisionTreeRow[];
  isLoading?: boolean;
  expandedProjectKeys: Set<string>;
  selectedProjectKeys: Set<string>;
  onToggleExpand: (projectKey: string) => void;
  onToggleProjectSelection: (projectKey: string, nextSelected: boolean) => void;
  onToggleSelectAll: (nextSelected: boolean) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function NodeTypeBadge({ node }: { node: RevisionFilesystemNode }) {
  const label = node.fileTypeIndicator ?? node.type;
  const variant = label === "layout-pdf"
    ? "default"
    : label === "wire-list" || label === "compare-wire-list"
      ? "secondary"
      : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}

function ValidationBadge({ project }: { project: ProjectRevisionTreeRow }) {
  if (project.validation.missingRequiredLegalAssets) {
    return <Badge variant="destructive">Missing Legal Assets</Badge>;
  }
  if (project.validation.brandListRevisionsIncomplete) {
    return <Badge variant="secondary">Brand Incomplete</Badge>;
  }
  if (project.validation.revisionMetadataStale) {
    return <Badge variant="outline">Metadata Stale</Badge>;
  }
  return <Badge variant="default">Valid</Badge>;
}

function ReadinessBadge({ readiness }: { readiness: ProjectRevisionTreeRow["readiness"] }) {
  if (readiness === "ready") return <Badge variant="default">Ready</Badge>;
  if (readiness === "partial") return <Badge variant="secondary">Partial</Badge>;
  return <Badge variant="destructive">Blocked</Badge>;
}

export function RevisionFilesystemTreeTable({
  rows,
  isLoading = false,
  expandedProjectKeys,
  selectedProjectKeys,
  onToggleExpand,
  onToggleProjectSelection,
  onToggleSelectAll,
}: RevisionFilesystemTreeTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedProjectKeys.has(row.rootLabel));

  return (
    <div className="rounded-lg border border-border">
      <div className="grid grid-cols-[42px_280px_1fr_180px_140px_170px_170px_120px_120px] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
          aria-label="Select all projects"
        />
        <span>Project / Node</span>
        <span>Absolute Path</span>
        <span>Last Modified</span>
        <span>File Type</span>
        <span>Revision Pairing</span>
        <span>Prev vs Current</span>
        <span>Validation</span>
        <span>Readiness</span>
      </div>

      <div className="max-h-105 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 px-3 py-3">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="grid grid-cols-[42px_280px_1fr_180px_140px_170px_170px_120px_120px] items-center gap-2"
              >
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">No projects found for this scan.</div>
        ) : null}

        {!isLoading && rows.map((project) => {
          const isExpanded = expandedProjectKeys.has(project.rootLabel);
          const isSelected = selectedProjectKeys.has(project.rootLabel);
          const pairingLabel = project.validation.hasMatchingRevisionPairs
            ? "Matched"
            : project.revisionPairState.comparisonState === "partial"
              ? "Partial"
              : "Missing";

          return (
            <div key={project.rootLabel} className="border-b last:border-b-0">
              <div className="grid grid-cols-[42px_280px_1fr_180px_140px_170px_170px_120px_120px] items-center gap-2 px-3 py-2 text-sm">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onToggleProjectSelection(project.rootLabel, Boolean(checked))}
                  aria-label={`Select ${project.rootLabel}`}
                />

                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onToggleExpand(project.rootLabel)}
                    aria-label={isExpanded ? `Collapse ${project.rootLabel}` : `Expand ${project.rootLabel}`}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  {isExpanded ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                  <span className="truncate font-medium">{project.rootLabel}</span>
                </div>

                <span className="truncate text-xs text-muted-foreground">
                  {project.legalFolderName || project.brandFolderName || "-"}
                </span>
                <span className="text-xs">{formatDate(project.latestModifiedAt)}</span>
                <Badge variant="outline">project</Badge>
                <Badge variant={project.validation.hasMatchingRevisionPairs ? "default" : "secondary"}>{pairingLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  {project.revisionPairState.previousWireListRevision || "-"} → {project.revisionPairState.latestWireListRevision || "-"}
                </span>
                <ValidationBadge project={project} />
                <ReadinessBadge readiness={project.readiness} />
              </div>

              {isExpanded ? (
                <div className="space-y-0.5 bg-muted/15 px-3 pb-2">
                  {project.filesNewestFirst.map((node) => (
                    <div
                      key={node.id}
                      className={cn(
                        "grid grid-cols-[42px_280px_1fr_180px_140px_170px_170px_120px_120px] items-center gap-2 rounded-md px-1 py-1 text-xs",
                        "hover:bg-muted/40",
                      )}
                    >
                      <span />
                      <div className="flex min-w-0 items-center gap-2 pl-8">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{node.name}</span>
                        <span className="text-[10px] text-muted-foreground">{formatSize(node.sizeBytes)}</span>
                      </div>
                      <span className="truncate text-muted-foreground">{node.absolutePath}</span>
                      <span>{formatDate(node.modifiedAt)}</span>
                      <NodeTypeBadge node={node} />
                      <span>{node.revisionInfo?.displayVersion || "-"}</span>
                      <span>{node.revisionInfo?.revision || "-"}</span>
                      <Badge variant={node.validationStatus === "valid" ? "default" : "secondary"}>
                        {node.validationStatus || "-"}
                      </Badge>
                      <Badge variant={node.readinessStatus === "ready" ? "default" : "secondary"}>
                        {node.readinessStatus || "-"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
