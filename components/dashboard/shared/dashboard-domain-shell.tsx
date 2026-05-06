"use client";

import type { ReactNode } from "react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface DashboardShellTab {
    id: string;
    label: string;
}

export interface DashboardStat {
    label: string;
    value: ReactNode;
    description?: string;
}

interface DashboardStatGridProps {
    stats: DashboardStat[];
    className?: string;
}

export function DashboardStatGrid({ stats, className }: DashboardStatGridProps) {
    return (
        <div className={cn("grid grid-cols-2 gap-3", className)}>
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-card/60 px-3.5 py-2.5"
                >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-foreground">
                        {stat.value}
                    </span>
                    {stat.description && (
                        <span className="text-[11px] text-muted-foreground">{stat.description}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

interface DashboardDomainShellProps {
    title: string;
    description: string;
    tabs: DashboardShellTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    stats?: DashboardStat[];
    summary?: ReactNode;
    actions?: ReactNode;
    filters?: ReactNode;
    children: ReactNode;
    rightPane?: ReactNode;
}

export function DashboardDomainShell({
    title,
    description,
    tabs,
    activeTab,
    onTabChange,
    stats,
    summary,
    actions,
    filters,
    children,
    rightPane,
}: DashboardDomainShellProps) {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 px-4 pb-3 pt-4 md:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
                        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
                    </div>
                    {stats && stats.length > 0 && (
                        <DashboardStatGrid stats={stats} className="lg:w-64 lg:shrink-0" />
                    )}
                </div>

                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}

                {summary ? <div>{summary}</div> : null}

                <div className="sticky top-0 z-10 -mx-1">
                    <AnimatedTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={onTabChange}
                        variant="pill"
                        layoutId={`dashboard-domain-shell-${title}-tabs`}
                    />
                </div>

                {filters ? <div>{filters}</div> : null}
            </div>

            <div className={cn("flex min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 md:px-5", rightPane ? "xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]" : "")}>
                <ScrollArea className="min-h-0 flex-1">
                    {children}
                </ScrollArea>

                {rightPane ? (
                    <div className="hidden min-h-0 overflow-hidden rounded-3xl border border-border/60 bg-card/70 xl:flex xl:flex-col">
                        <ScrollArea className="min-h-0 flex-1">
                            <div className="p-4">{rightPane}</div>
                        </ScrollArea>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
