import type { ProjectManifest } from "@/types/project-manifest";

type UploadAwareProjectManifest = ProjectManifest & {
  activeWorkbookRevisionId?: string | null;
  activeLayoutRevisionId?: string | null;
};

export function hasUploadedLegals(project: ProjectManifest): boolean {
  const uploadAwareProject = project as UploadAwareProjectManifest;
  const hasOperationalSheets = (project.sheets ?? []).some(
    (sheet) => sheet.kind === "operational" && sheet.hasData,
  );

  return hasOperationalSheets
    || Boolean(uploadAwareProject.activeWorkbookRevisionId)
    || Boolean(uploadAwareProject.activeLayoutRevisionId);
}

export function getDashboardProjectStatus(project: ProjectManifest): NonNullable<ProjectManifest["status"]> {
  if (project.status && project.status !== "legals_pending") {
    return project.status;
  }

  if (hasUploadedLegals(project)) {
    const brandlistGate = project.lifecycleGates?.find((gate) => gate.gateId === "BRANDLIST_COMPLETE");
    const brandingGate = project.lifecycleGates?.find((gate) => gate.gateId === "BRANDING_READY");
    const kittingGate = project.lifecycleGates?.find((gate) => gate.gateId === "KITTING_READY");

    if (kittingGate?.status === "COMPLETE") return "active";
    if (brandingGate?.status === "COMPLETE") return "kitting";
    if (brandlistGate?.status === "COMPLETE") return "branding";
    return "brandlist";
  }

  return "legals_pending";
}
