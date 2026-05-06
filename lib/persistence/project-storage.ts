import type {
  AssignmentSwsConfig,
  AssignmentWorkspaceBrandingEdits,
  AssignmentWorkspaceBrandingRowEdit,
  AssignmentWorkspaceColumnOrder,
  AssignmentWorkspaceColumnVisibility,
  AssignmentWorkspaceRevisionSelection,
  AssignmentWorkspaceRowState,
  AssignmentWorkspaceWorkflowState,
} from "@/types/d380-assignment-sws";
import { createDefaultAssignmentWorkspaceState } from "@/types/d380-assignment-sws";
import type { PatchHistory, RowPatch } from "@/lib/row-patches";

export type WorkflowRowState = AssignmentWorkspaceRowState;
export type SheetWorkflowState = AssignmentWorkspaceWorkflowState;
export type ColumnVisibility = AssignmentWorkspaceColumnVisibility;
export type ColumnOrder = AssignmentWorkspaceColumnOrder;
export type BrandingRowEdit = AssignmentWorkspaceBrandingRowEdit;
export type SheetBrandingEdits = AssignmentWorkspaceBrandingEdits;
export type SheetRevisionSelection = AssignmentWorkspaceRevisionSelection;

type WorkspaceState = ReturnType<typeof createDefaultAssignmentWorkspaceState>;
type WorkspaceSection = Extract<keyof WorkspaceState, string>;

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

async function requestWorkspaceState(projectId: string, sheetSlug: string): Promise<WorkspaceState | null> {
  const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws/state`, {
    cache: "no-store",
  });
  const payload = await readJson<{ workspaceState?: WorkspaceState }>(response);
  return payload?.workspaceState ?? null;
}

async function saveWorkspaceSection<K extends WorkspaceSection>(projectId: string, sheetSlug: string, section: K, value: WorkspaceState[K]): Promise<boolean> {
  const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [section]: value }),
  });
  return response.ok;
}

async function clearWorkspaceSection(projectId: string, sheetSlug: string, scope?: WorkspaceSection): Promise<boolean> {
  const response = await fetch(
    `/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws/state${scope ? `?scope=${scope}` : ""}`,
    { method: "DELETE" },
  );
  return response.ok;
}

export async function saveWorkflowState(projectId: string, sheetSlug: string, workflow: SheetWorkflowState): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "workflow", workflow);
}

export async function loadWorkflowState(projectId: string, sheetSlug: string): Promise<SheetWorkflowState> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.workflow ?? {};
}

export async function clearWorkflowState(projectId: string, sheetSlug: string): Promise<boolean> {
  return clearWorkspaceSection(projectId, sheetSlug, "workflow");
}

export async function saveColumnVisibility(projectId: string, sheetSlug: string, visibility: ColumnVisibility): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "columnVisibility", visibility);
}

export async function loadColumnVisibility(projectId: string, sheetSlug: string): Promise<ColumnVisibility> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.columnVisibility ?? {};
}

export async function saveColumnOrder(projectId: string, sheetSlug: string, order: ColumnOrder): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "columnOrder", order);
}

export async function loadColumnOrder(projectId: string, sheetSlug: string): Promise<ColumnOrder> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.columnOrder ?? {};
}

export async function saveBrandingEdits(projectId: string, sheetSlug: string, edits: SheetBrandingEdits): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "brandingEdits", edits);
}

export async function loadBrandingEdits(projectId: string, sheetSlug: string): Promise<SheetBrandingEdits> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.brandingEdits ?? {};
}

export async function clearBrandingEdits(projectId: string, sheetSlug: string): Promise<boolean> {
  return clearWorkspaceSection(projectId, sheetSlug, "brandingEdits");
}

export async function saveRevisionSelection(projectId: string, sheetSlug: string, selection: SheetRevisionSelection): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "revisionSelection", selection);
}

export async function loadRevisionSelection(projectId: string, sheetSlug: string): Promise<SheetRevisionSelection> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.revisionSelection ?? {
    wireListFilename: null,
    layoutFilename: null,
  };
}

export async function clearRevisionSelection(projectId: string, sheetSlug: string): Promise<boolean> {
  return clearWorkspaceSection(projectId, sheetSlug, "revisionSelection");
}

export async function savePatchHistory(projectId: string, sheetSlug: string, history: PatchHistory): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "patchHistory", history);
}

export async function loadPatchHistory(projectId: string, sheetSlug: string): Promise<PatchHistory> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.patchHistory ?? createDefaultAssignmentWorkspaceState().patchHistory;
}

export async function clearPatchHistory(projectId: string, sheetSlug: string): Promise<boolean> {
  return clearWorkspaceSection(projectId, sheetSlug, "patchHistory");
}

export async function saveRowPatches(projectId: string, sheetSlug: string, rowPatches: RowPatch[]): Promise<boolean> {
  return saveWorkspaceSection(projectId, sheetSlug, "rowPatches", rowPatches);
}

export async function loadRowPatches(projectId: string, sheetSlug: string): Promise<RowPatch[]> {
  const state = await requestWorkspaceState(projectId, sheetSlug);
  return state?.rowPatches ?? [];
}

export async function clearRowPatches(projectId: string, sheetSlug: string): Promise<boolean> {
  return clearWorkspaceSection(projectId, sheetSlug, "rowPatches");
}

export async function saveSwsConfig(projectId: string, sheetSlug: string, config: AssignmentSwsConfig): Promise<boolean> {
  const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sws: config }),
  });
  return response.ok;
}

export async function loadSwsConfig(projectId: string, sheetSlug: string): Promise<AssignmentSwsConfig | null> {
  const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws`, {
    cache: "no-store",
  });
  const payload = await readJson<{ sws?: AssignmentSwsConfig }>(response);
  return payload?.sws ?? null;
}

export async function clearSwsConfig(projectId: string, sheetSlug: string): Promise<boolean> {
  const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "reset" }),
  });
  return response.ok;
}

export async function clearProjectData(projectId: string): Promise<boolean> {
  const response = await fetch(`/api/projects/${projectId}/assignments/sws`, {
    method: "DELETE",
  });
  return response.ok;
}

export async function getProjectSheetSlugs(projectId: string): Promise<string[]> {
  const response = await fetch(`/api/projects/${projectId}/assignments/sws`, {
    cache: "no-store",
  });
  const payload = await readJson<{ sheetSlugs?: string[] }>(response);
  return payload?.sheetSlugs ?? [];
}

export async function exportProjectData(projectId: string): Promise<Record<string, WorkspaceState>> {
  const sheetSlugs = await getProjectSheetSlugs(projectId);
  const entries = await Promise.all(
    sheetSlugs.map(async (sheetSlug) => [sheetSlug, await requestWorkspaceState(projectId, sheetSlug)] as const),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, WorkspaceState] => Boolean(entry[1])));
}

export async function importProjectData(projectId: string, payload: Record<string, Partial<WorkspaceState>>): Promise<boolean> {
  const results = await Promise.all(
    Object.entries(payload).map(async ([sheetSlug, state]) => {
      const response = await fetch(`/api/projects/${projectId}/assignments/${encodeURIComponent(sheetSlug)}/sws/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      return response.ok;
    }),
  );
  return results.every(Boolean);
}
