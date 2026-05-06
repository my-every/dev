"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History, ShieldCheck, Sparkles, Users2 } from "lucide-react";

import { DashboardDomainShell } from "@/components/dashboard/shared/dashboard-domain-shell";
import { UsersView } from "@/components/profile/user-access/users-view";
import { UserPermissionsPanel } from "@/components/profile/user-access/user-permissions-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersAuditPanel } from "@/components/dashboard/users/users-audit-panel";
import { useDashboardAside } from "@/app/profile/[badgeNumber]/(dashboard)/dashboard-aside-context";
import { useSession } from "@/hooks/use-session";
import { useLayoutUI } from "@/components/layout/layout-context";

type UsersTab = "directory" | "access" | "skills" | "audit";

export function UsersDashboardShell({ badgeNumber }: { badgeNumber: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useSession();
    const { selectedMember, selectedUser, setSelectedMember, setSelectedUser } = useDashboardAside();
    const { isAsideOpen } = useLayoutUI();

    const activeTab = (searchParams.get("tab") as UsersTab) || "directory";
    const selectedBadge = selectedUser?.badge ?? selectedMember?.badge ?? null;
    const selectedEntity = selectedUser ?? selectedMember;

    const tabs = useMemo(
        () => [
            { id: "directory", label: "Directory" },
            { id: "access", label: "Access" },
            { id: "skills", label: "Skills" },
            { id: "audit", label: "Audit" },
        ],
        [],
    );

    const handleTabChange = (tabId: string) => {
        router.replace(`/profile/${badgeNumber}/users?tab=${encodeURIComponent(tabId)}`);
    };

    const summary = (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UsersSummaryCard label="Directory" value="Team browsing and detail selection" />
            <UsersSummaryCard label="Access" value="Project schedule, user admin, catalog access" />
            <UsersSummaryCard label="Skills" value="Inline skills and capability management" />
            <UsersSummaryCard label="Audit" value="Permission and workflow history" />
        </div>
    );

    const actions = (
        <>
        
            {selectedEntity && activeTab !== "audit" ? (
                <Button variant="secondary" size="sm" onClick={() => handleTabChange("audit")}>
                    Open Audit
                </Button>
            ) : null}
        </>
    );

    const shouldCollapseRightPane = Boolean(selectedEntity && isAsideOpen && activeTab !== "audit");

    const rightPane = shouldCollapseRightPane ? null : (
        <div className="space-y-4">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Guided Admin</p>
                <h3 className="text-lg font-semibold">Manage people in one place</h3>
                <p className="text-sm text-muted-foreground">
                    Pick a user once, then move across directory, access, and skills without leaving the shell.
                </p>
            </div>
            {selectedEntity ? (
                <div className="space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">{selectedEntity.fullName}</p>
                                <p className="text-sm text-muted-foreground">
                                    #{selectedEntity.badge}
                                    {selectedEntity.role ? ` · ${selectedEntity.role.replaceAll("_", " ")}` : ""}
                                </p>
                            </div>
                            <Badge variant="outline">{activeTab === "skills" ? "Skills" : activeTab === "access" ? "Access" : "Selected"}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant={activeTab === "access" ? "default" : "outline"} onClick={() => handleTabChange("access")}>
                                Manage Access
                            </Button>
                            <Button size="sm" variant={activeTab === "skills" ? "default" : "outline"} onClick={() => handleTabChange("skills")}>
                                Edit Skills
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleTabChange("audit")}>
                                Open Audit
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        <HintCard
                            title={activeTab === "directory" ? "Directory selected" : activeTab === "access" ? "Access review" : "Skills review"}
                            description={
                                activeTab === "directory"
                                    ? "This selection will stay highlighted when you move into Access or Skills."
                                    : activeTab === "access"
                                      ? "Use the same selected person to review schedule, admin, and catalog access together."
                                      : "Keep the same selected person while reviewing capability coverage and training gaps."
                            }
                        />
                        <HintCard
                            title="Less steps"
                            description="The right pane and the global aside now follow the same selected person across the Users shell."
                        />
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    <HintCard title="Start in Directory" description="Pick one person once, then move into Access or Skills without re-selecting them." />
                    <HintCard title="Audit on demand" description="Open the audit feed any time to verify recent permission and capability changes." />
                </div>
            )}
        </div>
    );

    return (
        <DashboardDomainShell
            title="Users"
            description="Unified user administration with directory selection, access management, skills, and audit in one responsive shell."
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
           
            actions={actions}
         
        >
            {activeTab === "directory" ? (
                <UsersView
                    performerBadge={user?.badge ?? badgeNumber}
                    selectedBadge={selectedBadge}
                    onSelectMember={(member) => {
                        setSelectedMember(member);
                        setSelectedUser(member ? selectedUser && selectedUser.badge === member.badge ? selectedUser : null : null);
                    }}
                />
            ) : null}
            {activeTab === "access" ? (
                <UserPermissionsPanel
                    managerBadge={user?.badge ?? badgeNumber}
                    managerShift={user?.currentShift ?? "1st"}
                    roleLabel={user?.role ?? "MANAGER"}
                    variant="access"
                    selectedBadge={selectedBadge}
                    onUserSelect={(selected) => {
                        setSelectedUser(selected);
                        setSelectedMember(selected);
                    }}
                />
            ) : null}
            {activeTab === "skills" ? (
                <UserPermissionsPanel
                    managerBadge={user?.badge ?? badgeNumber}
                    managerShift={user?.currentShift ?? "1st"}
                    roleLabel={user?.role ?? "MANAGER"}
                    variant="skills"
                    selectedBadge={selectedBadge}
                    onUserSelect={(selected) => {
                        setSelectedUser(selected);
                        setSelectedMember(selected);
                    }}
                />
            ) : null}
            {activeTab === "audit" ? <UsersAuditPanel performerBadge={user?.badge ?? badgeNumber} /> : null}
        </DashboardDomainShell>
    );
}

function UsersSummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <Card className="rounded-2xl border-border/60 bg-card/80">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm font-semibold">{value}</p>
            </CardContent>
        </Card>
    );
}

function HintCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <Badge variant="outline" className="mt-3 text-[10px] uppercase tracking-[0.2em]">
                Focused
            </Badge>
        </div>
    );
}
