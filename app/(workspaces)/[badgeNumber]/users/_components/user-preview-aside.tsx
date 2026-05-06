"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone, Shield } from "lucide-react";

import { DetailSectionCard, SkeletonDefinitionListCard } from "@/app/(workspaces)/[badgeNumber]/_components";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { WorkspaceUserRecord, WorkspaceUserSettingsRecord } from "./users-types";
import { normalizeUserLabel } from "./users-display";

type UserPreviewAsideProps = {
    badgeNumber: string;
    user: WorkspaceUserRecord | null;
};

export function UserPreviewAside({ badgeNumber, user }: UserPreviewAsideProps) {
    const [settings, setSettings] = useState<WorkspaceUserSettingsRecord | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user?.shift) {
            setSettings(null);
            return;
        }

        let isMounted = true;
        setLoading(true);
        fetch(`/api/users/${encodeURIComponent(user.badge)}/settings?shift=${encodeURIComponent(user.shift)}`, {
            cache: "no-store",
        })
            .then(async (response) => {
                if (!response.ok) {
                    return null;
                }
                const payload = (await response.json()) as { settings?: WorkspaceUserSettingsRecord };
                return payload.settings ?? null;
            })
            .then((nextSettings) => {
                if (isMounted) {
                    setSettings(nextSettings);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [user?.badge, user?.shift]);

    const permissionSummary = useMemo(() => {
        if (!settings?.permissions || typeof settings.permissions !== "object") {
            return [];
        }

        return Object.entries(settings.permissions)
            .filter(([, value]) => Boolean(value))
            .slice(0, 5)
            .map(([key]) => normalizeUserLabel(key));
    }, [settings?.permissions]);

    if (!user) {
        return (
            <div className="space-y-4 p-4">
                <SkeletonDefinitionListCard rows={4} />
            </div>
        );
    }

    return (
        <div className="space-y-4 ">
            <ProfileHeader
                badgeNumber={user.badge}
                compact
                className="border border-border bg-background/70"
                layout="vertical"
            />
        </div>
    );
}

function PreviewRow({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{label}:</span>
            <span className="truncate text-foreground">{value}</span>
        </div>
    );
}
