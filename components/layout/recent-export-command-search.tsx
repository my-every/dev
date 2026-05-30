"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    BellRing,
    ChevronDown,
    FileSearch,
    FolderPlus,
    GitBranch,
    Loader2,
    RefreshCw,
    Search,
    SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandDialog } from "@/components/ui/command";
import { DateField } from "@/components/projects/fields";
import {
    ProjectLegalSearchCard,
    type ProjectLegalSearchFileRow,
    type ProjectLegalSearchSummary,
} from "@/components/layout/project-legal-search-card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectContext } from "@/contexts/project-context";
import { useSession } from "@/hooks/use-session";
import { toast as notifyToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LWC_TYPE_REGISTRY, type LwcType } from "@/lib/workbook/types";
import type { ProjectManifest } from "@/types/project-manifest";
import legalDrawingsBuildRunSnapshot from "@/Share/Legal Drawings/legal-drawings-build-run.json";

export type RecentExportSearchMode =
    | "project-updates"
    | "green-changes"
    | "revision-changes"
    | "legal-drawings";

export type RecentExportSearchProjectLink = {
    id: string;
    pdNumber: string;
    name: string;
    href: string;
    color?: string | null;
};

export type RecentExportCommandSearchConfig = {
    badgeNumber: string;
    projectLinks: RecentExportSearchProjectLink[];
    defaultWindow?: "30" | "60" | "90" | "6mo" | "year";
    initialMode?: RecentExportSearchMode;
};

type RecentExportFileEntry = {
    name: string;
    fullPath: string;
    revision: string | null;
    relativePath: string;
    lastWriteTime: string;
    sizeBytes: number;
    sizeKb: number;
};

type RecentExportDirectoryEntry = {
    directoryName: string;
    project: string | null;
    pdNumber: string | null;
    lastRefreshed: string;
    directoryPath: string;
    files: RecentExportFileEntry[];
};

type RecentDirectoryExportPayload = {
    generated?: boolean;
    isComplete?: boolean;
    message?: string;
    progress?: {
        phase: "legal" | "brand" | "complete";
        legalDirectoriesScanned: number;
        legalDirectoriesMatched: number;
        brandDirectoriesScanned: number;
        brandDirectoriesMatched: number;
        updatedAt: string;
    };
    generatedAt: string | null;
    window: "30" | "60" | "90" | "6mo" | "year" | null;
    cutoff: string | null;
    legalRoot: string;
    brandRoot: string;
    legalDirectories: RecentExportDirectoryEntry[];
    brandDirectories: RecentExportDirectoryEntry[];
    outputFilePath: string | null;
};

type LegalDrawingsBuildRunRevision = {
    revision?: string;
    revisionPath?: string;
    revisionMetaPath?: string;
    lastRunAt?: string;
    generatedRelativePaths?: string[];
};

type LegalDrawingsBuildRunProject = {
    pdNumber?: string;
    latestRevision?: string;
    projectMetaPath?: string;
    revisions?: LegalDrawingsBuildRunRevision[];
};

type LegalDrawingsBuildRunSnapshot = {
    startedAt?: string;
    completedAt?: string;
    legalRoot?: string;
    projects?: LegalDrawingsBuildRunProject[];
};

type ProjectSummary = ProjectLegalSearchSummary & {
    key: string;
    directoryPath: string;
};

type RecentExportCommandSearchProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placeholder?: string;
    config: RecentExportCommandSearchConfig;
};

type CreateProjectFromSearchForm = {
    name: string;
    pdNumber: string;
    unitNumber: string;
    revision: string;
    lwcType: LwcType | "";
    dueDate: string;
    planConlayDate: string;
    planConassyDate: string;
    shipDate: string;
    color: string;
};

type IndexedSelectedFile = {
    fullPath: string;
    fileName: string;
    kind: "ucp_wl_compare_spreadsheet" | "ucp_wire_list_spreadsheet" | "ucp_spreadsheet" | "lay_pdf";
    mtimeMs: number;
};

type RecentWindowOption = "30" | "60" | "90" | "6mo" | "year";

const WINDOW_OPTIONS: Array<{ value: RecentWindowOption; label: string }> = [
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "6mo", label: "6 months" },
    { value: "year", label: "1 year" },
];

const CREATE_FORM_DEFAULTS: CreateProjectFromSearchForm = {
    name: "",
    pdNumber: "",
    unitNumber: "",
    revision: "",
    lwcType: "",
    dueDate: "",
    planConlayDate: "",
    planConassyDate: "",
    shipDate: "",
    color: "#ffcc61",
};

const COLOR_PRESETS = [
    "#ffcc61", "#3B82F6", "#10B981", "#8B5CF6",
    "#F59E0B", "#EF4444", "#06B6D4", "#F97316",
    "#EC4899", "#6366F1", "#14B8A6", "#84CC16",
];

const MODE_OPTIONS: Array<{
    value: RecentExportSearchMode;
    label: string;
    description: string;
    icon: typeof BellRing;
}> = [
        {
            value: "project-updates",
            label: "Project Updates",
            description: "Recent activity across matching legal and brand folders",
            icon: BellRing,
        },
        {
            value: "green-changes",
            label: "Green Changes",
            description: "Only files containing Compare in the file name",
            icon: RefreshCw,
        },
        {
            value: "revision-changes",
            label: "Revision Changes",
            description: "Project-first view with recent files and refresh time",
            icon: GitBranch,
        },
        {
            value: "legal-drawings",
            label: "Legal Drawings",
            description: "Recent files from legal drawing exports",
            icon: FileSearch,
        },
    ];

function normalizeValue(value: string | null | undefined): string {
    return String(value ?? "").trim().toLowerCase();
}

function buildRecentExportFallbackFromBuildRun(
    snapshot: LegalDrawingsBuildRunSnapshot,
    projectQuery: string,
): RecentDirectoryExportPayload {
    const normalizedQuery = normalizeValue(projectQuery);
    const snapshotGeneratedAt = snapshot.completedAt ?? snapshot.startedAt ?? new Date().toISOString();
    const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];

    const legalDirectories: RecentExportDirectoryEntry[] = projects
        .filter((project) => {
            if (!normalizedQuery) {
                return true;
            }

            const pdNumber = String(project.pdNumber ?? "");
            const latestRevision = String(project.latestRevision ?? "");
            return normalizeValue(pdNumber).includes(normalizedQuery)
                || normalizeValue(latestRevision).includes(normalizedQuery);
        })
        .map((project) => {
            const pdNumber = String(project.pdNumber ?? "").trim();
            const revisions = Array.isArray(project.revisions) ? project.revisions : [];

            const files: RecentExportFileEntry[] = revisions.flatMap((revision) => {
                const lastWriteTime = revision.lastRunAt ?? snapshotGeneratedAt;
                const revisionPath = String(revision.revisionPath ?? "").trim();
                const revisionLabel = String(revision.revision ?? project.latestRevision ?? "").trim();
                const generatedRelativePaths = Array.isArray(revision.generatedRelativePaths)
                    ? revision.generatedRelativePaths
                    : [];

                if (generatedRelativePaths.length > 0) {
                    return generatedRelativePaths.map((relativePath) => ({
                        name: String(relativePath).split("/").pop() || relativePath,
                        fullPath: revisionPath
                            ? `${revisionPath}/${relativePath}`
                            : relativePath,
                        revision: revisionLabel || null,
                        relativePath,
                        lastWriteTime,
                        sizeBytes: 0,
                        sizeKb: 0,
                    }));
                }

                const revisionMetaPath = String(revision.revisionMetaPath ?? "").trim();
                if (!revisionMetaPath) {
                    return [];
                }

                return [{
                    name: revisionMetaPath.split("/").pop() || "revision.json",
                    fullPath: revisionMetaPath,
                    revision: revisionLabel || null,
                    relativePath: revisionMetaPath,
                    lastWriteTime,
                    sizeBytes: 0,
                    sizeKb: 0,
                }];
            });

            const latestRunAt = files[0]?.lastWriteTime
                ?? revisions[0]?.lastRunAt
                ?? snapshotGeneratedAt;

            return {
                directoryName: pdNumber || "Unknown Project",
                project: pdNumber || null,
                pdNumber: pdNumber || null,
                lastRefreshed: latestRunAt,
                directoryPath: String(project.projectMetaPath ?? "").replace(/\/project-meta\.json$/i, "") || `Share/Legal Drawings/${pdNumber}`,
                files,
            };
        });

    return {
        generated: true,
        isComplete: true,
        message: "Loaded from local legal drawings build snapshot.",
        generatedAt: snapshotGeneratedAt,
        window: null,
        cutoff: null,
        legalRoot: String(snapshot.legalRoot ?? ""),
        brandRoot: "",
        legalDirectories,
        brandDirectories: [],
        outputFilePath: "Share/Legal Drawings/legal-drawings-build-run.json",
    };
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return "Not available";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Not available";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(parsed);
}

function getModeMeta(mode: RecentExportSearchMode) {
    return MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0];
}

function classifyFileType(fileName: string): ProjectLegalSearchFileRow["fileType"] {
    const normalized = normalizeValue(fileName);

    if (normalized.includes("compare")) {
        return "green change";
    }

    if (/(^|[^a-z])lay($|[^a-z])/.test(normalized) || normalized.includes("layout")) {
        return "layout";
    }

    if (
        normalized.includes("wire")
        || normalized.includes("wiring")
        || normalized.includes("_wl")
        || normalized.includes("-wl")
        || normalized.includes(" fwl")
        || normalized.includes("fwl")
    ) {
        return "wire list";
    }

    return "other";
}

function isUcpCompareFile(file: ProjectLegalSearchFileRow): boolean {
    const normalized = normalizeValue(file.name);
    return normalized.includes("compare") && (normalized.includes("ucp") || normalized.includes("wl"));
}

function isUcpWireListFile(file: ProjectLegalSearchFileRow): boolean {
    const normalized = normalizeValue(file.name);
    return !isUcpCompareFile(file) && (normalized.includes("ucpwiringlist") || normalized.includes("ucp_wl") || normalized.includes("ucp wl"));
}

function isLayoutPdfFile(file: ProjectLegalSearchFileRow): boolean {
    return file.fileType === "layout" && normalizeValue(file.name).endsWith(".pdf");
}

function prioritizeProjectFiles(files: ProjectLegalSearchFileRow[]): ProjectLegalSearchFileRow[] {
    const sortedFiles = [...files].sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime));
    const usedPaths = new Set<string>();
    const prioritized: ProjectLegalSearchFileRow[] = [];

    const addFirstMatch = (predicate: (file: ProjectLegalSearchFileRow) => boolean) => {
        const match = sortedFiles.find((file) => !usedPaths.has(file.fullPath) && predicate(file));
        if (!match) {
            return;
        }

        usedPaths.add(match.fullPath);
        prioritized.push(match);
    };

    addFirstMatch(isUcpCompareFile);
    addFirstMatch(isUcpWireListFile);
    addFirstMatch(isLayoutPdfFile);

    for (const file of sortedFiles) {
        if (usedPaths.has(file.fullPath)) {
            continue;
        }

        prioritized.push(file);
    }

    return prioritized;
}

function isSpreadsheetFile(fileName: string): boolean {
    const normalized = normalizeValue(fileName);
    return normalized.endsWith(".xlsx")
        || normalized.endsWith(".xls")
        || normalized.endsWith(".xlsm")
        || normalized.endsWith(".xlsb");
}

function isUcpWireOrCompareSpreadsheet(file: ProjectLegalSearchFileRow): boolean {
    if (!isSpreadsheetFile(file.name)) {
        return false;
    }

    const normalizedName = normalizeValue(file.name);
    const hasUcpMarker = normalizedName.includes("ucp");
    const hasWireOrCompareMarker = normalizedName.includes("wire")
        || normalizedName.includes("wiring")
        || normalizedName.includes("wl")
        || normalizedName.includes("compare");
    const isWireOrCompareType = file.fileType === "wire list" || file.fileType === "green change";

    return hasUcpMarker && hasWireOrCompareMarker && isWireOrCompareType;
}

function deriveIndexedFilesForProject(summary: ProjectSummary): IndexedSelectedFile[] {
    const legalFiles = summary.files
        .filter((file) => file.source === "legal")
        .sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime));

    const workbook = legalFiles.find((file) => isUcpWireOrCompareSpreadsheet(file));

    const layout = legalFiles.find((file) => file.fileType === "layout" && normalizeValue(file.name).endsWith(".pdf"));

    const selectedFiles: IndexedSelectedFile[] = [];

    if (workbook) {
        const workbookName = normalizeValue(workbook.name);
        const kind: IndexedSelectedFile["kind"] = workbookName.includes("compare")
            ? "ucp_wl_compare_spreadsheet"
            : workbookName.includes("wire") || workbookName.includes("wl")
                ? "ucp_wire_list_spreadsheet"
                : "ucp_spreadsheet";

        selectedFiles.push({
            fullPath: workbook.fullPath,
            fileName: workbook.name,
            kind,
            mtimeMs: Date.parse(workbook.lastWriteTime) || Date.now(),
        });
    }

    if (layout) {
        selectedFiles.push({
            fullPath: layout.fullPath,
            fileName: layout.name,
            kind: "lay_pdf",
            mtimeMs: Date.parse(layout.lastWriteTime) || Date.now(),
        });
    }

    return selectedFiles;
}

function parseDateString(value: string): Date | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateToString(date: Date | undefined): string {
    if (!date) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resolveRevisionFromSelections(
    summary: ProjectSummary | null,
    workbookPath: string | null,
    layoutPath: string | null,
): string {
    if (!summary) {
        return "";
    }

    const workbook = workbookPath ? summary.files.find((file) => file.fullPath === workbookPath) : null;
    const layout = layoutPath ? summary.files.find((file) => file.fullPath === layoutPath) : null;
    return workbook?.revision ?? layout?.revision ?? "";
}

function buildIndexedFile(file: ProjectLegalSearchFileRow): IndexedSelectedFile {
    const workbookName = normalizeValue(file.name);
    const kind: IndexedSelectedFile["kind"] = file.fileType === "layout"
        ? "lay_pdf"
        : workbookName.includes("compare")
            ? "ucp_wl_compare_spreadsheet"
            : workbookName.includes("wire") || workbookName.includes("wl")
                ? "ucp_wire_list_spreadsheet"
                : "ucp_spreadsheet";

    return {
        fullPath: file.fullPath,
        fileName: file.name,
        kind,
        mtimeMs: Date.parse(file.lastWriteTime) || Date.now(),
    };
}

export function RecentExportCommandSearch({
    open,
    onOpenChange,
    placeholder = "Search projects by PD# or project name",
    config,
}: RecentExportCommandSearchProps) {
    const router = useRouter();
    const { saveProject } = useProjectContext();
    const { user } = useSession();
    const [mode, setMode] = useState<RecentExportSearchMode>(config.initialMode ?? "project-updates");
    const [selectedWindow, setSelectedWindow] = useState<RecentWindowOption>(config.defaultWindow ?? "90");
    const [query, setQuery] = useState("");
    const [data, setData] = useState<RecentDirectoryExportPayload | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [expandedProjectKeys, setExpandedProjectKeys] = useState<string[]>([]);
    const [createPanelProject, setCreatePanelProject] = useState<ProjectSummary | null>(null);
    const [selectedWorkbookPath, setSelectedWorkbookPath] = useState<string | null>(null);
    const [selectedLayoutPath, setSelectedLayoutPath] = useState<string | null>(null);
    const [createForm, setCreateForm] = useState<CreateProjectFromSearchForm>(CREATE_FORM_DEFAULTS);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const pollTimerRef = useRef<number | null>(null);
    const requestTokenRef = useRef(0);

    const projectLinkMap = useMemo(() => {
        const map = new Map<string, RecentExportSearchProjectLink>();

        for (const projectLink of config.projectLinks) {
            map.set(normalizeValue(projectLink.pdNumber), projectLink);
            map.set(normalizeValue(projectLink.name), projectLink);
        }

        return map;
    }, [config.projectLinks]);

    const fetchWithTimeout = useCallback(async (url: string, init?: RequestInit, timeoutMs = 45000) => {
        const controller = new AbortController();
        const timerId = window.setTimeout(() => {
            controller.abort(new DOMException("Request timed out.", "AbortError"));
        }, timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                cache: "no-store",
                signal: controller.signal,
            });
            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            return { response, payload };
        } finally {
            window.clearTimeout(timerId);
        }
    }, []);

    const loadSavedExport = useCallback(async (projectQuery: string, reason: "search" | "refresh" = "search") => {
        const currentToken = ++requestTokenRef.current;
        if (reason === "search") {
            setIsLoading(true);
        }
        setError(null);

        const fallbackPayload = buildRecentExportFallbackFromBuildRun(
            legalDrawingsBuildRunSnapshot as LegalDrawingsBuildRunSnapshot,
            projectQuery,
        );
        const hasFallbackData = fallbackPayload.legalDirectories.length > 0;
        if (hasFallbackData) {
            setData(fallbackPayload);
            if (reason === "search") {
                setStatusMessage(
                    projectQuery.trim()
                        ? `Showing cached snapshot results matching ${projectQuery.trim()} while checking live data.`
                        : "Showing cached legal drawings snapshot while checking live data.",
                );
            }
        }

        try {
            const searchParams = new URLSearchParams();
            if (projectQuery.trim()) {
                searchParams.set("projectQuery", projectQuery.trim());
            }

            const { response, payload } = await fetchWithTimeout(
                `/api/legal-drawings/recent-directory-export${searchParams.toString() ? `?${searchParams}` : ""}`,
                { method: "GET" },
                15000,
            );

            if (currentToken !== requestTokenRef.current) {
                return;
            }

            if (!response.ok) {
                const typedPayload = payload as { error?: string };
                throw new Error(typedPayload.error || "Failed to load recent directory export.");
            }

            setData(payload as RecentDirectoryExportPayload);
            if (reason === "search") {
                setStatusMessage(
                    projectQuery.trim()
                        ? `Showing saved results matching ${projectQuery.trim()}.`
                        : "Showing saved recent directory export.",
                );
            }
        } catch (loadError) {
            if (currentToken !== requestTokenRef.current) {
                return;
            }

            if (hasFallbackData) {
                setStatusMessage(
                    projectQuery.trim()
                        ? `Share API unavailable. Showing cached snapshot for ${projectQuery.trim()}.`
                        : "Share API unavailable. Showing cached legal drawings snapshot.",
                );
                setError(null);
            } else {
                setError(loadError instanceof Error ? loadError.message : "Failed to load recent directory export.");
            }
        } finally {
            if (currentToken === requestTokenRef.current && reason === "search") {
                setIsLoading(false);
            }
        }
    }, [fetchWithTimeout]);

    const refreshExport = useCallback(async (targetProject?: ProjectSummary | null) => {
        const resolvedProject = targetProject ?? null;
        const projectQuery = (resolvedProject?.pdNumber || resolvedProject?.project || query).trim();
        const targetDirectoryPath = resolvedProject?.directoryPath ?? null;
        setIsRefreshing(true);
        setError(null);
        setStatusMessage(
            projectQuery
                ? `Refreshing ${projectQuery} in the background and streaming matching results as they are found.`
                : "Refreshing the recent directory export in the background and streaming results as they are found.",
        );

        if (pollTimerRef.current != null) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }

        pollTimerRef.current = window.setInterval(() => {
            void loadSavedExport(projectQuery, "refresh");
        }, 1500);

        try {
            const { response, payload } = await fetchWithTimeout(
                "/api/legal-drawings/recent-directory-export",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        projectQuery: projectQuery || undefined,
                        targetDirectoryPath: targetDirectoryPath || undefined,
                        window: selectedWindow,
                        writeToFile: true,
                    }),
                },
                10 * 60 * 1000,
            );

            if (!response.ok) {
                const typedPayload = payload as { error?: string };
                throw new Error(typedPayload.error || "Failed to refresh recent directory export.");
            }

            setData(payload as RecentDirectoryExportPayload);
            setStatusMessage(
                projectQuery
                    ? `Refresh complete for ${projectQuery}.`
                    : "Recent directory export refreshed.",
            );
        } catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh recent directory export.");
        } finally {
            if (pollTimerRef.current != null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            setIsRefreshing(false);
        }
    }, [fetchWithTimeout, loadSavedExport, query, selectedWindow]);

    useEffect(() => {
        if (!open) {
            if (pollTimerRef.current != null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            return;
        }

        const timer = window.setTimeout(() => {
            void loadSavedExport(query, "search");
        }, query.trim() ? 220 : 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [loadSavedExport, open, query]);

    useEffect(() => () => {
        if (pollTimerRef.current != null) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const projectSummaries = useMemo<ProjectSummary[]>(() => {
        const summaries = new Map<string, ProjectSummary>();

        const registerDirectory = (directory: RecentExportDirectoryEntry, source: "legal" | "brand") => {
            const key = normalizeValue(directory.pdNumber || directory.project || directory.directoryName);
            const projectLink = projectLinkMap.get(normalizeValue(directory.pdNumber))
                ?? projectLinkMap.get(normalizeValue(directory.project))
                ?? projectLinkMap.get(normalizeValue(directory.directoryName));
            const existing = summaries.get(key);
            const nextFiles = directory.files.map((file) => ({
                ...file,
                source,
                fileType: classifyFileType(file.name),
            }));

            if (!existing) {
                summaries.set(key, {
                    key,
                    pdNumber: directory.pdNumber,
                    project: directory.project || directory.directoryName,
                    directoryPath: directory.directoryPath,
                    href: projectLink?.href,
                    color: projectLink?.color,
                    lastRefreshed: directory.lastRefreshed,
                    legalFiles: source === "legal" ? directory.files.length : 0,
                    brandFiles: source === "brand" ? directory.files.length : 0,
                    compareFiles: directory.files.filter((file) => normalizeValue(file.name).includes("compare")).length,
                    files: nextFiles.sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime)),
                });
                return;
            }

            existing.legalFiles += source === "legal" ? directory.files.length : 0;
            existing.brandFiles += source === "brand" ? directory.files.length : 0;
            existing.compareFiles += directory.files.filter((file) => normalizeValue(file.name).includes("compare")).length;
            if (Date.parse(directory.lastRefreshed) > Date.parse(existing.lastRefreshed)) {
                existing.lastRefreshed = directory.lastRefreshed;
            }
            existing.files = [...existing.files, ...nextFiles]
                .sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime))
            if (!existing.href && projectLink?.href) {
                existing.href = projectLink.href;
            }
            if (!existing.color && projectLink?.color) {
                existing.color = projectLink.color;
            }
            if (!existing.directoryPath && directory.directoryPath) {
                existing.directoryPath = directory.directoryPath;
            }
        };

        for (const directory of data?.legalDirectories ?? []) {
            registerDirectory(directory, "legal");
        }

        for (const directory of data?.brandDirectories ?? []) {
            registerDirectory(directory, "brand");
        }

        return Array.from(summaries.values()).sort(
            (left, right) => Date.parse(right.lastRefreshed) - Date.parse(left.lastRefreshed),
        );
    }, [data?.brandDirectories, data?.legalDirectories, projectLinkMap]);

    const visibleProjectSummaries = useMemo(() => {
        const mapSummaryFiles = (filterFn: (file: ProjectLegalSearchFileRow) => boolean) => {
            return projectSummaries
                .map((summary) => ({
                    ...summary,
                    files: summary.files.filter(filterFn),
                    compareFiles: summary.files.filter((file) => normalizeValue(file.name).includes("compare") && filterFn(file)).length,
                }))
                .filter((summary) => summary.files.length > 0);
        };

        if (mode === "green-changes") {
            return mapSummaryFiles((file) => file.fileType === "green change");
        }

        if (mode === "legal-drawings") {
            return mapSummaryFiles((file) => file.source === "legal");
        }

        if (mode === "revision-changes") {
            return mapSummaryFiles((file) => file.source === "legal");
        }

        return projectSummaries;
    }, [mode, projectSummaries]);

    const modeMeta = getModeMeta(mode);
    const ModeIcon = modeMeta.icon;
    const resultCount = visibleProjectSummaries.length;

    const selectedProject = useMemo(() => {
        const normalizedQuery = normalizeValue(query);
        if (!normalizedQuery) {
            return null;
        }

        return projectSummaries.find((summary) => {
            return [summary.pdNumber, summary.project, summary.key]
                .filter((value): value is string => Boolean(value))
                .some((value) => normalizeValue(value).includes(normalizedQuery));
        }) ?? null;
    }, [projectSummaries, query]);

    const canSendTargetRefresh = Boolean(selectedProject) && isInputFocused;

    const toggleExpandedProject = useCallback((projectKey: string) => {
        setExpandedProjectKeys((current) => (
            current.includes(projectKey)
                ? current.filter((value) => value !== projectKey)
                : [...current, projectKey]
        ));
    }, []);

    const workbookSourceOptions = useMemo(() => {
        const deduped = new Map<string, ProjectLegalSearchFileRow>();
        for (const file of (createPanelProject?.files ?? [])) {
            if (!deduped.has(file.fullPath)) {
                deduped.set(file.fullPath, file);
            }
        }

        return Array.from(deduped.values())
            .filter((file) => file.source === "legal" && isUcpWireOrCompareSpreadsheet(file))
            .sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime));
    }, [createPanelProject]);

    const layoutSourceOptions = useMemo(() => {
        const deduped = new Map<string, ProjectLegalSearchFileRow>();
        for (const file of (createPanelProject?.files ?? [])) {
            if (!deduped.has(file.fullPath)) {
                deduped.set(file.fullPath, file);
            }
        }

        return Array.from(deduped.values())
            .filter((file) => file.source === "legal" && file.fileType === "layout" && normalizeValue(file.name).endsWith(".pdf"))
            .sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime));
    }, [createPanelProject]);

    const selectedWorkbookFile = useMemo(() => {
        if (!selectedWorkbookPath) {
            return null;
        }
        return workbookSourceOptions.find((file) => file.fullPath === selectedWorkbookPath) ?? null;
    }, [selectedWorkbookPath, workbookSourceOptions]);

    const selectedLayoutFile = useMemo(() => {
        if (!selectedLayoutPath) {
            return null;
        }
        return layoutSourceOptions.find((file) => file.fullPath === selectedLayoutPath) ?? null;
    }, [selectedLayoutPath, layoutSourceOptions]);

    const openCreatePanel = useCallback((summary: ProjectSummary) => {
        const preferredSelections = deriveIndexedFilesForProject(summary);
        const preferredWorkbookPath = preferredSelections.find((file) => file.kind !== "lay_pdf")?.fullPath ?? null;
        const preferredLayoutPath = preferredSelections.find((file) => file.kind === "lay_pdf")?.fullPath ?? null;
        const autoRevision = resolveRevisionFromSelections(summary, preferredWorkbookPath, preferredLayoutPath);

        setCreatePanelProject(summary);
        setSelectedWorkbookPath(preferredWorkbookPath);
        setSelectedLayoutPath(preferredLayoutPath);
        setCreateError(null);
        setCreateForm({
            ...CREATE_FORM_DEFAULTS,
            name: summary.project,
            pdNumber: summary.pdNumber ?? "",
            revision: autoRevision,
            color: summary.color ?? CREATE_FORM_DEFAULTS.color,
        });
    }, []);

    const closeCreatePanel = useCallback(() => {
        setCreatePanelProject(null);
        setSelectedWorkbookPath(null);
        setSelectedLayoutPath(null);
        setCreateError(null);
        setCreateForm(CREATE_FORM_DEFAULTS);
    }, []);

    const updateCreateField = useCallback(<K extends keyof CreateProjectFromSearchForm>(
        key: K,
        value: CreateProjectFromSearchForm[K],
    ) => {
        setCreateForm((previous) => ({ ...previous, [key]: value }));
    }, []);

    const handleCreateFromRecentExport = useCallback(async () => {
        if (!createPanelProject) {
            return;
        }

        if (!createForm.name.trim() || !createForm.pdNumber.trim()) {
            setCreateError("Project name and PD Number are required.");
            return;
        }

        const selectedFiles: IndexedSelectedFile[] = [];
        const workbookFile = selectedWorkbookPath
            ? createPanelProject.files.find((file) => file.fullPath === selectedWorkbookPath)
            : null;
        const layoutFile = selectedLayoutPath
            ? createPanelProject.files.find((file) => file.fullPath === selectedLayoutPath)
            : null;

        if (workbookFile) {
            selectedFiles.push(buildIndexedFile(workbookFile));
        }
        if (layoutFile) {
            selectedFiles.push(buildIndexedFile(layoutFile));
        }

        if (selectedFiles.length === 0) {
            setCreateError("No legal UCP workbook or layout PDF could be resolved for this project.");
            return;
        }

        const requestedProjectName = createForm.name.trim();
        setIsCreatingProject(true);
        setCreateError(null);

        closeCreatePanel();
        onOpenChange(false);
        window.setTimeout(() => {
            notifyToast({
                title: "Project creation started",
                description: `Creating ${requestedProjectName}. This may take a moment. You will be notified once it is ready.`,
            });
        }, 0);

        try {
            const response = await fetch("/api/runtime/legal-drawings-index/instantiate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-badge-number": user?.badge ?? "",
                    "x-shift": user?.currentShift ?? "1st",
                },
                body: JSON.stringify({
                    pdNumber: createForm.pdNumber.trim(),
                    name: createForm.name.trim(),
                    revision: createForm.revision.trim() || undefined,
                    unitNumber: createForm.unitNumber.trim() || undefined,
                    lwcType: createForm.lwcType || undefined,
                    dueDate: createForm.dueDate || undefined,
                    planConlayDate: createForm.planConlayDate || undefined,
                    planConassyDate: createForm.planConassyDate || undefined,
                    shipDate: createForm.shipDate || undefined,
                    color: createForm.color,
                    selectedFiles,
                }),
            });

            const payload = await response.json().catch(() => ({})) as {
                error?: string;
                manifest?: ProjectManifest;
            };

            if (!response.ok || !payload.manifest) {
                throw new Error(payload.error || "Failed to create project from legal source files.");
            }

            saveProject(payload.manifest);
            setStatusMessage(`Created project ${payload.manifest.name} from recent legal export files.`);
            notifyToast({
                title: "Project ready",
                description: `${payload.manifest.name} was created from recent legal export files.`,
            });
            router.refresh();
        } catch (creationError) {
            const message = creationError instanceof Error ? creationError.message : "Failed to create project.";
            notifyToast({
                variant: "destructive",
                title: "Project creation failed",
                description: message,
            });
        } finally {
            setIsCreatingProject(false);
        }
    }, [closeCreatePanel, createForm, createPanelProject, onOpenChange, router, saveProject, selectedLayoutPath, selectedWorkbookPath, user?.badge, user?.currentShift]);

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Project Global Command Search"
            description="Search projects and run targeted refresh updates"
            className="w-[min(94vw,78rem)] max-w-[78rem] p-0 sm:max-w-[78rem] bg-secondary rounded-4xl border-0 shadow-none"
        >
            <div className="flex h-full max-h-[86vh] min-h-[34rem] flex-col overflow-hidden rounded-[28px]  bg-background">
                <div className="border-b border-border px-4 py-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[28px] border border-border bg-card px-3 py-2 shadow-sm">
                            <Search className="h-5 w-5 text-muted-foreground" />

                            {selectedProject && isInputFocused ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-xs font-semibold text-amber-950">
                                    <span className="opacity-80">#</span>
                                    <span>{selectedProject.pdNumber ?? selectedProject.project}</span>
                                </span>
                            ) : null}

                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={() => setIsInputFocused(false)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && selectedProject) {
                                        event.preventDefault();
                                        void refreshExport(selectedProject);
                                    }
                                }}
                                placeholder={placeholder}
                                className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                            />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-10 rounded-2xl border-border bg-muted/50 px-0">
                                        <span className="flex h-full items-center px-3 text-muted-foreground">
                                            <SlidersHorizontal className="h-4 w-4" />
                                        </span>
                                        <span className="h-6 w-px bg-border" />
                                        <span className="flex h-full items-center px-3 text-muted-foreground">
                                            <ChevronDown className="h-4 w-4" />
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72 rounded-xl">
                                    {MODE_OPTIONS.map((option) => {
                                        const OptionIcon = option.icon;
                                        const isActive = option.value === mode;

                                        return (
                                            <DropdownMenuItem
                                                key={option.value}
                                                className="flex items-start gap-3 rounded-lg py-2.5"
                                                onClick={() => setMode(option.value)}
                                            >
                                                <OptionIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                                </div>
                                                <span className={cn("mt-0.5 h-4 w-4 rounded-full border", isActive ? "border-foreground bg-foreground" : "border-muted-foreground/40")} />
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>

                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">

                            {statusMessage ? <p className="text-sm text-foreground">{statusMessage}</p> : null}
                            {isRefreshing ? (
                                <p className="text-sm text-sky-700">
                                    Refresh is running in the background. Results update progressively and you will be notified when it finishes.
                                </p>
                            ) : null}
                            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
                            {data?.progress ? (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge size="sm" variant="dot" color={data.progress.phase === "complete" ? "green" : "blue"}>
                                        {data.progress.phase === "complete" ? "Complete" : `Scanning ${data.progress.phase}`}
                                    </Badge>
                                    <span>
                                        Legal {data.progress.legalDirectoriesMatched}/{data.progress.legalDirectoriesScanned}
                                    </span>
                                    <span>
                                        Brand {data.progress.brandDirectoriesMatched}/{data.progress.brandDirectoriesScanned}
                                    </span>
                                </div>
                            ) : null}

                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                {modeMeta.label}
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                {WINDOW_OPTIONS.find((option) => option.value === selectedWindow)?.label ?? "90 days"}
                            </Badge>
                            {typeof resultCount === "number" ? (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                    {resultCount} result{resultCount === 1 ? "" : "s"}
                                </Badge>
                            ) : null}
                            {data?.generatedAt ? <span>Saved {formatDateTime(data.generatedAt)}</span> : null}

                            <Select value={selectedWindow} onValueChange={(value) => setSelectedWindow(value as RecentWindowOption)}>
                                <SelectTrigger className="
                             min-h-10 w-[118px] rounded-2xl border-border bg-muted/40 text-xs">
                                    <SelectValue placeholder="Window" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WINDOW_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                type="button"
                                className="h-10 rounded-2xl bg-sky-600 px-3 text-white hover:bg-sky-500"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void refreshExport(canSendTargetRefresh ? selectedProject : null)}
                                disabled={isRefreshing}
                                aria-label={canSendTargetRefresh ? "Refresh selected project export" : "Refresh recent directory export"}
                            >
                                {isRefreshing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                                Refresh
                            </Button>
                        </div>

                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                    <div
                        className={cn(
                            "flex h-full w-[200%] transition-transform duration-300 ease-out",
                            createPanelProject ? "-translate-x-1/2" : "translate-x-0",
                        )}
                    >
                        <div className="min-h-0 w-1/2 overflow-y-auto px-4 py-4">
                            {isLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 rounded-2xl" />
                                    <Skeleton className="h-20 rounded-2xl" />
                                    <Skeleton className="h-20 rounded-2xl" />
                                </div>
                            ) : null}

                            {!isLoading && visibleProjectSummaries.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleProjectSummaries.slice(0, 18).map((summary) => (
                                        <ProjectLegalSearchCard
                                            key={summary.key}
                                            summary={summary}
                                            query={query}
                                            files={(expandedProjectKeys.includes(summary.key)
                                                ? (mode === "project-updates" ? prioritizeProjectFiles(summary.files) : [...summary.files].sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime)))
                                                : (mode === "project-updates" ? prioritizeProjectFiles(summary.files) : [...summary.files].sort((left, right) => Date.parse(right.lastWriteTime) - Date.parse(left.lastWriteTime))).slice(0, 2)
                                            )}
                                            isExpanded={expandedProjectKeys.includes(summary.key)}
                                            selectedFilePath={selectedFilePath}
                                            onSelectFile={setSelectedFilePath}
                                            onToggleExpand={toggleExpandedProject}
                                            onOpenProject={(href) => {
                                                router.push(href);
                                                onOpenChange(false);
                                            }}
                                            onCreateProject={(selectedSummary) => openCreatePanel(selectedSummary as ProjectSummary)}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {!isLoading && visibleProjectSummaries.length === 0 ? (
                                <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
                                    <ModeIcon className="h-8 w-8 text-muted-foreground" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">No matching results</p>
                                        <p className="text-xs text-muted-foreground">
                                            Search by PD# or project name, or press the blue arrow to refresh the selected project directly from Share.
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="min-h-0 w-1/2 overflow-y-auto border-l border-border/70 px-4 py-4">
                            <div className="rounded-2xl border border-border bg-card p-4">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Create Project Instance</p>
                                        <p className="text-xs text-muted-foreground">
                                            Create from latest legal UCP and layout files for {createPanelProject?.project ?? "selected project"}.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={closeCreatePanel}
                                    >
                                        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                                        Back
                                    </Button>
                                </div>

                                <div className="grid gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-medium">Project Name</Label>
                                        <Input
                                            value={createForm.name}
                                            onChange={(event) => updateCreateField("name", event.target.value)}
                                            placeholder="Project name"
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">PD Number</Label>
                                            <Input
                                                value={createForm.pdNumber}
                                                onChange={(event) => updateCreateField("pdNumber", event.target.value.toUpperCase().slice(0, 5))}
                                                className="h-9 font-mono"
                                                maxLength={5}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">Unit</Label>
                                            <Input
                                                value={createForm.unitNumber}
                                                onChange={(event) => updateCreateField("unitNumber", event.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">Revision</Label>
                                            <Input
                                                value={createForm.revision}
                                                onChange={(event) => updateCreateField("revision", event.target.value)}
                                                className="h-9 font-mono"
                                                placeholder="B.2"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">UCP / Wire List</Label>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="h-auto min-h-[3.25rem] w-full justify-between px-3 py-2"
                                                    >
                                                        {selectedWorkbookFile ? (
                                                            <div className="flex min-w-0 flex-1 items-start gap-2">
                                                                <img src="/icons/excel.svg" alt="Excel" className="mt-0.5 h-4 w-4 shrink-0" />
                                                                <div className="min-w-0 text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate text-xs font-medium leading-4">{selectedWorkbookFile.name}</p>
                                                                        {selectedWorkbookPath === workbookSourceOptions[0]?.fullPath ? (
                                                                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">Latest</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        Last updated {formatDateTime(selectedWorkbookFile.lastWriteTime)}{selectedWorkbookFile.revision ? ` • ${selectedWorkbookFile.revision}` : ""}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Select workbook</span>
                                                        )}
                                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="start"
                                                    className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                                                >
                                                    {workbookSourceOptions.map((file, index) => (
                                                        <DropdownMenuItem
                                                            key={file.fullPath}
                                                            className="items-start rounded-md px-2.5 py-2.5"
                                                            onSelect={() => {
                                                                const resolvedPath = file.fullPath;
                                                                setSelectedWorkbookPath(resolvedPath);
                                                                const autoRevision = resolveRevisionFromSelections(createPanelProject, resolvedPath, selectedLayoutPath);
                                                                if (autoRevision) {
                                                                    updateCreateField("revision", autoRevision);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex w-full items-start gap-2">
                                                                <img src="/icons/excel.svg" alt="Excel" className="mt-0.5 h-4 w-4 shrink-0" />
                                                                <div className="min-w-0 flex-1 text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate text-xs font-medium leading-4">{file.name}</p>
                                                                        {index === 0 ? (
                                                                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">Latest</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        Last updated {formatDateTime(file.lastWriteTime)}{file.revision ? ` • ${file.revision}` : ""}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-medium">Layout</Label>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="h-auto min-h-[3.25rem] w-full justify-between px-3 py-2"
                                                    >
                                                        {selectedLayoutFile ? (
                                                            <div className="flex min-w-0 flex-1 items-start gap-2">
                                                                <img src="/icons/pdf.svg" alt="PDF" className="mt-0.5 h-4 w-4 shrink-0" />
                                                                <div className="min-w-0 text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate text-xs font-medium leading-4">{selectedLayoutFile.name}</p>
                                                                        {selectedLayoutPath === layoutSourceOptions[0]?.fullPath ? (
                                                                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">Latest</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        Last updated {formatDateTime(selectedLayoutFile.lastWriteTime)}{selectedLayoutFile.revision ? ` • ${selectedLayoutFile.revision}` : ""}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Select layout PDF</span>
                                                        )}
                                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="start"
                                                    className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                                                >
                                                    {layoutSourceOptions.map((file, index) => (
                                                        <DropdownMenuItem
                                                            key={file.fullPath}
                                                            className="items-start rounded-md px-2.5 py-2.5"
                                                            onSelect={() => {
                                                                const resolvedPath = file.fullPath;
                                                                setSelectedLayoutPath(resolvedPath);
                                                                const autoRevision = resolveRevisionFromSelections(createPanelProject, selectedWorkbookPath, resolvedPath);
                                                                if (autoRevision) {
                                                                    updateCreateField("revision", autoRevision);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex w-full items-start gap-2">
                                                                <img src="/icons/pdf.svg" alt="PDF" className="mt-0.5 h-4 w-4 shrink-0" />
                                                                <div className="min-w-0 flex-1 text-left">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate text-xs font-medium leading-4">{file.name}</p>
                                                                        {index === 0 ? (
                                                                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">Latest</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        Last updated {formatDateTime(file.lastWriteTime)}{file.revision ? ` • ${file.revision}` : ""}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-medium">LWC Type</Label>
                                        <Select
                                            value={createForm.lwcType}
                                            onValueChange={(value) => updateCreateField("lwcType", value as LwcType)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select LWC type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.values(LWC_TYPE_REGISTRY).map((lwc) => (
                                                    <SelectItem key={lwc.id} value={lwc.id}>
                                                        {lwc.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <DateField
                                            mode="create"
                                            label="Due Date"
                                            value={parseDateString(createForm.dueDate)}
                                            onChange={(date) => updateCreateField("dueDate", formatDateToString(date))}
                                        />
                                        <DateField
                                            mode="create"
                                            label="Plan ConLay"
                                            value={parseDateString(createForm.planConlayDate)}
                                            onChange={(date) => updateCreateField("planConlayDate", formatDateToString(date))}
                                        />
                                        <DateField
                                            mode="create"
                                            label="Plan ConAssy"
                                            value={parseDateString(createForm.planConassyDate)}
                                            onChange={(date) => updateCreateField("planConassyDate", formatDateToString(date))}
                                        />
                                        <DateField
                                            mode="create"
                                            label="Ship Date"
                                            value={parseDateString(createForm.shipDate)}
                                            onChange={(date) => updateCreateField("shipDate", formatDateToString(date))}
                                        />
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-medium">Project Color</Label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {COLOR_PRESETS.map((color) => (
                                                <Button
                                                    key={color}
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className={cn(
                                                        "h-7 w-7 rounded-full border-2 p-0",
                                                        createForm.color === color ? "border-foreground" : "border-transparent",
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => updateCreateField("color", color)}
                                                    title={`Select ${color}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {createError ? (
                                        <p className="rounded-lg border border-rose-300/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                                            {createError}
                                        </p>
                                    ) : null}

                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={closeCreatePanel} disabled={isCreatingProject}>Cancel</Button>
                                        <Button onClick={() => void handleCreateFromRecentExport()} disabled={isCreatingProject}>
                                            {isCreatingProject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                                            {isCreatingProject ? "Creating..." : "Create Project"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CommandDialog>
    );
}
