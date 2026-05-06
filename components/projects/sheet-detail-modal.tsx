"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useProjectContext } from "@/contexts/project-context";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDetailWorkspace } from "@/components/projects/sheet-detail-workspace";

interface SheetDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sheetName: string;
  showRevisionPanel?: boolean;
}

export function SheetDetailModal({
  open,
  onOpenChange,
  projectId,
  sheetName,
  showRevisionPanel = true,
}: SheetDetailModalProps) {
  const { currentProject, loadProject } = useProjectContext();
  const [activeSheetName, setActiveSheetName] = useState(sheetName);

  useEffect(() => {
    if (open) {
      loadProject(projectId);
      setActiveSheetName(sheetName);
    }
  }, [loadProject, open, projectId, sheetName]);

  const navigableSheets = useMemo(() => {
    if (!currentProject || currentProject.id !== projectId) {
      return [];
    }

    const manifestSheets = currentProject.sheets ?? [];
    const assignmentSheets = Object.values(currentProject.assignments ?? {}).map((entry) => ({
      slug: entry.sheetSlug,
      name: entry.sheetName,
      kind: entry.kind,
    }));
    const referenceSheets = Object.values(currentProject.referenceSheets ?? {}).map((entry) => ({
      slug: entry.sheetSlug,
      name: entry.sheetName,
      kind: entry.kind,
    }));

    const seen = new Set<string>();
    return [...manifestSheets, ...assignmentSheets, ...referenceSheets].filter((sheet) => {
      if (!sheet?.slug || seen.has(sheet.slug)) {
        return false;
      }
      seen.add(sheet.slug);
      return true;
    });
  }, [currentProject, projectId]);

  const activeIndex = useMemo(
    () => navigableSheets.findIndex((sheet) => sheet.slug === activeSheetName || sheet.name === activeSheetName),
    [activeSheetName, navigableSheets],
  );

  const activeEntry = activeIndex >= 0 ? navigableSheets[activeIndex] : null;
  const resolvedSheetName = activeEntry?.slug ?? activeSheetName;
  const isProjectReady = currentProject?.id === projectId;
  const modalTitle = activeEntry?.name ?? resolvedSheetName;
  const modalDescription = currentProject
    ? `${currentProject.name} · ${currentProject.pdNumber}`
    : "View a project sheet inside a modal and switch between sheets using bottom pagination controls.";

  const pagination = useMemo(() => ({
    index: activeIndex >= 0 ? activeIndex + 1 : 0,
    total: navigableSheets.length,
    canPrevious: activeIndex > 0,
    canNext: activeIndex >= 0 && activeIndex < navigableSheets.length - 1,
  }), [activeIndex, navigableSheets.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] max-w-[98vw] gap-0 overflow-hidden border-0 bg-card p-0 shadow-2xl sm:max-w-[98vw]" showCloseButton>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>

        {isProjectReady ? (
          <SheetDetailWorkspace
            projectId={projectId}
            sheetName={resolvedSheetName}
            presentation="modal"
            showRevisionPanel={showRevisionPanel}
            onRequestClose={() => onOpenChange(false)}
            onRequestPrevious={() => {
              const previous = navigableSheets[activeIndex - 1];
              if (previous) {
                setActiveSheetName(previous.slug);
              }
            }}
            onRequestNext={() => {
              const next = navigableSheets[activeIndex + 1];
              if (next) {
                setActiveSheetName(next.slug);
              }
            }}
            pagination={pagination}
          />
        ) : (
          <div className="flex h-full min-h-0 items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading project sheet…</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
