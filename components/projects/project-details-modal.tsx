"use client";

/**
 * Project Details Modal
 *
 * Full-viewport modal that opens when a project card is clicked.
 * Contains two views navigable via an internal slide transition:
 *
 *  1. **Kanban view** — ProjectLifeCycleColumns showing assignments by stage
 *  2. **Mapping view** — Inline SWS mapping editor (extracted from
 *     ProjectAssignmentMappingModal) so it renders inside the same modal
 *     instead of spawning a second dialog.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
    Layers,
    FileSpreadsheet,
    Calendar,
    CalendarRange,
    ExternalLink,
    ArrowLeft,
    Upload,
    Loader2,
    CheckCircle2,
    Clock,
    Columns3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ProjectLifeCycleColumns, MilestoneDates, toDate, BUILD_UP_OR_LATER, TEST_OR_LATER } from "./project-lifecycle-columns";
import { ProjectTimelineView } from "./project-timeline-view";
import { ProjectAssignmentMappingModal, type MappedAssignment } from "./project-assignment-mapping-modal";
import type { ProjectManifest } from "@/types/project-manifest";
import { LWC_TYPE_REGISTRY } from "@/lib/workbook/types";
import type { LayoutPagePreview } from "@/lib/layout-matching/types";
import { renderPdfPagesToImages } from "@/lib/layout-matching/render-pdf-pages-to-images";
import { saveLayoutPages, loadLayoutPages } from "@/lib/storage/layout-storage";
import type { AssignmentStageId } from "@/types/d380-assignment-stages";

// ============================================================================
// Auto-Match Helpers
// ============================================================================

/** Normalize a string for fuzzy title matching */
function normalizeTitle(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") // strip all non-alphanumeric
        .trim();
}

/**
 * Given layout pages and assignment mappings, auto-match by comparing
 * each page's drawing title to each assignment's sheet name.
 * Only performs 1:1 matches — if multiple sheets match one page or
 * multiple pages match one sheet, the match is skipped.
 */
function autoMatchLayoutPages(
    pages: LayoutPagePreview[],
    currentAssignments: MappedAssignment[],
): MappedAssignment[] {
    // Build lookup: normalized title → page(s)
    const titleToPages = new Map<string, LayoutPagePreview[]>();
    for (const page of pages) {
        const title = page.title || page.normalizedTitle;
        if (!title) continue;
        const norm = normalizeTitle(title);
        if (!norm) continue;
        const arr = titleToPages.get(norm) || [];
        arr.push(page);
        titleToPages.set(norm, arr);
    }

    // Match each assignment to a layout page
    const usedPageNumbers = new Set<number>();
    const result = currentAssignments.map((a) => {
        // Skip if already matched
        if (a.matchedLayoutPage) return a;

        const normSheet = normalizeTitle(a.sheetName);
        if (!normSheet) return a;

        const candidates = titleToPages.get(normSheet);
        // Only auto-match if exactly one page matches this title
        if (!candidates || candidates.length !== 1) return a;

        const page = candidates[0];
        // Only use each page once
        if (usedPageNumbers.has(page.pageNumber)) return a;

        // Check reverse uniqueness: verify no other sheet also matches this page
        const sheetsMatchingThisPage = currentAssignments.filter(
            (s) => !s.matchedLayoutPage && normalizeTitle(s.sheetName) === normSheet,
        );
        if (sheetsMatchingThisPage.length !== 1) return a;

        usedPageNumbers.add(page.pageNumber);
        return {
            ...a,
            matchedLayoutPage: page.pageNumber,
            matchedLayoutTitle: a.sheetName,
        };
    });

    return result;
}

// ============================================================================
// Types
// ============================================================================

export interface ProjectDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: ProjectManifest;
    assignments: MappedAssignment[];
    onSaveAssignmentMappings?: (mappings: MappedAssignment[]) => void;
    /** Patch a single assignment's stage/status */
    onPatchAssignment?: (slug: string, update: { selectedStage?: string; selectedStatus?: string }) => void;
    onAssignmentClick?: (assignment: MappedAssignment) => void;
    /** Navigate to full project page */
    onOpenFullProject?: () => void;
}

type ModalView = "kanban" | "timeline" | "mapping";

// ============================================================================
// Component
// ============================================================================

export function ProjectDetailsModal({
    open,
    onOpenChange,
    project,
    assignments,
    onSaveAssignmentMappings,
    onPatchAssignment,
    onAssignmentClick,
    onOpenFullProject,
}: ProjectDetailsModalProps) {
    const [view, setView] = useState<ModalView>("kanban");
    const [layoutPages, setLayoutPages] = useState<LayoutPagePreview[]>([]);
    const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
    const [autoMatchCount, setAutoMatchCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load existing layout pages from storage when modal opens
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        loadLayoutPages(project.id).then((pages) => {
            if (!cancelled && pages.length > 0) {
                setLayoutPages(pages);
            }
        }).catch(() => { });
        return () => { cancelled = true; };
    }, [open, project.id]);

    const color = project.color || "#ffcc61";
    const operationalCount = project.sheets.filter((s) => s.kind === "operational").length;
    const lwcConfig = project.lwcType ? LWC_TYPE_REGISTRY[project.lwcType] : null;

    const hasAssignments = assignments.length > 0;

    // Milestone date computation
    const conlayDate = toDate(project.planConlayDate);
    const conassyDate = toDate(project.planConassyDate);
    const dueDateParsed = toDate(project.dueDate);
    const totalAssignments = assignments.length;

    const conlayMet = useMemo(() => {
        if (!conlayDate || totalAssignments === 0) return false;
        const now = new Date();
        if (now > conlayDate) return false;
        return assignments.some((a) => BUILD_UP_OR_LATER.includes(a.selectedStage as AssignmentStageId));
    }, [assignments, conlayDate, totalAssignments]);

    const conassyMet = useMemo(() => {
        if (!conassyDate || totalAssignments === 0) return false;
        const now = new Date();
        if (now > conassyDate) return false;
        return assignments.every((a) => TEST_OR_LATER.includes(a.selectedStage as AssignmentStageId));
    }, [assignments, conassyDate, totalAssignments]);

    const completeMet = useMemo(() => {
        if (!dueDateParsed || totalAssignments === 0) return false;
        const now = new Date();
        if (now > dueDateParsed) return false;
        return assignments.every(
            (a) => a.selectedStatus === "COMPLETE" || a.selectedStage === "FINISHED_BIQ",
        );
    }, [assignments, dueDateParsed, totalAssignments]);

    const hasDates = !!conlayDate || !!conassyDate || !!dueDateParsed;

    // Format revision: replace underscores with spaces
    const displayRevision = project.revision?.replace(/_/g, " ");

    const handleSaveMappings = useCallback(
        (mappings: MappedAssignment[]) => {
            onSaveAssignmentMappings?.(mappings);
            setView("kanban");
        },
        [onSaveAssignmentMappings],
    );

    const handleStageChange = useCallback(
        (slug: string, newStage: AssignmentStageId) => {
            onPatchAssignment?.(slug, { selectedStage: newStage });
        },
        [onPatchAssignment],
    );

    // Reset to kanban when dialog closes
    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen) {
                setView("kanban");
                setUploadState("idle");
                setAutoMatchCount(0);
            }
            onOpenChange(nextOpen);
        },
        [onOpenChange],
    );

    // Handle layout PDF upload
    const handleLayoutUpload = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Reset input so same file can be re-selected
            e.target.value = "";

            if (!file.name.toLowerCase().endsWith(".pdf")) return;

            setUploadState("uploading");
            try {
                const pages = await renderPdfPagesToImages(file, { scale: 1.5 });
                setLayoutPages(pages);

                // Persist layout pages
                saveLayoutPages(pages, project.id, {
                    pdNumber: project.pdNumber,
                    projectName: project.name,
                }).catch(() => { });

                // Auto-match layout pages to assignments
                if (assignments.length > 0 && pages.length > 0) {
                    const matched = autoMatchLayoutPages(pages, assignments);
                    const matchCount = matched.filter(
                        (m, i) => m.matchedLayoutPage && !assignments[i].matchedLayoutPage,
                    ).length;
                    setAutoMatchCount(matchCount);

                    if (matchCount > 0) {
                        onSaveAssignmentMappings?.(matched);
                    }
                }

                setUploadState("done");
                // Reset "done" badge after a few seconds
                setTimeout(() => setUploadState("idle"), 4000);
            } catch (err) {
                console.error("[d380] Layout PDF upload failed:", err);
                setUploadState("idle");
            }
        },
        [project, assignments, onSaveAssignmentMappings],
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="!max-w-[95vw] w-full max-h-[90vh] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:!max-w-[95vw]"
                showCloseButton={view === "kanban" || view === "timeline"}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {(view === "kanban" || view === "timeline") ? (
                        <motion.div
                            key="main-view"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="flex flex-col gap-2 px-6 pt-5 pb-4 border-b shrink-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div
                                            className="shrink-0 rounded-lg p-2.5 shadow-sm mt-0.5"
                                            style={{
                                                backgroundColor: `${color}15`,
                                                border: `1px solid ${color}30`,
                                            }}
                                        >
                                            <FileSpreadsheet className="h-5 w-5" style={{ color }} strokeWidth={2} />
                                        </div>

                                        <div className="min-w-0">
                                            <DialogTitle className="text-lg font-semibold truncate">
                                                {project.name}
                                            </DialogTitle>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                                                {project.pdNumber && (
                                                    <span className="font-mono text-xs">{project.pdNumber}</span>
                                                )}
                                                {project.unitNumber && (
                                                    <>
                                                        <span className="text-muted-foreground/30">·</span>
                                                        <span className="text-xs">Unit {project.unitNumber}</span>
                                                    </>
                                                )}
                                                {displayRevision && (
                                                    <>
                                                        <span className="text-muted-foreground/30">·</span>
                                                        <span className="text-xs">Rev {displayRevision}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="hidden sm:flex items-center gap-2 mr-2">
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                {operationalCount} sheet{operationalCount !== 1 ? "s" : ""}
                                            </Badge>
                                            {lwcConfig && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] h-5 px-1.5 font-medium"
                                                    style={{
                                                        borderColor: `${lwcConfig.dotColor}40`,
                                                        color: lwcConfig.dotColor,
                                                        backgroundColor: `${lwcConfig.dotColor}08`,
                                                    }}
                                                >
                                                    {lwcConfig.shortLabel}
                                                </Badge>
                                            )}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 h-8"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadState === "uploading"}
                                        >
                                            {uploadState === "uploading" ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : uploadState === "done" ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            ) : (
                                                <Upload className="h-3.5 w-3.5" />
                                            )}
                                            <span className="hidden sm:inline">
                                                {uploadState === "uploading"
                                                    ? "Processing..."
                                                    : uploadState === "done"
                                                        ? `Uploaded${autoMatchCount > 0 ? ` (${autoMatchCount} matched)` : ""}`
                                                        : layoutPages.length > 0
                                                            ? `${layoutPages.length} Layouts`
                                                            : "Upload Layout"}
                                            </span>
                                        </Button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            onChange={handleLayoutUpload}
                                        />

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 h-8"
                                            onClick={() => setView("mapping")}
                                        >
                                            <Layers className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline">
                                                {hasAssignments ? "Edit Mappings" : "Map Assignments"}
                                            </span>
                                        </Button>

                                        {onOpenFullProject && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1.5 h-8"
                                                onClick={onOpenFullProject}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">Full View</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* View switcher — Kanban / Timeline tabs */}
                                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
                                    <button
                                        type="button"
                                        onClick={() => setView("kanban")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                            view === "kanban"
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        <Columns3 className="h-3.5 w-3.5" />
                                        Kanban
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setView("timeline")}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                            view === "timeline"
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        <CalendarRange className="h-3.5 w-3.5" />
                                        Timeline
                                    </button>
                                    <div className="flex-1" />
                                </div>

                                {/* Milestone dates strip */}
                                {hasDates && (
                                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                        <MilestoneDates
                                            planConlayDate={conlayDate}
                                            planConassyDate={conassyDate}
                                            dueDate={dueDateParsed}
                                            conlayMet={conlayMet}
                                            conassyMet={conassyMet}
                                            completeMet={completeMet}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Content area — Kanban or Timeline */}
                            <div className="flex-1 overflow-hidden">
                                {view === "timeline" ? (
                                    <ProjectTimelineView
                                        project={project}
                                        assignments={assignments}
                                        onAssignmentClick={onAssignmentClick}
                                        onPatchAssignment={onPatchAssignment}
                                    />
                                ) : !hasAssignments ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-4">
                                        <div className="rounded-full bg-muted/60 p-4">
                                            <Layers className="h-8 w-8 text-muted-foreground/60" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold">No assignments mapped</h3>
                                            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
                                                Run SWS mapping to classify sheets and assign them to lifecycle stages.
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={() => setView("mapping")}
                                        >
                                            <Layers className="h-4 w-4" />
                                            Map Assignments
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="h-full px-0 py-0">
                                        <ProjectLifeCycleColumns
                                            assignments={assignments}
                                            projectId={project.id}
                                            onAssignmentClick={onAssignmentClick}
                                            onStageChange={onPatchAssignment ? handleStageChange : undefined}
                                            planConlayDate={project.planConlayDate}
                                            planConassyDate={project.planConassyDate}
                                            dueDate={project.dueDate}
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="mapping"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full"
                        >
                            {/* Mapping view — header with back button */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 h-8"
                                    onClick={() => setView("kanban")}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <div className="h-5 w-px bg-border" />
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold">SWS Mapping</span>
                                    <span className="text-xs text-muted-foreground">— {project.name}</span>
                                </div>
                            </div>

                            {/* Embedded mapping content (rendered inline, not as a separate modal) */}
                            <div className="flex-1 overflow-hidden">
                                <ProjectAssignmentMappingModal
                                    isOpen
                                    onClose={() => setView("kanban")}
                                    onSave={handleSaveMappings}
                                    sheets={Object.values(project.assignments ?? {})}
                                    projectName={project.name}
                                    existingMappings={assignments}
                                    layoutPages={layoutPages}
                                    __embedded
                                    onUploadLayout={() => fileInputRef.current?.click()}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
