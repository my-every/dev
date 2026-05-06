"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Timer, BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    getOperationCode,
    type OperationTimeEntry,
} from "@/types/d380-operation-codes";
import { useProjectContext } from "@/contexts/project-context";

interface BadgeTimeLogSectionProps {
    badgeNumber: string;
}

export function BadgeTimeLogSection({ badgeNumber }: BadgeTimeLogSectionProps) {
    const { allProjects } = useProjectContext();
    const [entries, setEntries] = useState<OperationTimeEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch time entries from all projects for this badge
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const fetchAll = async () => {
            const allEntries: OperationTimeEntry[] = [];
            for (const project of allProjects) {
                try {
                    const res = await fetch(
                        `/api/projects/${encodeURIComponent(project.id)}/operation-time`,
                    );
                    if (!res.ok) continue;
                    const data = (await res.json()) as {
                        summary: { entries: OperationTimeEntry[] };
                    };
                    const badgeEntries = data.summary.entries.filter(
                        (e) => e.badge === badgeNumber,
                    );
                    allEntries.push(...badgeEntries);
                } catch {
                    // skip
                }
            }
            if (!cancelled) {
                setEntries(allEntries);
                setLoading(false);
            }
        };

        fetchAll();
        return () => {
            cancelled = true;
        };
    }, [badgeNumber, allProjects]);

    const totalMinutes = useMemo(
        () => entries.reduce((s, e) => s + e.actualMinutes, 0),
        [entries],
    );

    const recent = useMemo(
        () =>
            [...entries]
                .sort(
                    (a, b) =>
                        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
                )
                .slice(0, 15),
        [entries],
    );

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    My Time Log
                </h3>
                <Badge variant="outline" className="text-xs tabular-nums">
                    {entries.length} entries · {formatMinutes(totalMinutes)}
                </Badge>
            </div>

            {entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                        No time entries recorded yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                    {recent.map((entry) => {
                        const op = getOperationCode(entry.opCode);
                        return (
                            <div
                                key={entry.id}
                                className="flex items-center gap-2 rounded-md border bg-card/40 px-2.5 py-1.5 text-xs"
                            >
                                <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] shrink-0"
                                >
                                    {entry.opCode}
                                </Badge>
                                <span className="truncate flex-1">
                                    {op?.label ?? entry.opCode}
                                </span>
                                <span className="text-muted-foreground text-[10px] shrink-0">
                                    {new Date(entry.startedAt).toLocaleDateString()}
                                </span>
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                    {formatMinutes(entry.actualMinutes)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function formatMinutes(minutes: number): string {
    if (minutes === 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
