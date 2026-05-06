import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
    WorkspaceSidePanelHeader,
    type DetailSectionConfig,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";

type UserDetailSidePanelNavProps = {
    sections: DetailSectionConfig[];
    mode?: ViewMode;
    backHref: string;
    title: string;
    subtitle: string;
    eyebrow?: string;
    summary?: ReactNode;
    hideDefaultSummary?: boolean;
    className?: string;
};

export function UserDetailSidePanelNav({
    sections,
    mode = "default",
    backHref,
    title,
    subtitle,
    eyebrow = "User detail",
    summary,
    hideDefaultSummary = false,
    className,
}: UserDetailSidePanelNavProps) {
    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)}>
            <WorkspaceSidePanelHeader
                mode={mode}
                eyebrow={eyebrow}
                title={title}
                subtitle={subtitle}
                actions={
                    <Link
                        href={backHref}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Back to users"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                }
            />

            <div className="border-b border-border px-3 py-3 flex flex-col">
                {summary ? (
                    summary
                ) : hideDefaultSummary ? null : mode === "skeleton" ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">{title}</div>
                        <div className="text-xs text-muted-foreground">{subtitle}</div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
                <div className="space-y-2">
                    {sections.map((section) => (
                        <div key={section.id}>{section.renderNav(mode)}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
