"use client";

import { ImageIcon, Printer } from "lucide-react";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="flex h-full min-h-0 max-w-7xl justify-start flex-col bg-background overflow-y-scroll scrollbar-thin">
      <div className="border-b bg-background/95 px-4 py-4">
        <div className="mx-auto flex flex-col flex-1  gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <ProjectIcon
                  name={
                    activeBrandSchema.projectInfo.projectName ||
                    activeBrandSchema.projectInfo.projectNumber ||
                    "Project"
                  }
                  color={activeBrandSchema.projectInfo.color ?? "#ffcc61"}
                  interactive={false}
                />
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Brand List Editor
              </div>
              <h3 className="mt-1 truncate text-2xl font-semibold">
                {normalizeDisplayTitle(activeBrandSchema.sheetName)}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="solid" size="sm">
                  {activeBrandSchema.totalRows} export rows
                </Badge>
                <span>
                  {activeBrandSchema.prefixGroups.length} device groups
                </span>
                {reviewReadOnly ? (
                  <span>View-only mode</span>
                ) : isSavingBrandSchema ? (
                  <span>Saving...</span>
                ) : (
                  <span>Saved to Share state</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
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
              onChange={(value) =>
                onUpdateProjectInfo({ projectNumber: value })
              }
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
          </div>
          <BrandListEditorTable
            schema={activeBrandSchema}
            layoutWorkspaceEndpoint={layoutWorkspaceEndpoint}
            initialLayoutPageNumber={initialLayoutPageNumber}
            selectedRowIds={selectedBrandRows}
            readOnly={reviewReadOnly}
            onToggleRow={onToggleRow}
            onToggleSection={onToggleSection}
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
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
            <Button type="button" variant="outline" disabled>
              Preparing...
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="rounded-3xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-36 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="overflow-hidden">
            <div className="grid grid-cols-[80px_1.3fr_0.7fr_0.7fr_0.7fr_0.7fr_1.1fr_1.1fr_1.2fr] gap-0 border-b bg-muted/50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {[
                "Select",
                "From Device",
                "Wire No.",
                "Wire ID",
                "Gauge",
                "Length",
                "To Device",
                "To Location",
                "Bundle Display",
              ].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[80px_1.3fr_0.7fr_0.7fr_0.7fr_0.7fr_1.1fr_1.1fr_1.2fr] gap-3 border-b px-4 py-3"
                >
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <Skeleton
                      key={cellIndex}
                      className="h-8 w-full rounded-lg"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border bg-card/40 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium text-foreground">
                Loading brand list approval editor
              </div>
              <p className="mt-1">
                We are preparing the saved schema for this sheet. You can also
                return to the cover page to import an existing brand list
                workbook before continuing review.
              </p>
            </div>
          </div>
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
