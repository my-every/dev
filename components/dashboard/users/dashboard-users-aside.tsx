"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, History, ShieldCheck, Sparkles, Users2, X } from "lucide-react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberStatCards } from "@/components/profile/user-access/member-stat-cards";
import type { TeamMember } from "@/components/profile/user-access/user-detail-aside";
import type { UserWithSettings } from "@/components/profile/user-access/user-permissions-panel";
import { ActivityTimelinePanel } from "@/components/activity";
import { useLayoutUI } from "@/components/layout/layout-context";

type UsersAsideTab = "details" | "access" | "skills" | "activity";
type UsersShellTab = "directory" | "access" | "skills" | "audit";

interface DashboardUsersAsideProps {
    selectedMember: TeamMember | null;
    selectedUser: UserWithSettings | null;
    activeShellTab: UsersShellTab;
    onClose: () => void;
    onNavigate: (tab: UsersShellTab) => void;
}

const ASIDE_TABS = [
    { id: "details", label: "Details" },
    { id: "access", label: "Access" },
    { id: "skills", label: "Skills" },
    { id: "activity", label: "Activity" },
] satisfies Array<{ id: UsersAsideTab; label: string }>;

function getDefaultAsideTab(tab: UsersShellTab): UsersAsideTab {
    if (tab === "access") return "access";
    if (tab === "skills") return "skills";
    if (tab === "audit") return "activity";
    return "details";
}

export function DashboardUsersAside({
    selectedMember,
    selectedUser,
    activeShellTab,
    onClose,
    onNavigate,
}: DashboardUsersAsideProps) {
    const { closeAside } = useLayoutUI();
    const [activeTab, setActiveTab] = useState<UsersAsideTab>(getDefaultAsideTab(activeShellTab));
    const entity = selectedUser ?? selectedMember;

    useEffect(() => {
        setActiveTab(getDefaultAsideTab(activeShellTab));
    }, [activeShellTab, entity?.badge]);

    const accessSummary = useMemo(() => {
        const access = selectedUser?.settings?.dashboardAccess;
        if (!access) {
            return { enabled: 0, total: 0, labels: [] as string[] };
        }
        const labels = [
            access.projectSchedule ? "Schedule" : null,
            access.userAccess ? "Users" : null,
            access.catalogAccess ? "Catalog" : null,
        ].filter((value): value is string => Boolean(value));
        return { enabled: labels.length, total: 3, labels };
    }, [selectedUser?.settings?.dashboardAccess]);

    const skillSummary = useMemo(() => {
        const skills = entity?.skills ?? {};
        const entries = Object.entries(skills).filter(([, level]) => Number(level) > 0);
        return {
            total: entries.length,
            top: entries
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 3)
                .map(([label]) => label),
        };
    }, [entity?.skills]);

    const handleClose = () => {
        onClose();
        closeAside();
    };

    if (!entity) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Select a person to review details, access, skills, and activity in one place.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 border-b border-border/60 px-4 pb-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Users Detail</p>
                        <h3 className="text-base font-semibold">{entity.preferredName || entity.fullName}</h3>
                        <p className="text-sm text-muted-foreground">
                            #{entity.badge}
                            {entity.role ? ` · ${entity.role.replaceAll("_", " ")}` : ""}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Access" value={accessSummary.total > 0 ? `${accessSummary.enabled}/${accessSummary.total}` : "—"} />
                    <MetricCard label="Skills" value={skillSummary.total > 0 ? `${skillSummary.total}` : "—"} />
                </div>

                <AnimatedTabs
                    tabs={ASIDE_TABS}
                    activeTab={activeTab}
                    onChange={(value) => setActiveTab(value as UsersAsideTab)}
                    variant="underline"
                    layoutId="dashboard-users-aside-tabs"
                />
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
                {activeTab === "details" ? (
                    <MemberStatCards member={entity} mode="view" variant="card" />
                ) : null}

                {activeTab === "access" ? (
                    <AsideSection
                        title="Access Snapshot"
                        description="Use the Access shell to edit permissions. The aside keeps the same person selected and shows what is currently enabled."
                    >
                        {accessSummary.total === 0 ? (
                            <EmptyHint
                                title="Access settings not loaded here"
                                description="Open the Access tab to load and manage dashboard permissions for this person."
                            />
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {accessSummary.labels.map((label) => (
                                        <Badge key={label} variant="secondary">{label}</Badge>
                                    ))}
                                    {accessSummary.labels.length === 0 ? (
                                        <Badge variant="outline">No dashboard access enabled</Badge>
                                    ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {accessSummary.enabled} of {accessSummary.total} dashboard access areas are enabled for this person.
                                </p>
                            </div>
                        )}
                    </AsideSection>
                ) : null}

                {activeTab === "skills" ? (
                    <AsideSection
                        title="Skills Snapshot"
                        description="Use the Skills shell to edit coverage. The aside keeps the selected person, top capabilities, and readiness visible."
                    >
                        {skillSummary.total === 0 ? (
                            <EmptyHint
                                title="No skill coverage recorded"
                                description="Open the Skills tab to assign capabilities and strengthen training alignment for this person."
                            />
                        ) : (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {skillSummary.top.map((label) => (
                                        <Badge key={label} variant="outline">{label}</Badge>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {skillSummary.total} tracked skill {skillSummary.total === 1 ? "area" : "areas"} currently attached to this person.
                                </p>
                            </div>
                        )}
                    </AsideSection>
                ) : null}

                {activeTab === "activity" ? (
                    <ActivityTimelinePanel badge={entity.badge} shift={entity.shift ?? "1st"} />
                ) : null}
            </div>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}

function AsideSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <h4 className="text-sm font-semibold">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <div className="mt-3">{children}</div>
        </div>
    );
}

function EmptyHint({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border/60 p-4">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
