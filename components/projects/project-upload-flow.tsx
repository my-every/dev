"use client";

import { useState, useCallback, useRef } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Shield,
  Check,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SecureActionModal } from "@/components/profile/secure-action-modal";
import { PartsIngestPreviewDialog } from "@/components/projects/parts-ingest-preview-dialog";
import { useAppRuntime } from "@/components/providers/app-runtime-provider";
import { useUploadContext } from "@/contexts/upload-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ColorPicker,
  ColorPickerTrigger,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerHueSlider,
  ColorPickerSwatch,
} from "@/components/ui/color-picker";
import { useSession } from "@/hooks/use-session";
import { useProjectContext } from "@/contexts/project-context";
import { cn } from "@/lib/utils";
import {
  PdNumberField,
  UnitNumberField,
  RevisionField,
  LwcTypeField,
  DateField,
} from "@/components/projects/fields";
import { parseWorkbook, validateWorkbookFile } from "@/lib/workbook/parse-workbook";
import { buildProjectModel, findSheetBySlug } from "@/lib/workbook/build-project-model";
import { generateCleanProjectId, normalizeSheetName } from "@/lib/workbook/normalize-sheet-name";
import { ACCEPTED_FILE_EXTENSIONS } from "@/lib/workbook/constants";
import { type LwcType, type ProjectModel, type SemanticWireListRow } from "@/lib/workbook/types";
import { extractStructuredPdfText } from "@/lib/layout-matching/extract-pdf-text";
import {
  renderPdfPagesToImages,
  type LayoutPagePreview,
} from "@/lib/layout-matching";
import { saveLayoutPages } from "@/lib/storage/layout-storage";
import { buildUploadPropsManifest } from "@/lib/workbook/upload-props";

import type { FileRevision } from "@/lib/revision/types";
import type { ProjectManifest } from "@/types/project-manifest";
import { canPerformAction } from "@/types/d380-user-session";
import { getPermissionDeniedMessage } from "@/lib/session/session-feedback";

interface FileEntry {
  id: string;
  file: File;
  type: "excel" | "pdf";
  status: "pending" | "processing" | "success" | "error";
  message?: string;
}

export interface RevisionUploadCompleteResult {
  wireListRevision?: FileRevision;
  layoutRevision?: FileRevision;
  projectModel?: ProjectModel;
  layoutPages: LayoutPagePreview[];
  matchedRows: SemanticWireListRow[];
  matchedLayoutPage: LayoutPagePreview | null;
}

interface CreateProjectUploadResult {
  projectId: string;
  projectName: string;
  hasDeferredLayoutProcessing: boolean;
}

interface PartsIngestPreviewError extends Error {
  details?: string;
}

interface PartsIngestPreviewSummary {
  createdCount: number;
  previewParts: string[];
  uniqueCandidates: number;
  existingCount: number;
}

interface PreparedWorkbookContext {
  fileKey: string;
  projectModel: ProjectModel;
  uploadPropsManifest: ReturnType<typeof buildUploadPropsManifest>;
}

interface ProjectUploadFlowProps {
  mode?: "create" | "revision";
  projectId?: string;
  currentSheetSlug?: string;
  initialProjectName?: string;
  initialPdNumber?: string;
  initialUnitNumber?: string;
  initialRevision?: string;
  initialLwcType?: LwcType;
  initialDueDate?: Date;
  onCancel?: () => void;
  onClose?: () => void;
  onRevisionComplete?: (result: RevisionUploadCompleteResult) => void;
}

function hasUploadedLegalArtifacts(project: ProjectManifest): boolean {
  const hasOperationalSheets = (project.sheets ?? []).some(
    (sheet) => sheet.kind === "operational" && sheet.hasData,
  );
  return hasOperationalSheets
    || Boolean(project.activeWorkbookRevisionId)
    || Boolean(project.activeLayoutRevisionId);
}

function normalizeManifestAfterLegalUpload(manifest: ProjectManifest): ProjectManifest {
  if (!hasUploadedLegalArtifacts(manifest)) {
    return manifest;
  }

  const normalizedStatus = manifest.status === "legals_pending" ? "brandlist" : manifest.status;
  const normalizedLifecycleGates = manifest.lifecycleGates?.map((gate) => {
    if (gate.gateId === "BRANDLIST_COMPLETE" && gate.status === "LOCKED") {
      return {
        ...gate,
        status: "READY" as const,
      };
    }
    return gate;
  });

  if (normalizedStatus === manifest.status && normalizedLifecycleGates === manifest.lifecycleGates) {
    return manifest;
  }

  return {
    ...manifest,
    status: normalizedStatus,
    lifecycleGates: normalizedLifecycleGates,
  };
}

const PROJECT_COLOR_PALETTE = [
  "#FBBF24",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#3B82F6",
  "#06B6D4",
  "#10B981",
  "#84CC16",
  "#F97316",
];

function generateRandomColor(): string {
  return PROJECT_COLOR_PALETTE[Math.floor(Math.random() * PROJECT_COLOR_PALETTE.length)];
}

export function ProjectUploadFlow({
  mode = "create",
  projectId,
  currentSheetSlug,
  initialProjectName = "",
  initialPdNumber = "",
  initialUnitNumber = "",
  initialRevision = "",
  initialLwcType,
  initialDueDate,
  onCancel,
  onClose,
  onRevisionComplete,
}: ProjectUploadFlowProps) {
  const isRevisionMode = mode === "revision";
  const hasExistingRevision = initialRevision.trim().length > 0;
  const router = useRouter();
  const { appMode } = useAppRuntime();
  const { saveProject } = useProjectContext();
  const { verifyCredentials, changePin } = useSession();
  const { startUpload, completeUpload, updateUploadMessage, failUpload } = useUploadContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const partsPreviewResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [projectName, setProjectName] = useState(initialProjectName);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdNumber, setPdNumber] = useState(initialPdNumber);
  const [pdNumberError, setPdNumberError] = useState<string | null>(null);
  const [unitNumber, setUnitNumber] = useState(initialUnitNumber);
  const [revision, setRevision] = useState(initialRevision);
  const [wlRevision, setWlRevision] = useState('');
  const [layRevision, setLayRevision] = useState('');
  const [lwcType, setLwcType] = useState<LwcType | undefined>(initialLwcType);
  const [dueDate, setDueDate] = useState<Date | undefined>(initialDueDate);
  const [planConlayDate, setPlanConlayDate] = useState<Date | undefined>(undefined);
  const [planConassyDate, setPlanConassyDate] = useState<Date | undefined>(undefined);
  const [projectColor, setProjectColor] = useState(() => generateRandomColor());
  const [isCreating, setIsCreating] = useState(false);
  const [processingStatusMessage, setProcessingStatusMessage] = useState(
    isRevisionMode
      ? hasExistingRevision
        ? "Preparing revision upload..."
        : "Preparing legal upload..."
      : "Preparing project workspace...",
  );
  const [processingStatusDetail, setProcessingStatusDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isBadgeAuthRequired, setIsBadgeAuthRequired] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinChangeRequired, setPinChangeRequired] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [partsPreview, setPartsPreview] = useState<PartsIngestPreviewSummary | null>(null);
  const processingStartedAtRef = useRef<number | null>(null);
  const preparedWorkbookRef = useRef<PreparedWorkbookContext | null>(null);

  const buildFileKey = useCallback((file: File) => `${file.name}:${file.size}:${file.lastModified}`, []);

  const beginProcessingStage = useCallback((message: string) => {
    processingStartedAtRef.current = performance.now();
    setProcessingStatusMessage(message);
    setProcessingStatusDetail("Starting...");
  }, []);

  const updateProcessingStage = useCallback((message: string) => {
    const now = performance.now();
    const startedAt = processingStartedAtRef.current ?? now;
    const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
    setProcessingStatusMessage(message);
    setProcessingStatusDetail(`Elapsed ${elapsedSeconds.toFixed(1)}s`);
  }, []);

  const completeProcessingStage = useCallback((message: string) => {
    const now = performance.now();
    const startedAt = processingStartedAtRef.current ?? now;
    const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
    setProcessingStatusMessage(message);
    setProcessingStatusDetail(`Completed in ${elapsedSeconds.toFixed(1)}s`);
  }, []);

  const regenerateProjectManifest = useCallback(async (activeProjectId: string) => {
    const regenerateManifestResponse = await fetch(
      `/api/projects/${encodeURIComponent(activeProjectId)}/manifest/regenerate`,
      { method: "POST" },
    );

    if (regenerateManifestResponse.ok) {
      return true;
    }

    console.warn("[ProjectUploadFlow] Dedicated manifest regenerate route unavailable; falling back to GET/PUT refresh.", {
      projectId: activeProjectId,
      status: regenerateManifestResponse.status,
    });

    const manifestResponse = await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}`, {
      cache: "no-store",
    });

    if (!manifestResponse.ok) {
      return false;
    }

    const manifestPayload = await manifestResponse.json() as { manifest?: ProjectManifest };
    if (!manifestPayload.manifest) {
      return false;
    }

    const fallbackRefreshResponse = await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifestPayload.manifest),
    });

    return fallbackRefreshResponse.ok;
  }, []);

  const prepareWorkbookContext = useCallback(async (file: File) => {
    const fileKey = buildFileKey(file);
    if (preparedWorkbookRef.current?.fileKey === fileKey) {
      return preparedWorkbookRef.current;
    }

    const validation = validateWorkbookFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid workbook file");
    }

    const workbookResult = await parseWorkbook(file);
    if (!workbookResult.success || !workbookResult.workbook) {
      throw new Error(workbookResult.errors.join("; ") || "Failed to parse workbook");
    }

    const projectModel = buildProjectModel(workbookResult.workbook);
    const uploadPropsManifest = buildUploadPropsManifest(workbookResult.workbook, projectModel);
    const preparedContext = { fileKey, projectModel, uploadPropsManifest };
    preparedWorkbookRef.current = preparedContext;
    return preparedContext;
  }, [buildFileKey]);

  const uploadLegalFiles = useCallback(async ({
    projectId: activeProjectId,
    workbookFile,
    layoutFile,
    baseRevision,
    nextPdNumber,
  }: {
    projectId: string;
    workbookFile?: File | null;
    layoutFile?: File | null;
    baseRevision: string;
    nextPdNumber: string;
  }) => {
    const formData = new FormData();
    if (workbookFile) formData.append("workbook", workbookFile);
    if (layoutFile) formData.append("layout", layoutFile);
    formData.append("baseRevision", baseRevision);
    formData.append("pdNumber", nextPdNumber);

    const response = await fetch(`/api/projects/revisions/${encodeURIComponent(activeProjectId)}/files`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Failed to save legal files" })) as { error?: string };
      throw new Error(payload.error || "Failed to save legal files");
    }

    return response.json().catch(() => null);
  }, []);

  const processDeferredLayoutPages = useCallback(async ({
    pdfFile,
    projectId: activeProjectId,
    nextPdNumber,
    nextProjectName,
  }: {
    pdfFile: File;
    projectId: string;
    nextPdNumber: string;
    nextProjectName: string;
  }) => {
    const startedAt = performance.now();

    try {
      updateUploadMessage("Generating layout previews in the background…");
      const layoutPages = await renderPdfPagesToImages(pdfFile, { scale: 1.5 });

      console.info("[ProjectUploadFlow] Background layout preview render complete", {
        projectId: activeProjectId,
        pageCount: layoutPages.length,
        renderElapsedMs: Math.round(performance.now() - startedAt),
      });

      updateUploadMessage("Saving layout previews to project state…");
      await saveLayoutPages(layoutPages, activeProjectId, {
        pdNumber: nextPdNumber,
        projectName: nextProjectName,
      });

      updateUploadMessage("Finalizing project manifest…");
      const regenerateManifestSucceeded = await regenerateProjectManifest(activeProjectId);
      if (!regenerateManifestSucceeded) {
        throw new Error("Failed to regenerate project manifest after background layout processing");
      }

      const totalElapsedMs = Math.round(performance.now() - startedAt);
      console.info("[ProjectUploadFlow] Background layout processing complete", {
        projectId: activeProjectId,
        totalElapsedMs,
      });
      completeUpload(`${nextProjectName || nextPdNumber || "Project"} uploaded successfully. Layout previews finished in ${(totalElapsedMs / 1000).toFixed(1)}s.`);
    } catch (error) {
      console.error("[ProjectUploadFlow] Background layout processing failed", error);
      failUpload(error instanceof Error ? error.message : "Background layout processing failed");
    }
  }, [completeUpload, failUpload, regenerateProjectManifest, updateUploadMessage]);

  const confirmPartsIngestPreview = useCallback((summary: PartsIngestPreviewSummary) => {
    setPartsPreview(summary);

    return new Promise<boolean>((resolve) => {
      partsPreviewResolverRef.current = resolve;
    });
  }, []);

  const handlePartsPreviewCancel = useCallback(() => {
    setPartsPreview(null);
    const resolver = partsPreviewResolverRef.current;
    partsPreviewResolverRef.current = null;
    resolver?.(false);
  }, []);

  const handlePartsPreviewConfirm = useCallback(() => {
    setPartsPreview(null);
    const resolver = partsPreviewResolverRef.current;
    partsPreviewResolverRef.current = null;
    resolver?.(true);
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const entries: FileEntry[] = [];

    for (const file of fileArray) {
      const fileName = file.name.toLowerCase();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      if (ACCEPTED_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
        if (!files.some((entry) => entry.type === "excel") && !entries.some((entry) => entry.type === "excel")) {
          entries.push({ id, file, type: "excel", status: "pending" });
        }
      } else if (fileName.endsWith(".pdf")) {
        if (!files.some((entry) => entry.type === "pdf") && !entries.some((entry) => entry.type === "pdf")) {
          entries.push({ id, file, type: "pdf", status: "pending" });
        }
      }
    }

    if (entries.length === 0) {
      return;
    }

    setFiles((prev) => [...prev, ...entries]);

    // Extract full revision from a filename base: everything after the PD# and middle keyword segments
    // e.g. "4N671-UCPWiringList_O.3_M.2" → "O.3_M.2"
    // e.g. "4M093_CORE-UCPWiringList_A.5" → "A.5"
    // e.g. "4M093_CORE_LAY_A.5_M2" → "A.5_M2"
    // e.g. "4M368_LAY_B.1_M1" → "B.1_M1"
    const extractRevision = (baseName: string): string => {
      // Remove PD# prefix and separator
      const afterPd = baseName.replace(/^[A-Z0-9]+[-_]/i, '');
      // Remove keyword segments (2+ alpha chars like CORE, UCPWiringList, LAY) and their separators.
      // Stops before a single letter followed by dot+digit (revision like B.1, A.5).
      const afterKeyword = afterPd.replace(/^(?:[A-Za-z]{2,}[-_]?)+/, '');
      // What remains is the revision, trim leading/trailing separators
      return afterKeyword.replace(/^[-_]+|[-_]+$/g, '').toUpperCase();
    };

    const excelEntry = entries.find((entry) => entry.type === "excel");

    if (excelEntry) {
      // Extract PD# from filename prefix (alphanumeric chars before first separator)
      const excelBaseName = excelEntry.file.name.replace(/\.(xlsx|xls|xlsm|xlsb)$/i, "");
      const pdMatch = excelBaseName.match(/^([A-Z0-9]+?)[-_]/i);
      if (pdMatch && !pdNumber) {
        setPdNumber(pdMatch[1].toUpperCase());
      }

      const excelRev = extractRevision(excelBaseName);
      if (excelRev) {
        setWlRevision(excelRev);
        if (!revision || isRevisionMode) {
          setRevision(excelRev.replace(/_/g, ''));
        }
      }
    }

    // Extract revision from PDF file if present
    const pdfEntry = entries.find((entry) => entry.type === "pdf") || files.find((entry) => entry.type === "pdf");
    if (pdfEntry) {
      const pdfBaseName = pdfEntry.file.name.replace(/\.pdf$/i, "");
      const pdfRev = extractRevision(pdfBaseName);
      if (pdfRev) {
        setLayRevision(pdfRev);
        // If no PD# yet, extract from PDF filename
        if (!pdNumber && !excelEntry) {
          const pdMatch = pdfBaseName.match(/^([A-Z0-9]+?)[-_]/i);
          if (pdMatch) {
            setPdNumber(pdMatch[1].toUpperCase());
          }
        }
        // If no Excel revision, use PDF revision for the main field
        if (!excelEntry && (!revision || isRevisionMode)) {
          setRevision(pdfRev.replace(/_/g, ''));
        }
      }
    }
  }, [files, pdNumber, revision]);

  const validatePdNumber = useCallback((value: string) => {
    if (!value) {
      setPdNumberError(null);
      return true;
    }

    if (value.length < 3) {
      setPdNumberError("PD# must be at least 3 characters");
      return false;
    }

    if (!/^[A-Z0-9]+$/.test(value)) {
      setPdNumberError("PD# must be uppercase letters and numbers only");
      return false;
    }

    setPdNumberError(null);
    return true;
  }, []);

  const handlePdNumberChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setPdNumber(value);
    validatePdNumber(value);
  }, [validatePdNumber]);

  const handleProjectNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const capitalized = event.target.value.replace(/\b\w/g, (character) => character.toUpperCase());
    setProjectName(capitalized);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    addFiles(event.dataTransfer.files);
  }, [addFiles]);

  const processRevisionUpload = useCallback(async () => {
    if (!projectId) {
      throw new Error("Revision upload requires an active project");
    }

    beginProcessingStage("Preparing revision upload...");

    const workbookEntry = files.find((entry) => entry.type === "excel");
    const layoutEntry = files.find((entry) => entry.type === "pdf");

    if (!workbookEntry && !layoutEntry) {
      throw new Error("Upload at least one file (workbook or layout PDF) for a revision update");
    }

    if (workbookEntry) {
      const validation = validateWorkbookFile(workbookEntry.file);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid workbook file");
      }
    }

    setFiles((prev) => prev.map((entry) => {
      if (entry.id === workbookEntry?.id) return { ...entry, status: "processing", message: "Parsing workbook..." };
      if (entry.id === layoutEntry?.id) return { ...entry, status: "processing", message: "Parsing layout PDF..." };
      return entry;
    }));

    let projectModel: ProjectModel | null = null;
    let uploadPropsManifest: ReturnType<typeof buildUploadPropsManifest> | null = null;
    let layoutPages: LayoutPagePreview[] = [];

    if (workbookEntry) {
      updateProcessingStage("Parsing workbook revision...");
      const preparedWorkbook = await prepareWorkbookContext(workbookEntry.file);
      projectModel = preparedWorkbook.projectModel;
      uploadPropsManifest = preparedWorkbook.uploadPropsManifest;
      projectModel.id = projectId;

      const existingManifestResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      }).catch(() => null);
      const existingManifestPayload = existingManifestResponse?.ok
        ? await existingManifestResponse.json().catch(() => null) as { manifest?: ProjectManifest } | null
        : null;
      const existingManifest = existingManifestPayload?.manifest ?? null;

      if (existingManifest?.createdAt) {
        projectModel.createdAt = new Date(existingManifest.createdAt);
      }
      if (existingManifest?.status) {
        projectModel.status = existingManifest.status;
      }
      if (existingManifest?.lifecycleGates) {
        projectModel.lifecycleGates = existingManifest.lifecycleGates;
      }
      if (typeof existingManifest?.estimatedTotalHours === "number") {
        projectModel.estimatedTotalHours = existingManifest.estimatedTotalHours;
      }
      if (typeof existingManifest?.estimatedPanelCount === "number") {
        projectModel.estimatedPanelCount = existingManifest.estimatedPanelCount;
      }
      if (typeof existingManifest?.daysLate === "number") {
        projectModel.daysLate = existingManifest.daysLate;
      }
      if (existingManifest?.shipDate) {
        projectModel.shipDate = new Date(existingManifest.shipDate);
      }
      if (existingManifest?.deptTargetDate) {
        projectModel.deptTargetDate = new Date(existingManifest.deptTargetDate);
      }
      if (existingManifest?.activeWorkbookRevisionId) {
        projectModel.activeWorkbookRevisionId = existingManifest.activeWorkbookRevisionId;
      }
      if (existingManifest?.activeLayoutRevisionId) {
        projectModel.activeLayoutRevisionId = existingManifest.activeLayoutRevisionId;
      }

      if (projectName.trim()) {
        projectModel.name = projectName.trim();
      } else if (initialProjectName.trim()) {
        projectModel.name = initialProjectName.trim();
      }
      if (pdNumber.trim() && validatePdNumber(pdNumber)) {
        projectModel.pdNumber = pdNumber.trim();
      }
      if (unitNumber.trim()) {
        projectModel.unitNumber = unitNumber.trim();
      }
      if (revision.trim()) {
        projectModel.revision = revision.trim();
      }
      if (lwcType) {
        projectModel.lwcType = lwcType;
      }
      if (dueDate) {
        projectModel.dueDate = dueDate;
      }
      if (planConlayDate) {
        projectModel.planConlayDate = planConlayDate;
      }
      if (planConassyDate) {
        projectModel.planConassyDate = planConassyDate;
      }
      if (projectColor) {
        projectModel.color = projectColor;
      }

      updateProcessingStage("Hydrating project sheets from workbook...");
      const projectStateResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectModel }),
      });

      if (!projectStateResponse.ok) {
        throw new Error("Failed to persist project state from workbook");
      }

      const projectStatePayload = await projectStateResponse.json() as { manifest?: ProjectManifest };
      if (projectStatePayload.manifest) {
        saveProject(projectStatePayload.manifest);
      }
    }

    if (layoutEntry) {
      updateProcessingStage("Rendering layout previews...");
      layoutPages = await renderPdfPagesToImages(layoutEntry.file, {
        scale: 1.5,
        onProgress: (progress) => {
          setFiles((prev) => prev.map((entry) =>
            entry.id === layoutEntry.id
              ? { ...entry, status: "processing", message: progress.message || `Rendering page ${progress.currentPage}/${progress.totalPages}...` }
              : entry,
          ));
        },
      });
    }

    const slug = currentSheetSlug ? normalizeSheetName(currentSheetSlug) : null;
    let matchedSheet: ReturnType<typeof findSheetBySlug> | null = null;
    let matchedLayoutPage: LayoutPagePreview | null = null;

    if (projectModel && slug) {
      matchedSheet = findSheetBySlug(projectModel, slug)
        ?? (() => {
          const fallbackSummary = projectModel.sheets.find((sheet) => normalizeSheetName(sheet.name) === slug);
          return fallbackSummary
            ? { summary: fallbackSummary, data: projectModel.sheetData[fallbackSummary.id] }
            : null;
        })();
    }

    const formData = new FormData();
    if (workbookEntry) formData.append("workbook", workbookEntry.file);
    if (layoutEntry) formData.append("layout", layoutEntry.file);
    formData.append("baseRevision", revision || projectModel?.revision || "UPLOADED");
    formData.append("pdNumber", pdNumber || projectModel?.pdNumber || "");

    updateProcessingStage("Uploading revision files to Share...");
    const response = await fetch(`/api/projects/revisions/${encodeURIComponent(projectId)}/files`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Revision upload failed" })) as { error?: string };
      throw new Error(payload.error || "Revision upload failed");
    }

    const payload = await response.json() as {
      wireListRevision: FileRevision | null;
      layoutRevision: FileRevision | null;
    };
    if (uploadPropsManifest) {
      updateProcessingStage("Saving upload metadata...");
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/state/upload-props`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdNumber: pdNumber || projectModel?.pdNumber || null,
          projectName: projectModel?.name || null,
          props: uploadPropsManifest,
        }),
      }).catch(() => null);
    }

    if (layoutEntry && layoutPages.length > 0) {
      const nextPdNumber = pdNumber || projectModel?.pdNumber || initialPdNumber || projectId;
      const nextProjectName = projectModel?.name || projectName || initialProjectName || projectId;

      updateProcessingStage("Saving layout previews...");
      await saveLayoutPages(layoutPages, projectId, {
        pdNumber: nextPdNumber,
        projectName: nextProjectName,
      });

      updateProcessingStage("Regenerating manifest from layout data...");
      const regenerateManifestSucceeded = await regenerateProjectManifest(projectId);
      if (!regenerateManifestSucceeded) {
        throw new Error("Failed to regenerate project manifest after saving layout pages");
      }
    }

    updateProcessingStage("Refreshing manifest state...");
    const refreshedManifestResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    });
    if (refreshedManifestResponse.ok) {
      const refreshedPayload = await refreshedManifestResponse.json() as { manifest?: ProjectManifest };
      if (refreshedPayload.manifest) {
        const normalizedManifest = normalizeManifestAfterLegalUpload(refreshedPayload.manifest);
        saveProject(normalizedManifest);
      }
    }

    setFiles((prev) => prev.map((entry) => ({
      ...entry,
      status: "success",
      message: entry.type === "excel"
        ? `Parsed ${projectModel?.sheets.length ?? 0} sheets`
        : layoutPages.length > 0
          ? `Saved ${layoutPages.length} layout pages`
          : "Uploaded layout PDF",
    })));

    onRevisionComplete?.({
      wireListRevision: payload.wireListRevision ?? undefined,
      layoutRevision: payload.layoutRevision ?? undefined,
      projectModel: projectModel ?? undefined,
      layoutPages,
      matchedRows: matchedSheet?.data.semanticRows ?? [],
      matchedLayoutPage,
    });
    completeProcessingStage("Revision upload complete");
  }, [beginProcessingStage, completeProcessingStage, currentSheetSlug, dueDate, files, initialProjectName, lwcType, onRevisionComplete, pdNumber, planConassyDate, planConlayDate, prepareWorkbookContext, projectColor, projectId, projectName, regenerateProjectManifest, revision, saveProject, unitNumber, updateProcessingStage, validatePdNumber]);

  const handleCreateProject = useCallback(async (): Promise<CreateProjectUploadResult | void> => {
    if (isRevisionMode) {
      await processRevisionUpload();
      return;
    }

    const excelFile = files.find((entry) => entry.type === "excel");
    if (!excelFile) {
      setError("Please upload an Excel workbook file");
      return;
    }

    beginProcessingStage("Validating and parsing workbook...");
    setFiles((prev) => prev.map((entry) => entry.id === excelFile.id ? { ...entry, status: "processing", message: "Parsing workbook..." } : entry));

    const preparedWorkbook = await prepareWorkbookContext(excelFile.file);
    const projectModel = preparedWorkbook.projectModel;
    const uploadPropsManifest = preparedWorkbook.uploadPropsManifest;
    if (projectName.trim()) {
      projectModel.name = projectName.trim();
    }
    if (pdNumber.trim() && validatePdNumber(pdNumber)) {
      projectModel.pdNumber = pdNumber.trim();
    }
    if (unitNumber.trim()) {
      projectModel.unitNumber = unitNumber.trim();
    }
    if (revision.trim()) {
      projectModel.revision = revision.trim();
    }
    if (lwcType) {
      projectModel.lwcType = lwcType;
    }
    if (dueDate) {
      projectModel.dueDate = dueDate;
    }
    if (planConlayDate) {
      projectModel.planConlayDate = planConlayDate;
    }
    if (planConassyDate) {
      projectModel.planConassyDate = planConassyDate;
    }
    if (projectColor) {
      projectModel.color = projectColor;
    }

    const canonicalProjectId =
      projectModel.pdNumber.trim() && projectModel.name.trim()
        ? generateCleanProjectId(projectModel.pdNumber, projectModel.name)
        : projectModel.id;
    projectModel.id = canonicalProjectId;

    setFiles((prev) => prev.map((entry) => entry.id === excelFile.id ? { ...entry, status: "success", message: `Parsed ${projectModel.sheets.length} sheets` } : entry));

    updateProcessingStage("Saving project state to Share...");
    const projectResponse = await fetch(`/api/projects/${encodeURIComponent(projectModel.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectModel }),
    });

    if (!projectResponse.ok) {
      throw new Error("Failed to persist project state");
    }
    const projectPayload = await projectResponse.json() as { manifest?: ProjectManifest };
    await fetch(`/api/projects/${encodeURIComponent(projectModel.id)}/state/upload-props`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdNumber: projectModel.pdNumber,
        projectName: projectModel.name,
        props: uploadPropsManifest,
      }),
    }).catch(() => null);

    if (projectPayload.manifest) {
      saveProject(projectPayload.manifest);
    }

    const pdfFile = files.find((entry) => entry.type === "pdf");
    const nextPdNumber = projectModel.pdNumber || pdNumber.trim() || projectModel.id;

    updateProcessingStage("Saving legal files...");
    await uploadLegalFiles({
      projectId: projectModel.id,
      workbookFile: excelFile.file,
      layoutFile: pdfFile?.file ?? null,
      baseRevision: revision || projectModel.revision || "UPLOADED",
      nextPdNumber,
    });

    const printSchemasResponse = await fetch(
      `/api/projects/${encodeURIComponent(projectModel.id)}/wire-list-print-schemas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      },
    ).catch(() => null);

    if (!printSchemasResponse?.ok) {
      console.warn("Print schema generation failed (non-blocking). Schemas can be regenerated from the print modal.");
    }

    if (pdfFile) {
      setFiles((prev) => prev.map((entry) => entry.id === pdfFile.id ? {
        ...entry,
        status: "success",
        message: "Layout PDF saved. Preview generation will continue in the background.",
      } : entry));

      void processDeferredLayoutPages({
        pdfFile: pdfFile.file,
        projectId: projectModel.id,
        nextPdNumber,
        nextProjectName: projectModel.name,
      });
    }

    completeProcessingStage(pdfFile ? "Project upload complete. Layout previews continuing in background." : "Project upload complete");
    return {
      projectId: projectModel.id,
      projectName: projectModel.name,
      hasDeferredLayoutProcessing: Boolean(pdfFile),
    };
  }, [beginProcessingStage, completeProcessingStage, dueDate, files, isRevisionMode, lwcType, pdNumber, planConassyDate, planConlayDate, prepareWorkbookContext, processDeferredLayoutPages, processRevisionUpload, projectColor, projectName, revision, saveProject, unitNumber, updateProcessingStage, uploadLegalFiles, validatePdNumber]);

  const runPartsIngestDryRunPreview = useCallback(async () => {
    if (isRevisionMode || appMode !== "DEPARTMENT") {
      return;
    }

    const excelEntry = files.find((entry) => entry.type === "excel");
    if (!excelEntry) {
      return;
    }

    const preparedWorkbook = await prepareWorkbookContext(excelEntry.file);
    const projectModel = preparedWorkbook.projectModel;
    if (projectName.trim()) {
      projectModel.name = projectName.trim();
    }
    if (pdNumber.trim() && validatePdNumber(pdNumber)) {
      projectModel.pdNumber = pdNumber.trim();
    }
    if (unitNumber.trim()) {
      projectModel.unitNumber = unitNumber.trim();
    }
    if (revision.trim()) {
      projectModel.revision = revision.trim();
    }
    if (lwcType) {
      projectModel.lwcType = lwcType;
    }
    if (dueDate) {
      projectModel.dueDate = dueDate;
    }
    if (planConlayDate) {
      projectModel.planConlayDate = planConlayDate;
    }
    if (planConassyDate) {
      projectModel.planConassyDate = planConassyDate;
    }
    if (projectColor) {
      projectModel.color = projectColor;
    }

    const dryRunResponse = await fetch("/api/parts/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dryRun: true,
        project: {
          id: projectModel.id,
          projectModel,
        },
      }),
    });

    if (!dryRunResponse.ok) {
      const responseText = await dryRunResponse.text().catch(() => "");
      let detail = responseText.trim();

      try {
        const parsed = JSON.parse(responseText) as { error?: string; details?: unknown };
        detail = [
          parsed.error,
          typeof parsed.details === "string"
            ? parsed.details
            : parsed.details
              ? JSON.stringify(parsed.details, null, 2)
              : "",
        ].filter(Boolean).join("\n\n");
      } catch {
        // Keep raw response text when the API did not return JSON.
      }

      const previewError = new Error("Failed to run dry-run parts ingest preview") as PartsIngestPreviewError;
      previewError.details = detail || `HTTP ${dryRunResponse.status} ${dryRunResponse.statusText}`;
      throw previewError;
    }

    const payload = await dryRunResponse.json() as {
      success?: boolean;
      result?: {
        createdCount?: number;
        createdParts?: string[];
        uniqueCandidates?: number;
        existingCount?: number;
      };
      error?: string;
    };

    if (!payload.success || !payload.result) {
      throw new Error(payload.error || "Unable to preview parts ingest");
    }

    const createdCount = payload.result.createdCount ?? 0;
    if (createdCount === 0) {
      return;
    }

    const previewList = (payload.result.createdParts ?? []).slice(0, 12);
    const shouldContinue = await confirmPartsIngestPreview({
      createdCount,
      previewParts: previewList,
      uniqueCandidates: payload.result.uniqueCandidates ?? 0,
      existingCount: payload.result.existingCount ?? 0,
    });

    if (!shouldContinue) {
      throw new Error("Upload cancelled after parts ingest preview.");
    }
  }, [appMode, confirmPartsIngestPreview, dueDate, files, isRevisionMode, lwcType, pdNumber, planConassyDate, planConlayDate, prepareWorkbookContext, projectColor, projectName, revision, unitNumber, validatePdNumber]);

  const executeUpload = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    setErrorDetails(null);
    setProcessingStatusDetail(null);

    try {
      await runPartsIngestDryRunPreview();
    } catch (err) {
      setIsCreating(false);
      const message = err instanceof Error ? err.message : "Unable to run parts ingest preview";
      setError(message);
      setErrorDetails(err && typeof err === "object" && "details" in err && typeof (err as PartsIngestPreviewError).details === "string"
        ? (err as PartsIngestPreviewError).details ?? null
        : null);
      failUpload(message);
      return;
    }

    // Dismiss the dialog immediately and notify the user via the background banner
    const displayName = projectName.trim() || pdNumber || "Project";
    startUpload(displayName);
    onClose?.();

    try {
      const result = await handleCreateProject();
      if (isRevisionMode) {
        onCancel?.();
      } else {
        router.push("/projects");
      }
      if (!result || !("hasDeferredLayoutProcessing" in result) || !result.hasDeferredLayoutProcessing) {
        completeUpload(`${displayName} uploaded successfully!`);
      } else {
        updateUploadMessage(`${displayName} uploaded. Layout previews are still processing in the background…`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      failUpload(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [completeUpload, failUpload, handleCreateProject, isRevisionMode, onCancel, onClose, pdNumber, projectName, router, runPartsIngestDryRunPreview, startUpload, updateUploadMessage]);

  const hasExcel = files.some((entry) => entry.type === "excel");
  const hasPdf = files.some((entry) => entry.type === "pdf");
  const hasValidPdNumber = !pdNumber || (pdNumber.length >= 3 && /^[A-Z0-9]+$/.test(pdNumber));
  const canProceedToStep2 = isRevisionMode ? (hasExcel || hasPdf) : hasExcel && projectName.trim().length > 0;
  const canCreate = isRevisionMode
    ? (hasExcel || hasPdf) && !isCreating
    : hasExcel && !isCreating && hasValidPdNumber && projectName.trim().length > 0;

  const handleProceedToStep2 = useCallback(() => {
    if (!canProceedToStep2) {
      return;
    }
    setProjectColor(generateRandomColor());
    setCurrentStep(2);
  }, [canProceedToStep2]);

  const handleUploadClick = useCallback(() => {
    if (!canCreate) {
      return;
    }

    if (!isBadgeAuthRequired) {
      void executeUpload();
      return;
    }

    setAuthError(null);
    setPinChangeRequired(false);
    setShowAuthModal(true);
  }, [canCreate, executeUpload, isBadgeAuthRequired]);

  useEffect(() => {
    let isMounted = true;

    const loadAuthCapability = async () => {
      try {
        const response = await fetch("/api/runtime/share-directory", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json() as { hasUsersDirectory?: boolean };
        if (isMounted) {
          setIsBadgeAuthRequired(payload.hasUsersDirectory !== false);
        }
      } catch {
        // Keep auth enabled when runtime capability cannot be determined.
      }
    };

    void loadAuthCapability();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthSubmit = useCallback(async (badge: string, pin: string) => {
    setIsVerifying(true);
    setAuthError(null);
    setPinChangeRequired(false);
    const verifyStartedAt = performance.now();

    try {
      const result = await verifyCredentials(badge, pin);
      console.info("[ProjectUploadFlow] Badge verification completed", {
        badge,
        elapsedMs: Math.round(performance.now() - verifyStartedAt),
        success: result.success,
      });
      if (!result.success || !result.user) {
        setPinChangeRequired(Boolean(result.requiresPinChange));
        const message = result.error || "Authentication failed.";
        setAuthError(message);
        setFeedbackType("error");
        setFeedbackMessage(message);
        setShowFeedbackModal(true);
        setTimeout(() => setShowFeedbackModal(false), 3000);
        return;
      }

      if (!canPerformAction(result.user.role, "UPLOAD_PROJECT")) {
        const permissionMessage = getPermissionDeniedMessage(["MANAGER", "SUPERVISOR", "TEAM_LEAD", "QA", "BRANDER", "ASSEMBLER"], "UPLOAD_PROJECT");
        setAuthError(permissionMessage);
        setFeedbackType("error");
        setFeedbackMessage(permissionMessage);
        setShowFeedbackModal(true);
        setTimeout(() => setShowFeedbackModal(false), 3000);
        return;
      }

      const userName = result.user.preferredName || result.user.legalName || "User";
      setShowAuthModal(false);
      void executeUpload();
    } catch {
      console.info("[ProjectUploadFlow] Badge verification failed", {
        badge,
        elapsedMs: Math.round(performance.now() - verifyStartedAt),
      });
      setAuthError("Verification failed. Please try again.");
      setFeedbackType("error");
      setFeedbackMessage("Verification failed. Please try again.");
      setShowFeedbackModal(true);
      setTimeout(() => setShowFeedbackModal(false), 3000);
    } finally {
      setIsVerifying(false);
    }
  }, [executeUpload, isRevisionMode, verifyCredentials]);

  const handlePinChangeSubmit = useCallback(async (badge: string, currentPin: string, nextPin: string) => {
    setIsVerifying(true);
    setAuthError(null);

    try {
      const result = await changePin(badge, currentPin, nextPin);
      if (!result.success) {
        setAuthError(result.error || "PIN update failed.");
        return;
      }

      setPinChangeRequired(false);
      setFeedbackType("success");
      setFeedbackMessage("PIN updated. Sign in again with your new PIN to continue.");
      setShowFeedbackModal(true);
      setTimeout(() => setShowFeedbackModal(false), 2500);
    } finally {
      setIsVerifying(false);
    }
  }, [changePin]);

  const StepIndicator = ({ step, label, isActive, isComplete }: { step: number; label: string; isActive: boolean; isComplete: boolean }) => (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
          isComplete && "border-primary bg-primary text-primary-foreground",
          isActive && !isComplete && "border-primary bg-primary/10 text-primary",
          !isActive && !isComplete && "border-muted-foreground/30 text-muted-foreground",
        )}
      >
        {isComplete ? <Check className="h-5 w-5" /> : step}
      </div>
      <span className={cn("text-sm font-medium", isActive || isComplete ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );

  if (isCreating) {
    return null;
  }

  const content = (
    <div className="w-full max-w-3xl">
      <div className="flex max-h-[calc(92vh-13rem)] flex-col gap-6 overflow-y-auto pr-1">
      {!isRevisionMode && (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Upload Project</h1>
          <p className="text-sm text-muted-foreground">Create a new project in two easy steps.</p>
              {!isBadgeAuthRequired ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Badge sign-in is disabled because the selected Share root has no users directory.
                </p>
              ) : null}
        </div>
      )}

      {isRevisionMode && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {hasExistingRevision ? "Revision Upload" : "Upload Legals"}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasExistingRevision
              ? `Upload a workbook or layout PDF (or both) to update ${initialProjectName || initialPdNumber || projectId}.`
              : `Upload the first workbook or layout PDF package for ${initialProjectName || initialPdNumber || projectId}.`}
          </p>
        </div>
      )}

      <div className="flex items-center gap-8 py-2">
        <StepIndicator step={1} label="Upload Files" isActive={currentStep === 1} isComplete={currentStep > 1} />
        <div className="h-0.5 flex-1 rounded-full bg-muted-foreground/20">
          <div className={cn("h-full rounded-full bg-primary transition-all duration-300", currentStep > 1 ? "w-full" : "w-0")} />
        </div>
        <StepIndicator
          step={2}
          label={isRevisionMode ? (hasExistingRevision ? "Review Revision" : "Review Upload") : "Configure Details"}
          isActive={currentStep === 2}
          isComplete={false}
        />
      </div>

      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
            {!isRevisionMode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Project Name</CardTitle>
                  <CardDescription>Enter a recognizable name for your project (auto-capitalizes)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input value={projectName} onChange={handleProjectNameChange} placeholder="Enter project name..." className="max-w-md text-lg" />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{isRevisionMode ? "Revision Files" : "Project Files"}</CardTitle>
                <CardDescription>
                  {isRevisionMode
                    ? hasExistingRevision
                      ? "Upload a revised workbook, layout PDF, or both to update this project package"
                      : "Upload the workbook, layout PDF, or both to establish the first legal package"
                    : "Upload your Excel workbook (required) and layout PDF (optional)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors",
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/40",
                  )}
                >
                  <div className={cn("rounded-full p-3", isDragOver ? "bg-primary/10" : "bg-muted")}>
                    <Upload className={cn("h-6 w-6", isDragOver ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">{isDragOver ? "Drop files here" : "Drag and drop files"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={[...ACCEPTED_FILE_EXTENSIONS, ".pdf"].join(",")}
                    onChange={(event) => event.target.files && addFiles(event.target.files)}
                    className="sr-only"
                    multiple
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isCreating}>
                    <Plus className="mr-2 h-4 w-4" />
                    Select Files
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {files.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-2">
                      {files.map((entry) => (
                        <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={cn(
                          "flex items-center gap-3 rounded-lg border p-3",
                          entry.status === "success" && "border-chart-2/20 bg-chart-2/5",
                          entry.status === "error" && "border-destructive/20 bg-destructive/5",
                          entry.status === "processing" && "border-primary/20 bg-primary/5",
                          entry.status === "pending" && "border-border bg-muted/50",
                        )}>
                          {entry.status === "processing" ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                            : entry.status === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-chart-2" />
                              : entry.status === "error" ? <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                                : entry.type === "excel" ? <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
                                  : <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{entry.file.name}</p>
                            {entry.message && <p className={cn("text-xs", entry.status === "error" ? "text-destructive" : "text-muted-foreground")}>{entry.message}</p>}
                          </div>
                          <Badge variant={entry.type === "excel" ? "default" : "outline"}>{entry.type === "excel" ? "Excel" : "PDF"}</Badge>
                          {entry.status !== "processing" && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeFile(entry.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {hasExcel ? <CheckCircle2 className="h-4 w-4 text-chart-2" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                    <span className={hasExcel ? "text-foreground" : "text-muted-foreground"}>Excel Workbook {hasExcel ? "" : isRevisionMode ? "(optional)" : "(required)"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPdf ? <CheckCircle2 className="h-4 w-4 text-chart-2" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                    <span className={hasPdf ? "text-foreground" : "text-muted-foreground"}>Layout PDF {hasPdf ? "" : isRevisionMode ? "(optional)" : "(optional)"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              {(onCancel || onClose) ? <Button variant="outline" onClick={onCancel || onClose}>Cancel</Button> : <Button variant="outline" onClick={() => router.push('/projects')}>Cancel</Button>}
              <Button onClick={handleProceedToStep2} disabled={!canProceedToStep2} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-6">
            <Card className="bg-muted/30">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="font-medium">{files.find((entry) => entry.type === "excel")?.file.name}</span>
                  </div>
                  {hasPdf && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <span className="text-muted-foreground">{files.find((entry) => entry.type === "pdf")?.file.name}</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="ml-auto">Change Files</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{isRevisionMode ? "Revision Details" : "Project Configuration"}</CardTitle>
                </div>
                <CardDescription>
                  {isRevisionMode
                    ? "Review the captured project metadata before uploading the revision pair."
                    : "These fields were auto-populated from your file. Modify as needed."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <PdNumberField
                    mode="create"
                    label="PD#"
                    value={pdNumber}
                    onChange={(v) => { setPdNumber(v); validatePdNumber(v); }}
                    placeholder="4N671"
                    description="Drawing #"
                    error={pdNumberError ?? undefined}
                  />
                  <UnitNumberField
                    mode="create"
                    label="Unit #"
                    value={unitNumber}
                    onChange={setUnitNumber}
                    placeholder="001"
                    description="Unit identifier"
                  />
                  <RevisionField
                    mode="create"
                    label="Rev #"
                    value={revision}
                    onChange={setRevision}
                    extractedWl={wlRevision ?? undefined}
                    extractedLay={layRevision ?? undefined}
                    description={!(wlRevision || layRevision) ? "Auto-extracted" : undefined}
                  />
                </div>

                {!isRevisionMode && (
                  <>
              
                    <div className="flex flex-wrap gap-4">
                    <LwcTypeField
                        mode="create"
                        label="LWC Type"
                        value={lwcType}
                        onChange={setLwcType}
                        description="Classification"
                      />
   
                      <DateField
                        mode="create"
                        label="PLAN CONLAY"
                        value={planConlayDate}
                        onChange={setPlanConlayDate}
                        placeholder="Select date"
                        description="Planned Assembly Start Date"
                        className="flex-1"
                      />
                      <DateField
                        mode="create"
                        label="PLAN CONASSY"
                        value={planConassyDate}
                        onChange={setPlanConassyDate}
                        placeholder="Select date"
                        description="Planned Assembly Completion Date"
                        className="flex-1"
                      />

                    <DateField
                        mode="create"
                        label="Due Date"
                        value={dueDate}
                        onChange={setDueDate}
                        placeholder="Select date"
                        description="Planned Target Date"
                        minDate={new Date()}
                        className="flex-1"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium">Project Color</Label>
                      <div className="flex items-center gap-3">
                        <ColorPicker value={projectColor} onValueChange={setProjectColor}>
                          <ColorPickerTrigger asChild>
                            <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent" type="button">
                              <div className="h-6 w-6 rounded-md border border-border/50 shadow-sm" style={{ backgroundColor: projectColor }} />
                              <span className="font-mono text-sm uppercase">{projectColor}</span>
                            </button>
                          </ColorPickerTrigger>
                          <ColorPickerContent>
                            <ColorPickerArea />
                            <ColorPickerHueSlider />
                            <div className="flex flex-wrap gap-1 pt-2">
                              {PROJECT_COLOR_PALETTE.map((color) => <ColorPickerSwatch key={color} value={color} />)}
                            </div>
                          </ColorPickerContent>
                        </ColorPicker>
                        <Button variant="ghost" size="sm" onClick={() => setProjectColor(generateRandomColor())} className="text-muted-foreground">Randomize</Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {error && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                  {errorDetails ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-destructive/20 bg-background/80 p-3 text-xs leading-5 text-foreground">
              {errorDetails}
                    </pre>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {isCreating ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{processingStatusMessage}</span>
                    {processingStatusDetail ? (
                      <span className="text-xs text-muted-foreground">{processingStatusDetail}</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleUploadClick} disabled={!canCreate} className="gap-2">
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    {isRevisionMode ? "Upload Revision Changes" : "Upload Project"}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );

  return (
    <>
      {content}

      <SecureActionModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="UPLOAD_PROJECT"
        onSubmit={handleAuthSubmit}
        isSubmitting={isVerifying}
        error={authError}
        pinChangeRequired={pinChangeRequired}
        onChangePin={handlePinChangeSubmit}
        title={isRevisionMode ? "Authenticate to Upload Revision" : "Authenticate to Upload"}
        description={isRevisionMode ? "Enter your badge number and PIN to upload revision files" : "Enter your badge number and PIN to upload this project"}
        showNumpad
      />

      <PartsIngestPreviewDialog
        open={partsPreview !== null}
        createdCount={partsPreview?.createdCount ?? 0}
        previewParts={partsPreview?.previewParts ?? []}
        uniqueCandidates={partsPreview?.uniqueCandidates ?? 0}
        existingCount={partsPreview?.existingCount ?? 0}
        onCancel={handlePartsPreviewCancel}
        onConfirm={handlePartsPreviewConfirm}
      />

      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn(
              "mx-4 max-w-sm rounded-xl border bg-card p-6 text-center shadow-2xl",
              feedbackType === "success" ? "border-emerald-500/30" : "border-destructive/30",
            )}>
              <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full", feedbackType === "success" ? "bg-emerald-500/10" : "bg-destructive/10")}>
                {feedbackType === "success" ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <AlertCircle className="h-8 w-8 text-destructive" />}
              </div>
              <h3 className={cn("mb-2 text-lg font-semibold", feedbackType === "success" ? "text-emerald-500" : "text-destructive")}>
                {feedbackType === "success" ? "Authentication Successful" : "Authentication Failed"}
              </h3>
              <p className="text-sm text-muted-foreground">{feedbackMessage}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
