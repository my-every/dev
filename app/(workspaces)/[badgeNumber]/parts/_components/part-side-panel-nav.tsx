import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
    WorkspaceSidePanelHeader,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { PART_PANEL_SUMMARY } from "./part-fixtures";

type PartSidePanelNavProps = {
    sections: DetailSectionConfig[];
    mode?: ViewMode;
    backHref: string;
    className?: string;
    summary?: {
        eyebrow?: string;
        title?: string;
        subtitle?: string;
        status?: string;
        headline?: string;
        subline?: string;
        chips?: string[];
    };
};

type PartSidePanelNavItemProps = {
    label: string;
    eyebrow?: string;
    active?: boolean;
    mode?: ViewMode;
};

export function PartSidePanelNavItem({ label, eyebrow, active = false, mode = "default" }: PartSidePanelNavItemProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("flex items-center gap-3 rounded-xl border p-3", active ? "border-border bg-accent/60" : "border-border bg-background/70")}>
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-3 rounded-xl border p-3", active ? "border-border bg-accent/60" : "border-border bg-background/70")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
                {label.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                {eyebrow ? <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div> : null}
                <div className="truncate text-sm font-medium text-foreground">{label}</div>
            </div>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">View</span>
        </div>
    );
}

export function PartSidePanelNav({
    sections,
    mode = "default",
    backHref,
    className,
    summary = PART_PANEL_SUMMARY,
}: PartSidePanelNavProps) {
    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow={summary.eyebrow}
                title={summary.title}
                subtitle={summary.subtitle}
                status={summary.status}
                actions={
                    <Link
                        href={backHref}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Back to parts"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                }
            />

            <div className="shrink-0 space-y-2 border-b border-border px-3 py-3 flex flex-col">
                {mode === "skeleton" ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-12 w-12 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-40 max-w-full" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Skeleton className="h-5 w-24 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">{summary.headline}</div>
                            <div className="text-xs text-muted-foreground">{summary.subline}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(summary.chips ?? []).map((chip) => (
                                <span key={chip} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                <div className="shrink-0 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sections</p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
                    <div className="space-y-2">
                        {sections.map((section) => (
                            <div key={section.id}>{section.renderNav(mode)}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
