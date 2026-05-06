"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X,
    History,
    Shield,
    ArrowRight,
    ChevronDown,
    Download,
    Loader2,
    AlertCircle,
    GitBranch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils";
import { PERMISSION_LABELS } from "@/types/user-settings";
import type { GranularPermissions } from "@/types/user-settings";

// ============================================================================
// Types
// ============================================================================

interface PermissionAuditEntry {
    id: string;
    timestamp: string;
    action: "PERMISSION_GRANTED" | "PERMISSION_REVOKED" | "PERMISSION_DELEGATED";
    performedBy: {
        badge: string;
        name: string;
    };
    permissionKey: keyof GranularPermissions;
    previousValue: boolean;
    newValue: boolean;
    cascadedFrom?: string;
    cascadeTo?: string[];
}

interface PermissionAuditAsideProps {
    user: {
        badge: string;
        name: string;
    };
    onClose: () => void;
}

// ============================================================================
// Mock Data
// ============================================================================

const generateMockAuditForUser = (badge: string): PermissionAuditEntry[] => [
    {
        id: "1",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        action: "PERMISSION_GRANTED",
        performedBy: { badge: "75241", name: "Billy Truong" },
        permissionKey: "canEditSkills",
        previousValue: false,
        newValue: true,
    },
    {
        id: "2",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        action: "PERMISSION_GRANTED",
        performedBy: { badge: "75241", name: "Billy Truong" },
        permissionKey: "canViewSkills",
        previousValue: false,
        newValue: true,
    },
    {
        id: "3",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        action: "PERMISSION_DELEGATED",
        performedBy: { badge: "75241", name: "Billy Truong" },
        permissionKey: "canGrantPermissions",
        previousValue: false,
        newValue: true,
        cascadedFrom: "75241",
        cascadeTo: ["68511", "70061"],
    },
];

// ============================================================================
// Sub Components
// ============================================================================

function AuditTimelineItem({ entry }: { entry: PermissionAuditEntry }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const permissionMeta = PERMISSION_LABELS[entry.permissionKey];
    const performerInitials = getAvatarInitials(entry.performedBy.name);
    const performerColor = getAvatarColor(entry.performedBy.badge);

    const actionLabel = entry.action === "PERMISSION_GRANTED"
        ? "Granted"
        : entry.action === "PERMISSION_REVOKED"
            ? "Revoked"
            : "Delegated";

    const actionBadgeVariant = entry.action === "PERMISSION_GRANTED"
        ? "default"
        : entry.action === "PERMISSION_REVOKED"
            ? "destructive"
            : "secondary";

    const formatDate = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <div className="relative pl-6">
            {/* Timeline dot */}
            <div className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                    <button className="w-full text-left group">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant={actionBadgeVariant} className="text-[10px]">
                                        {actionLabel}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                        {permissionMeta?.label || entry.permissionKey}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatDate(entry.timestamp)}
                                </p>
                            </div>
                            <ChevronDown className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform shrink-0 opacity-0 group-hover:opacity-100",
                                isExpanded && "rotate-180 opacity-100"
                            )} />
                        </div>
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="mt-2 rounded-lg bg-muted/50 p-2.5 text-xs space-y-2">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                                <AvatarFallback className={cn("text-[9px]", performerColor)}>
                                    {performerInitials}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-muted-foreground">by</span>
                            <span className="font-medium">{entry.performedBy.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Changed:</span>
                            <Badge variant="outline" className="text-[10px]">
                                {entry.previousValue ? "Enabled" : "Disabled"}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px]">
                                {entry.newValue ? "Enabled" : "Disabled"}
                            </Badge>
                        </div>

                        {entry.cascadedFrom && (
                            <div className="flex items-center gap-2">
                                <GitBranch className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Delegated from</span>
                                <span className="font-medium">#{entry.cascadedFrom}</span>
                            </div>
                        )}

                        {entry.cascadeTo && entry.cascadeTo.length > 0 && (
                            <div className="flex items-start gap-2">
                                <GitBranch className="h-3 w-3 text-muted-foreground mt-0.5" />
                                <div>
                                    <span className="text-muted-foreground">Cascaded to:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {entry.cascadeTo.map((badge) => (
                                            <Badge key={badge} variant="secondary" className="text-[10px]">
                                                #{badge}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function AuditSkeleton() {
    return (
        <div className="space-y-4 pl-6">
            {[1, 2, 3].map((i) => (
                <div key={i} className="relative">
                    <div className="absolute left-[-24px] top-1 h-2.5 w-2.5 rounded-full bg-muted" />
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function PermissionAuditAside({
    user,
    onClose,
}: PermissionAuditAsideProps) {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<PermissionAuditEntry[]>([]);

    const initials = getAvatarInitials(user.name);
    const avatarColor = getAvatarColor(user.badge);

    useEffect(() => {
        // Simulate loading
        const timer = setTimeout(() => {
            setEntries(generateMockAuditForUser(user.badge));
            setLoading(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [user.badge]);

    // Group by permission key
    const groupedByPermission = useMemo(() => {
        const groups: Record<keyof GranularPermissions, PermissionAuditEntry[]> = {} as any;
        entries.forEach((entry) => {
            if (!groups[entry.permissionKey]) {
                groups[entry.permissionKey] = [];
            }
            groups[entry.permissionKey].push(entry);
        });
        return groups;
    }, [entries]);

    const handleExportCSV = () => {
        const headers = ["Timestamp", "Action", "Permission", "Previous", "New", "Performed By"];
        const rows = entries.map((e) => [
            new Date(e.timestamp).toISOString(),
            e.action,
            e.permissionKey,
            e.previousValue.toString(),
            e.newValue.toString(),
            e.performedBy.name,
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `permission-audit-${user.badge}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarFallback className={cn("font-semibold", avatarColor)}>
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-xs text-muted-foreground">Permission History</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Summary */}
            <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                        {entries.length} permission {entries.length === 1 ? "change" : "changes"} recorded
                    </span>
                </div>
            </div>

            {/* Timeline */}
            <ScrollArea className="flex-1 px-4 py-4">
                {loading ? (
                    <AuditSkeleton />
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm font-medium">No audit history</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Permission changes will appear here
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                        {/* Entries grouped by permission */}
                        <div className="space-y-6">
                            {Object.entries(groupedByPermission).map(([permKey, permEntries]) => {
                                const permMeta = PERMISSION_LABELS[permKey as keyof GranularPermissions];
                                return (
                                    <div key={permKey}>
                                        <div className="flex items-center gap-2 mb-3 ml-6">
                                            <Shield className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                {permMeta?.label || permKey}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            {permEntries.map((entry) => (
                                                <AuditTimelineItem key={entry.id} entry={entry} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-4 py-3">
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleExportCSV}
                    disabled={loading || entries.length === 0}
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export as CSV
                </Button>
            </div>
        </div>
    );
}
