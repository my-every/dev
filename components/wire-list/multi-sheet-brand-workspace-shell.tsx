"use client";

import { ImageIcon, Loader2, RefreshCcw } from "lucide-react";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandListEditorTable } from "@/components/wire-list/brand-list-editor-table";
import type {
  BrandListExportSchema,
  BrandListSchemaRow,
} from "@/lib/wire-brand-list/schema";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";

interface MultiSheetBrandWorkspaceShellProps {
  activeSlug?: string | null;
  activeSheetName?: string | null;
  activeImageUrl?: string | null;
  layoutWorkspaceEndpoint?: string | null;
  initialLayoutPageNumber?: number;
  activeBrandSchema: BrandListExportSchema | null;
  isSavingBrandSchema: boolean;
  reviewReadOnly: boolean;
  selectedBrandRows: Set<string>;
  onOpenLayoutReference: () => void;
  onRegenerate: () => void;
  onUpdateProjectInfo: (
    patch: Partial<BrandListExportSchema["projectInfo"]>,
  ) => void;
  onToggleRow: (rowId: string) => void;
  onToggleSection: (rowIds: string[]) => void;
  onRenameBundle: (
    prefixIndex: number,
    bundleIndex: number,
    nextName: string,
  ) => void;
  onUpdateRow: (
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
    patch: Partial<BrandListSchemaRow>,
  ) => void;
  onAddRow: (prefixIndex: number, bundleIndex: number) => void;
  onRemoveRow: (
    prefixIndex: number,
    bundleIndex: number,
    rowIndex: number,
  ) => void;
}

export function MultiSheetBrandWorkspaceShell(
  props: MultiSheetBrandWorkspaceShellProps,
) {
  const {
    activeSlug,
    activeSheetName,
    activeImageUrl,
    layoutWorkspaceEndpoint,
    initialLayoutPageNumber,
    activeBrandSchema,
    isSavingBrandSchema,
    reviewReadOnly,
    selectedBrandRows,
    onOpenLayoutReference,
    onRegenerate,
    onUpdateProjectInfo,
    onToggleRow,
    onToggleSection,
    onRenameBundle,
    onUpdateRow,
    onAddRow,
    onRemoveRow,
  } = props;

  if (!activeSlug) {
    return <WorkspaceSkeleton />;
  }

  if (!activeBrandSchema) {
    return (
      <SchemaLoadingSkeleton
        isSavingBrandSchema={isSavingBrandSchema}
        hasLayoutReference={Boolean(activeImageUrl)}
        onOpenLayoutReference={onOpenLayoutReference}
      />
    );
  }

  const canOpenLayoutRef = Boolean(activeImageUrl || layoutWorkspaceEndpoint);
  const statusLabel = reviewReadOnly
    ? "View-only mode"
    : isSavingBrandSchema
      ? "Saving..."
      : "Saved to Share state";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b bg-background/95 px-4 py-4">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <ProjectIcon
                  name={
                    activeBrandSchema.projectInfo.projectName ||
                    activeBrandSchema.projectInfo.projectNumber ||
                    "Project"
                  }
                  color="#ffcc61"
                  interactive={false}
                />
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Brand List Editor
              </div>
              <h3 className="mt-1 truncate text-2xl font-semibold">
                {normalizeDisplayTitle(
                  activeSheetName || activeBrandSchema.sheetName || activeSlug,
                )}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">
                  {activeBrandSchema.totalRows} export rows
                </Badge>
                <span>{activeBrandSchema.prefixGroups.length} device groups</span>
                <span>{statusLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canOpenLayoutRef ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={onOpenLayoutReference}
                >
                  <ImageIcon className="h-4 w-4" />
                  Layout Ref
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onRegenerate}
                disabled={isSavingBrandSchema}
              >
                {isSavingBrandSchema ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Regenerate
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <SchemaInput
              label="Project"
              value={activeBrandSchema.projectInfo.projectName ?? ""}
              disabled={reviewReadOnly}
              onChange={(value) => onUpdateProjectInfo({ projectName: value })}
            />
            <SchemaInput
              label="PD / Project No."
              value={activeBrandSchema.projectInfo.projectNumber ?? ""}
              disabled={reviewReadOnly}
              onChange={(value) => onUpdateProjectInfo({ projectNumber: value })}
            />
            <SchemaInput
              label="Revision"
              value={activeBrandSchema.projectInfo.revision ?? ""}
              disabled={reviewReadOnly}
              onChange={(value) => onUpdateProjectInfo({ revision: value })}
            />
            <SchemaInput
              label="Controls DE"
              value={activeBrandSchema.projectInfo.controlsDE ?? ""}
              disabled={reviewReadOnly}
              onChange={(value) => onUpdateProjectInfo({ controlsDE: value })}
            />
            <SchemaInput
              label="Controls ME"
              value={activeBrandSchema.projectInfo.controlsME ?? ""}
              disabled={reviewReadOnly}
              onChange={(value) => onUpdateProjectInfo({ controlsME: value })}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-7xl px-4 py-4">
          <BrandListEditorTable
            schema={activeBrandSchema}
            layoutWorkspaceEndpoint={layoutWorkspaceEndpoint}
            initialLayoutPageNumber={initialLayoutPageNumber}
            selectedRowIds={selectedBrandRows}
            readOnly={reviewReadOnly}
            onToggleRow={(rowId) => onToggleRow(rowId)}
            onToggleSection={(rowIds) => onToggleSection(rowIds)}
            onRenameBundle={onRenameBundle}
            onUpdateRow={onUpdateRow}
            onAddRow={onAddRow}
            onRemoveRow={onRemoveRow}
          />
        </div>
      </div>
    </div>
  );
}

function SchemaLoadingSkeleton({
  isSavingBrandSchema,
  hasLayoutReference,
  onOpenLayoutReference,
}: {
  isSavingBrandSchema: boolean;
  hasLayoutReference: boolean;
  onOpenLayoutReference: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background flex-1">
      <div className="border-b bg-background/95 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Brand List
            </div>
            <div className="mt-1">
              <Skeleton className="h-9 w-64 max-w-full" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-28" />
              <span>
                {isSavingBrandSchema
                  ? "Loading brand list..."
                  : "Preparing brand list..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasLayoutReference ? (
              <Button type="button" variant="outline" onClick={onOpenLayoutReference}>
                Open layout
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled>
              Preparing...
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-3 rounded-2xl border bg-card/40 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading sheet workspace...
    </div>
  );
}

function SchemaInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <Input
        value={value}
        className="h-9"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
