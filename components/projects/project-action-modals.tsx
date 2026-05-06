"use client";

import { useEffect, useState } from "react";

import type { MappedAssignment } from "@/components/projects/project-assignment-mapping-modal";
import { ProjectDetailsModal } from "@/components/projects/project-details-modal";
import { ProjectExportsModal } from "@/components/projects/project-exports-modal";
import { ProjectLifecycleModal } from "@/components/projects/project-lifecycle-modal";
import { SheetDetailModal } from "@/components/projects/sheet-detail-modal";
import type { ProjectActionKey } from "@/components/projects/project-home-card";
import type { ProjectManifest } from "@/types/project-manifest";
import { MultiSheetPrintModal } from "@/components/wire-list/multi-sheet-print-modal";

interface ProjectActionModalsProps {
  action: ProjectActionKey | null;
  project: ProjectManifest | null;
  onClose: () => void;
}

export function ProjectActionModals({
  action,
  project,
  onClose,
}: ProjectActionModalsProps) {
  const [assignments, setAssignments] = useState<MappedAssignment[]>([]);

  useEffect(() => {
    if (!project || action !== "details") {
      return;
    }

    let cancelled = false;

    void fetch(`/api/projects/${encodeURIComponent(project.id)}/assignment-mappings`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json() as Promise<{ mappings?: MappedAssignment[] }>;
      })
      .then((payload) => {
        if (!cancelled) {
          setAssignments(payload.mappings ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [action, project]);

  if (!project || !action) {
    return null;
  }

  const firstOperationalSheet =
    project.sheets.find((sheet) => sheet.kind === "operational")
    ?? Object.values(project.assignments ?? {}).find((entry) => entry.kind === "operational");

  const wireListSheetSlug = firstOperationalSheet?.slug ?? firstOperationalSheet?.sheetSlug ?? null;

  return (
    <>
      {wireListSheetSlug ? (
        <SheetDetailModal
          projectId={project.id}
          sheetName={wireListSheetSlug}
          showRevisionPanel
          open={action === "wireList"}
          onOpenChange={(open) => {
            if (!open) {
              onClose();
            }
          }}
        />
      ) : null}

      <MultiSheetPrintModal
        projectId={project.id}
        open={action === "print"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        showTrigger={false}
      />

      <ProjectDetailsModal
        open={action === "details"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        project={project}
        assignments={assignments}
      />

      <ProjectExportsModal
        open={action === "exports"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        projectId={project.id}
      />

      <ProjectLifecycleModal
        open={action === "lifecycle"}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}
