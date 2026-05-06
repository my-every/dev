"use client";

/**
 * Hook for managing project workbook state.
 * 
 * This hook handles:
 * - File upload and parsing
 * - Project state persistence (localStorage)
 * - Project retrieval
 * - Error handling
 */

import { useState, useCallback, useEffect } from "react";
import type { ProjectModel, ParsingState, UploadProgress } from "@/lib/workbook/types";
import { parseWorkbook, validateWorkbookFile } from "@/lib/workbook/parse-workbook";
import { buildProjectModel } from "@/lib/workbook/build-project-model";
import { PROJECT_STORAGE_KEY, CURRENT_PROJECT_KEY, LAYOUT_PDF_STORAGE_KEY } from "@/lib/workbook/constants";
import type { ParsedLayoutPdf } from "@/lib/wire-length";

interface UseProjectWorkbookReturn {
  /** The current project model, if any */
  project: ProjectModel | null;
  /** Current upload/parsing state */
  uploadProgress: UploadProgress;
  /** Whether we're currently loading from storage */
  isLoading: boolean;
  /** Upload and parse a new workbook file */
  uploadWorkbook: (file: File) => Promise<void>;
  /** Clear the current project */
  clearProject: () => void;
  /** Any error messages */
  error: string | null;
  /** Set parsed layout PDF data */
  setLayoutPdf: (pdf: ParsedLayoutPdf | null) => void;
  /** Current layout PDF data */
  layoutPdf: ParsedLayoutPdf | null;
}

/**
 * Serialize a project model for storage.
 */
function serializeProject(project: ProjectModel): string {
  return JSON.stringify({
    ...project,
    createdAt: project.createdAt.toISOString(),
  });
}

/**
 * Deserialize a project model from storage.
 */
function deserializeProject(data: string): ProjectModel | null {
  try {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
    };
  } catch {
    return null;
  }
}

/**
 * Hook for managing project workbook upload, parsing, and state.
 */
export function useProjectWorkbook(): UseProjectWorkbookReturn {
  const [project, setProject] = useState<ProjectModel | null>(null);
  const [layoutPdf, setLayoutPdfState] = useState<ParsedLayoutPdf | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    state: "idle",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load project from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (stored) {
        const loadedProject = deserializeProject(stored);
        if (loadedProject) {
          setProject(loadedProject);
        }
      }
      
      // Also load layout PDF if present
      const storedPdf = localStorage.getItem(LAYOUT_PDF_STORAGE_KEY);
      if (storedPdf) {
        try {
          const parsedPdf = JSON.parse(storedPdf) as ParsedLayoutPdf;
          setLayoutPdfState(parsedPdf);
        } catch {
          console.error("Failed to parse stored layout PDF");
        }
      }
    } catch (err) {
      console.error("Failed to load project from storage:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save project to localStorage whenever it changes
  useEffect(() => {
    if (project) {
      try {
        localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(project));
        sessionStorage.setItem(CURRENT_PROJECT_KEY, project.id);
      } catch (err) {
        console.error("Failed to save project to storage:", err);
      }
    }
  }, [project]);

  /**
   * Upload and parse a workbook file.
   */
  const uploadWorkbook = useCallback(async (file: File) => {
    setError(null);
    setUploadProgress({ state: "uploading", message: "Validating file..." });

    // Validate file
    const validation = validateWorkbookFile(file);
    if (!validation.isValid) {
      setError(validation.error || "Invalid file");
      setUploadProgress({ state: "error", message: validation.error });
      return;
    }

    // Parse workbook
    setUploadProgress({ state: "parsing", message: "Parsing workbook sheets..." });

    try {
      const result = await parseWorkbook(file);

      if (!result.success || !result.workbook) {
        const errorMsg = result.errors.join("; ") || "Failed to parse workbook";
        setError(errorMsg);
        setUploadProgress({ state: "error", message: errorMsg });
        return;
      }

      // Build project model
      setUploadProgress({ state: "parsing", message: "Building project model..." });
      const projectModel = buildProjectModel(result.workbook);

      // Success
      setProject(projectModel);
      setUploadProgress({ 
        state: "success", 
        message: `Successfully parsed ${projectModel.sheets.length} sheets` 
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMsg);
      setUploadProgress({ state: "error", message: errorMsg });
    }
  }, []);

  /**
   * Clear the current project and storage.
   */
  const clearProject = useCallback(() => {
    setProject(null);
    setLayoutPdfState(null);
    setError(null);
    setUploadProgress({ state: "idle" });
    
    try {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
      localStorage.removeItem(LAYOUT_PDF_STORAGE_KEY);
      sessionStorage.removeItem(CURRENT_PROJECT_KEY);
    } catch (err) {
      console.error("Failed to clear project from storage:", err);
    }
  }, []);

  /**
   * Set parsed layout PDF data.
   */
  const setLayoutPdf = useCallback((pdf: ParsedLayoutPdf | null) => {
    setLayoutPdfState(pdf);
    
    // Persist to storage
    try {
      if (pdf) {
        localStorage.setItem(LAYOUT_PDF_STORAGE_KEY, JSON.stringify(pdf));
      } else {
        localStorage.removeItem(LAYOUT_PDF_STORAGE_KEY);
      }
    } catch (err) {
      console.error("Failed to save layout PDF to storage:", err);
    }
  }, []);

  return {
    project,
    uploadProgress,
    isLoading,
    uploadWorkbook,
    clearProject,
    error,
    setLayoutPdf,
    layoutPdf,
  };
}

/**
 * Hook for accessing the current project from localStorage.
 * Useful in nested routes that need project data.
 */
export function useStoredProject(): {
  project: ProjectModel | null;
  isLoading: boolean;
  error: string | null;
} {
  const [project, setProject] = useState<ProjectModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (stored) {
        const loadedProject = deserializeProject(stored);
        if (loadedProject) {
          setProject(loadedProject);
        } else {
          setError("Failed to parse stored project data");
        }
      }
    } catch (err) {
      setError("Failed to load project from storage");
      console.error("Failed to load project:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { project, isLoading, error };
}
