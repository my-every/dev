"use client";

import { useMemo, useState } from "react";
import { History, Shield, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UsersAuditPanelProps {
    performerBadge: string;
}

const MOCK_AUDIT_ENTRIES = [
    {
        id: "audit-1",
        title: "Granted catalog access",
        description: "Catalog access was enabled for a team member.",
        actor: "Management",
        target: "User Access",
        at: "Today",
    },
    {
        id: "audit-2",
        title: "Updated skill settings",
        description: "Skill coverage changed for an assembler profile.",
        actor: "Supervisor",
        target: "Skills",
        at: "Yesterday",
    },
];

export function UsersAuditPanel({ performerBadge }: UsersAuditPanelProps) {
    const [query, setQuery] = useState("");

    const items = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return MOCK_AUDIT_ENTRIES;
        return MOCK_AUDIT_ENTRIES.filter((item) =>
            `${item.title} ${item.description} ${item.actor} ${item.target}`.toLowerCase().includes(normalizedQuery),
        );
    }, [query]);

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Audit feed</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Review user-management changes without leaving the new Users shell.
                        </p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                        #{performerBadge}
                    </Badge>
                </div>
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="mt-4"
                    placeholder="Search access or skills history..."
                />
            </div>

            <ScrollArea className="h-[32rem] rounded-2xl border border-border/60 bg-card/60">
                <div className="divide-y divide-border/50">
                    {items.map((item) => (
                        <div key={item.id} className="space-y-2 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{item.title}</p>
                                </div>
                                <Badge variant="secondary">{item.at}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="gap-1.5">
                                    <Shield className="h-3 w-3" />
                                    {item.target}
                                </Badge>
                                <Badge variant="outline" className="gap-1.5">
                                    <User className="h-3 w-3" />
                                    {item.actor}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
