import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WorkspaceSidePanelHeader } from "@/app/(workspaces)/[badgeNumber]/_components";
import type { DetailSectionConfig, ViewMode } from "@/app/(workspaces)/[badgeNumber]/_components";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { PROJECT_PANEL_SUMMARY } from "./project-fixtures";

type ProjectSidePanelNavProps = {
    sections: DetailSectionConfig[];
    mode?: ViewMode;
    backHref: string;
    className?: string;
};

type ProjectSidePanelNavItemProps = {
    label: string;
    eyebrow?: string;
    active?: boolean;
    mode?: ViewMode;
};

export function ProjectSidePanelNavItem({
    label,
    eyebrow,
    active = false,
    mode = "default",
}: ProjectSidePanelNavItemProps) {
    if (mode === "skeleton") {
        return (
            <div className={cn("rounded-xl border p-3", active ? "border-border bg-accent/60" : "border-border bg-background/70")}>
                <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-32 max-w-[90%]" />
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <Skeleton className="h-full w-3/5 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-xl border p-3", active ? "border-border bg-accent/60" : "border-border bg-background/70")}>
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
                    {label.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                    {eyebrow ? <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div> : null}
                    <div className="truncate text-sm font-medium text-foreground">{label}</div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full bg-foreground/60", active ? "w-2/3" : "w-2/5")} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ProjectSidePanelNav({
    sections,
    mode = "default",
    backHref,
    className,
}: ProjectSidePanelNavProps) {
    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow={PROJECT_PANEL_SUMMARY.eyebrow}
                title={PROJECT_PANEL_SUMMARY.title}
                subtitle={PROJECT_PANEL_SUMMARY.subtitle}
                status={PROJECT_PANEL_SUMMARY.status}
                actions={
                    <Link
                        href={backHref}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Back to projects"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                }
            />

            <div className="shrink-0 space-y-2 border-b border-border px-3 py-3 flex flex-col">
                {mode === "skeleton" ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">{PROJECT_PANEL_SUMMARY.name}</div>
                            <div className="text-xs text-muted-foreground">{PROJECT_PANEL_SUMMARY.unit}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {PROJECT_PANEL_SUMMARY.chips.map((chip) => (
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