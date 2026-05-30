"use client";

import Image from "next/image";
import { Plus } from "lucide-react";

import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components/project-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProjectLegalSearchFileType = "layout" | "wire list" | "green change" | "other";

export type ProjectLegalSearchFileRow = {
    name: string;
    fullPath: string;
    revision: string | null;
    relativePath: string;
    lastWriteTime: string;
    sizeBytes: number;
    sizeKb: number;
    source: "legal" | "brand";
    fileType: ProjectLegalSearchFileType;
};

export type ProjectLegalSearchSummary = {
    key: string;
    pdNumber: string | null;
    project: string;
    href?: string;
    color?: string | null;
    lastRefreshed: string;
    legalFiles: number;
    brandFiles: number;
    compareFiles: number;
    files: ProjectLegalSearchFileRow[];
};

type ProjectLegalSearchCardProps = {
    summary: ProjectLegalSearchSummary;
    query: string;
    files: ProjectLegalSearchFileRow[];
    isExpanded: boolean;
    selectedFilePath: string | null;
    onSelectFile: (fullPath: string) => void;
    onToggleExpand: (projectKey: string) => void;
    onOpenProject: (href: string) => void;
    onCreateProject?: (summary: ProjectLegalSearchSummary) => void;
};

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

function renderHighlightedText(value: string, query: string): React.ReactNode {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return value;
    }

    const normalizedValue = value.toLowerCase();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const segments: React.ReactNode[] = [];
    let startIndex = 0;
    let matchIndex = normalizedValue.indexOf(normalizedQuery);

    while (matchIndex >= 0) {
        if (matchIndex > startIndex) {
            segments.push(value.slice(startIndex, matchIndex));
        }

        const endIndex = matchIndex + normalizedQuery.length;
        segments.push(
            <mark
                key={`${value}-${matchIndex}`}
                className="rounded bg-sky-500/16 px-0.5 text-foreground"
            >
                {value.slice(matchIndex, endIndex)}
            </mark>,
        );

        startIndex = endIndex;
        matchIndex = normalizedValue.indexOf(normalizedQuery, startIndex);
    }

    if (startIndex < value.length) {
        segments.push(value.slice(startIndex));
    }

    return segments;
}

function resolveFileIcon(fileName: string): string | null {
    const normalized = fileName.toLowerCase();
    if (normalized.endsWith(".xls") || normalized.endsWith(".xlsx") || normalized.endsWith(".xlsm")) {
        return "/icons/excel.svg";
    }
    if (normalized.endsWith(".pdf")) {
        return "/icons/pdf.svg";
    }
    return null;
}

function getProjectTitle(summary: ProjectLegalSearchSummary): string {
    if (summary.pdNumber && summary.project) {
        return `${summary.pdNumber} ${summary.project}`;
    }

    return summary.project;
}

function toFileOpenUrl(fullPath: string): string {
    const params = new URLSearchParams({
        path: fullPath,
        disposition: "attachment",
    });
    return `/api/projects/revisions/file?${params.toString()}`;
}

export function ProjectLegalSearchCard({
    summary,
    query,
    files,
    isExpanded,
    selectedFilePath,
    onSelectFile,
    onToggleExpand,
    onOpenProject,
    onCreateProject,
}: ProjectLegalSearchCardProps) {
    return (
        <div className="rounded-2xl border border-border bg-card px-3 py-3 transition-colors hover:border-sky-400/50 hover:bg-accent/30">
            <div className="flex items-start gap-3">
                <ProjectIcon
                    name={summary.project}
                    color={summary.color ?? "#FFCC61"}
                    size="md"
                    interactive={false}
                    title={getProjectTitle(summary)}
                    className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {summary.href ? (
                            <button
                                type="button"
                                className="truncate text-left text-sm font-medium text-foreground hover:text-sky-600"
                                onClick={() => {
                                    const targetHref = summary.href;
                                    if (!targetHref) {
                                        return;
                                    }

                                    onOpenProject(targetHref);
                                }}
                            >
                                {renderHighlightedText(getProjectTitle(summary), query)}
                            </button>
                        ) : (
                            <p className="truncate text-sm font-medium text-foreground">
                                {renderHighlightedText(getProjectTitle(summary), query)}
                            </p>
                        )}
                        {summary.compareFiles > 0 ? (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                                {summary.compareFiles} compare
                            </Badge>
                        ) : null}
                        {onCreateProject ? (
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="ml-auto h-7 w-7 rounded-md"
                                onClick={() => onCreateProject(summary)}
                                aria-label={`Create project from ${getProjectTitle(summary)}`}
                                title="Create project instance"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Last refreshed {formatDateTime(summary.lastRefreshed)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {summary.legalFiles} legal file{summary.legalFiles === 1 ? "" : "s"} • {summary.brandFiles} brand file{summary.brandFiles === 1 ? "" : "s"}
                    </p>
                </div>
            </div>

            {files.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-transparent">
                    <div className="grid grid-cols-[minmax(0,1.3fr)_120px_120px_160px] gap-3 border-b border-border/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        <span>Name</span>
                        <span>Type</span>
                        <span>Revision</span>
                        <span>Last Updated</span>
                    </div>

                    <div className="max-h-52 overflow-y-auto">
                        {files.map((file) => {
                            const iconPath = resolveFileIcon(file.name);
                            const isSelected = selectedFilePath === file.fullPath;

                            return (
                                <a
                                    key={`${summary.key}-${file.fullPath}`}
                                    href={toFileOpenUrl(file.fullPath)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        "grid w-full grid-cols-[minmax(0,1.3fr)_120px_120px_160px] gap-3 border-b border-border/50 px-3 py-2 text-left text-xs transition-colors last:border-b-0 hover:bg-accent/40",
                                        isSelected && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/30",
                                    )}
                                    onClick={() => onSelectFile(file.fullPath)}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        {iconPath ? (
                                            <Image src={iconPath} alt="file type" width={16} height={16} className="h-4 w-4 shrink-0" />
                                        ) : (
                                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[8px] font-semibold uppercase text-muted-foreground">
                                                {file.source === "legal" ? "L" : "B"}
                                            </span>
                                        )}
                                        <span className="truncate text-foreground hover:text-sky-600 hover:underline">
                                            {renderHighlightedText(file.name, query)}
                                        </span>
                                    </span>
                                    <span className="truncate text-muted-foreground capitalize">{file.fileType}</span>
                                    <span className="truncate text-muted-foreground">{file.revision ?? "-"}</span>
                                    <span className="truncate text-muted-foreground">{formatDateTime(file.lastWriteTime)}</span>
                                </a>
                            );
                        })}
                    </div>

                    {summary.files.length > 2 ? (
                        <div className="w-full border-t border-border/70 text-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => onToggleExpand(summary.key)}
                            >
                                {isExpanded ? "Show less" : `Show all (${summary.files.length})`}
                            </Button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
