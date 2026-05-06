"use client";

import { type ElementType, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Clock3, Settings2, Sparkles, UserCircle2 } from "lucide-react";

import { DashboardDomainShell } from "@/components/dashboard/shared/dashboard-domain-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimelinePanel } from "@/components/activity";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { useWorkspaceSettingsContext } from "@/app/profile/[badgeNumber]/(dashboard)/workspace-settings-context";
import { useSession } from "@/hooks/use-session";
import { USER_ROLE_LABELS } from "@/types/d380-user-session";
import { DeveloperDashboard } from "@/components/profile/dashboards/developer-dashboard";
import { ManagerDashboard } from "@/components/profile/dashboards/manager-dashboard";
import { SupervisorDashboard } from "@/components/profile/dashboards/supervisor-dashboard";
import { TeamLeadDashboard } from "@/components/profile/dashboards/team-lead-dashboard";
import { QaDashboard } from "@/components/profile/dashboards/qa-dashboard";
import { BranderDashboard } from "@/components/profile/dashboards/brander-dashboard";
import { AssemblerDashboard } from "@/components/profile/dashboards/assembler-dashboard";

type WorkspaceTab = "overview" | "settings" | "activity" | "assignments";

function RoleWorkspace({ badgeNumber }: { badgeNumber: string }) {
    const { user } = useSession();

    switch (user?.role) {
        case "DEVELOPER":
            return <DeveloperDashboard badgeNumber={badgeNumber} />;
        case "MANAGER":
            return <ManagerDashboard badgeNumber={badgeNumber} />;
        case "SUPERVISOR":
            return <SupervisorDashboard badgeNumber={badgeNumber} />;
        case "TEAM_LEAD":
            return <TeamLeadDashboard badgeNumber={badgeNumber} />;
        case "QA":
            return <QaDashboard badgeNumber={badgeNumber} />;
        case "BRANDER":
            return <BranderDashboard badgeNumber={badgeNumber} />;
        case "ASSEMBLER":
            return <AssemblerDashboard badgeNumber={badgeNumber} />;
        default:
            return <DeveloperDashboard badgeNumber={badgeNumber} />;
    }
}

export function WorkspaceDashboardShell({ badgeNumber }: { badgeNumber: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useSession();
    const { settingsDraft, onFormChange } = useWorkspaceSettingsContext();

    const activeTab = (searchParams.get("tab") as WorkspaceTab) || "overview";

    const tabs = useMemo(
        () => [
            { id: "overview", label: "Overview" },
            { id: "settings", label: "Settings" },
            { id: "activity", label: "Activity" },
            { id: "assignments", label: "Assignments" },
        ],
        [],
    );

    const handleTabChange = (tabId: string) => {
        router.replace(`/profile/${badgeNumber}/workspace?tab=${encodeURIComponent(tabId)}`);
    };

    const summary = (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <WorkspaceSummaryCard icon={UserCircle2} label="Role" value={user ? USER_ROLE_LABELS[user.role] : "Unknown"} />
            <WorkspaceSummaryCard icon={Clock3} label="Shift" value={user?.currentShift ?? "1st"} />
            <WorkspaceSummaryCard icon={Activity} label="Badge" value={user?.badge ?? badgeNumber} />
            <WorkspaceSummaryCard icon={Sparkles} label="Mode" value={activeTab === "overview" ? "Focused" : "Manage"} />
        </div>
    );

    const actions = (
        <>
            <Button variant={activeTab === "overview" ? "default" : "outline"} size="sm" onClick={() => handleTabChange("overview")}>
                Overview
            </Button>
            <Button variant={activeTab === "settings" ? "default" : "outline"} size="sm" onClick={() => handleTabChange("settings")}>
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                Settings
            </Button>
        </>
    );



    return (
        <DashboardDomainShell
            title="Workspace"
            description="One personal dashboard for your live work, settings, and activity. Fewer hops, clearer state."
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          
            
        >
            {activeTab === "overview" ? <RoleWorkspace badgeNumber={badgeNumber} /> : null}
            {activeTab === "settings" ? (
                <div className="space-y-4">
                    <ProfileHeader badgeNumber={badgeNumber} isEditable />
                    {settingsDraft ? (
                        <ProfileSettings initialData={settingsDraft} onFormChange={onFormChange} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                            Loading workspace settings...
                        </div>
                    )}
                </div>
            ) : null}
            {activeTab === "activity" ? (
                <ActivityTimelinePanel badge={user?.badge ?? badgeNumber} shift={user?.currentShift ?? "1st"} />
            ) : null}
            {activeTab === "assignments" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                
                </div>
            ) : null}
        </DashboardDomainShell>
    );
}

function WorkspaceSummaryCard({
    icon: Icon,
    label,
    value,
}: {
    icon: ElementType;
    label: string;
    value: string;
}) {
    return (
        <Card className="rounded-2xl border-border/60 bg-card/80">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-base font-semibold">{value}</p>
            </CardContent>
        </Card>
    );
}

function GuidanceCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <Badge variant="outline" className="mt-3 text-[10px] uppercase tracking-[0.2em]">
                Guided
            </Badge>
        </div>
    );
}
