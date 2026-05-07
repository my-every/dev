"use client";

/**
 * ProjectContext — Unified context for multi-project state management
 *
 * Backed by the lightweight ProjectManifest pattern:
 *   - `project-manifest.json` (~5 KB) for listing + routing
 *   - `sheets/{slug}.json` (~20-40 KB) loaded on demand per sheet
 *
 * The monolithic ProjectModel with embedded sheetData is NO LONGER loaded globally.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import type { ProjectManifest } from "@/types/project-manifest";
import type { SheetSchema } from "@/types/sheet-schema";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";
import { clearProjectData } from "@/lib/persistence/project-storage";

// ============================================================================
// Types
// ============================================================================

// Storage key
const ACTIVE_PROJECT_KEY = "wirelist_active_project";

// ============================================================================
// Client-side API helpers
// ============================================================================

async function fetchManifests(): Promise<ProjectManifest[]> {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json() as { manifests?: ProjectManifest[] };
  return payload.manifests ?? [];
}

async function fetchManifest(projectId: string): Promise<ProjectManifest | null> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const payload = await response.json() as { manifest?: ProjectManifest };
  return payload.manifest ?? null;
}

async function persistManifest(manifest: ProjectManifest): Promise<void> {
  await fetch(`/api/projects/${encodeURIComponent(manifest.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
}

async function removeProject(projectId: string): Promise<void> {
  await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

async function fetchAssignmentMappings(projectId: string): Promise<MappedAssignment[]> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assignment-mappings`, { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json() as { mappings?: MappedAssignment[] };
  return payload.mappings ?? [];
}

async function persistAssignmentMappings(projectId: string, pdNumber: string | undefined, mappings: MappedAssignment[]): Promise<void> {
  await fetch(`/api/projects/${encodeURIComponent(projectId)}/assignment-mappings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdNumber, mappings }),
  });
}

async function patchAssignmentMapping(
  projectId: string,
  slug: string,
  update: { selectedStage?: string; selectedStatus?: string },
): Promise<{ slug: string; stage: string; status: string } | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assignment-mappings`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...update }),
    },
  );
  if (!response.ok) return null;
  return response.json();
}

export async function fetchSheetSchema(projectId: string, sheetSlug: string): Promise<SheetSchema | null> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sheets/${encodeURIComponent(sheetSlug)}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const payload = await response.json() as { schema?: SheetSchema };
  return payload.schema ?? null;
}

export async function fetchWireListPrintSchema(
  projectId: string,
  sheetSlug: string,
): Promise<WireListPrintSchema | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/wire-list-print-schemas?sheet=${encodeURIComponent(sheetSlug)}`,
    { cache: 'no-store' },
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<WireListPrintSchema>;
}

// ============================================================================
// Context Value
// ============================================================================

interface ProjectContextValue {
  /** Current project manifest (lightweight, no sheet data) */
  currentProject: ProjectManifest | null;
  currentProjectId: string | null;
  /** Assignment mappings for current project */
  assignmentMappings: MappedAssignment[];
  hasAssignmentMappings: boolean;
  saveAssignmentMappings: (mappings: MappedAssignment[]) => void;
  /** Patch a single assignment's stage/status (optimistic + API) */
  patchAssignment: (slug: string, update: { selectedStage?: string; selectedStatus?: string }) => void;
  /** All project manifests */
  allProjects: ProjectManifest[];
  /** Project management */
  loadProject: (projectId: string) => void;
  saveProject: (manifest: ProjectManifest) => void;
  deleteProject: (projectId: string) => Promise<void>;
  clearCurrentProject: () => void;
  isLoading: boolean;
}

const defaultContextValue: ProjectContextValue = {
  currentProject: null,
  currentProjectId: null,
  assignmentMappings: [],
  hasAssignmentMappings: false,
  saveAssignmentMappings: () => { },
  patchAssignment: () => { },
  allProjects: [],
  loadProject: () => { },
  saveProject: () => { },
  deleteProject: async () => { },
  clearCurrentProject: () => { },
  isLoading: true,
};

const ProjectContext = createContext<ProjectContextValue>(defaultContextValue);

// ============================================================================
// Provider
// ============================================================================

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectManifest | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectManifest[]>([]);
  const [assignmentMappings, setAssignmentMappings] = useState<MappedAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load all projects on mount
  useEffect(() => {
    if (!mounted) return;

    async function loadProjects() {
      try {
        const manifests = await fetchManifests();
        setAllProjects(manifests);

        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (activeId) {
          const active = manifests.find(m => m.id === activeId);
          if (active) {
            setCurrentProject(active);
            setCurrentProjectId(activeId);
            setAssignmentMappings(await fetchAssignmentMappings(activeId));
          }
        }
      } catch (err) {
        console.error("Failed to load projects from storage:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, [mounted]);

  const saveProject = useCallback((manifest: ProjectManifest) => {
    if (typeof window === "undefined") return;

    localStorage.setItem(ACTIVE_PROJECT_KEY, manifest.id);
    void persistManifest(manifest);

    setCurrentProject(manifest);
    setCurrentProjectId(manifest.id);
    setAllProjects(prev => {
      const next = prev.filter(p => p.id !== manifest.id);
      return [...next, manifest];
    });
  }, []);

  const loadProject = useCallback((projectId: string) => {
    if (typeof window === "undefined") return;

    void (async () => {
      try {
        const manifest = await fetchManifest(projectId);
        if (!manifest) return;

        setCurrentProject(manifest);
        setCurrentProjectId(projectId);
        localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);

        setAssignmentMappings(await fetchAssignmentMappings(projectId));
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    })();
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    if (typeof window === "undefined") return;

    await removeProject(projectId);
    clearProjectData(projectId);

    if (currentProjectId === projectId) {
      setCurrentProject(null);
      setCurrentProjectId(null);
      setAssignmentMappings([]);
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }

    setAllProjects(prev => prev.filter(p => p.id !== projectId));
  }, [currentProjectId]);

  const saveAssignmentMappings = useCallback((mappings: MappedAssignment[]) => {
    setAssignmentMappings(mappings);

    if (typeof window === "undefined" || !currentProjectId) return;

    void persistAssignmentMappings(currentProjectId, currentProject?.pdNumber, mappings);
  }, [currentProject, currentProjectId]);

  const patchAssignment = useCallback((slug: string, update: { selectedStage?: string; selectedStatus?: string }) => {
    // Optimistic local update
    setAssignmentMappings(prev =>
      prev.map(a =>
        a.sheetSlug === slug
          ? {
            ...a,
            ...(update.selectedStage !== undefined ? { selectedStage: update.selectedStage as MappedAssignment['selectedStage'] } : {}),
            ...(update.selectedStatus !== undefined ? { selectedStatus: update.selectedStatus as MappedAssignment['selectedStatus'] } : {}),
          }
          : a,
      ),
    );

    if (typeof window === "undefined" || !currentProjectId) return;

    void patchAssignmentMapping(currentProjectId, slug, update);
  }, [currentProjectId]);

  const hasAssignmentMappings = assignmentMappings.length > 0;

  const clearCurrentProject = useCallback(() => {
    setCurrentProject(null);
    setCurrentProjectId(null);
    setAssignmentMappings([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, []);

  const value: ProjectContextValue = {
    currentProject,
    currentProjectId,
    assignmentMappings,
    hasAssignmentMappings,
    saveAssignmentMappings,
    patchAssignment,
    allProjects,
    loadProject,
    saveProject,
    deleteProject,
    clearCurrentProject,
    isLoading,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Hook to access project context
 */
export function useProjectContext() {
  return useContext(ProjectContext);
}
