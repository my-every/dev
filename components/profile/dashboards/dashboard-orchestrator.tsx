"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Eye,
    FolderKanban,
    FolderOpen,
    LayoutDashboard,
    ListChecks,
    Settings,
    Sparkles,
    UserCircle,
    UserCog,
    Users,
} from "lucide-react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { ProfileHeader } from "@/components/profile/profile-header";
import { MemberStatCards } from "@/components/profile/user-access/member-stat-cards";
import { ActivityTimelinePanel } from "@/components/activity";
import { DashboardProjectsGrid } from "@/components/projects/dashboard-projects-grid";
import { DashboardProjectAside } from "@/components/projects/dashboard-project-aside";
import {
    DashboardSideNav,
    type SideNavItem,
} from "@/components/layout/dashboard-side-nav";
import {
    ProjectScheduleFeatureView,
    ProjectScheduleImportStatusPanel,
} from "@/components/profile/project-schedule/project-schedule-feature-view";
import { UserPermissionsPanel, type UserWithSettings } from "@/components/profile/user-access/user-permissions-panel";
import { UserPermissionsAside } from "@/components/profile/user-access/user-permissions-aside";
import { UserSkillsPanel } from "@/components/profile/user-access/user-skills-panel";
import { UsersView } from "@/components/profile/user-access/users-view";
import { type TeamMember } from "@/components/profile/user-access/user-detail-aside";
import type { ProjectManifest } from "@/types/project-manifest";
import type { UserRole } from "@/types/d380-user-session";
import { USER_ROLE_LABELS } from "@/types/d380-user-session";
import type { DashboardAccess } from "@/types/user-settings";

import { DeveloperDashboard } from "@/components/profile/dashboards/developer-dashboard";
import { ManagerDashboard } from "@/components/profile/dashboards/manager-dashboard";
import { SupervisorDashboard } from "@/components/profile/dashboards/supervisor-dashboard";
import { TeamLeadDashboard } from "@/components/profile/dashboards/team-lead-dashboard";
import { QaDashboard } from "@/components/profile/dashboards/qa-dashboard";
import { BranderDashboard } from "@/components/profile/dashboards/brander-dashboard";
import { AssemblerDashboard } from "@/components/profile/dashboards/assembler-dashboard";

// ============================================================================
// Types
// ============================================================================

export type DashboardView =
    | "workspace"
    | "projects"
    | "users";

export interface DashboardOrchestratorProps {
    badgeNumber: string;
    role: UserRole;
    dashboardAccess?: Partial<DashboardAccess>;
}

// ============================================================================
// Nav items — shared across all roles
// ============================================================================

const ASIDE_TABS = [
    { id: "details", label: "Details" },
    { id: "activity", label: "Activity" },
];

const BASE_NAV_ITEMS: SideNavItem[] = [
    {
        id: "workspace",
        label: "Workspace",
        icon: LayoutDashboard,
        alwaysVisible: true,
    },
    {
        id: "projects",
        label: "Projects",
        icon: FolderOpen,
        alwaysVisible: true,
        subItems: [
            { id: "overview", label: "Overview", icon: Eye },
            { id: "schedule", label: "Schedule", icon: FolderKanban, requiredAccess: "projectSchedule" },
        ],
    },
    {
        id: "users",
        label: "Users",
        icon: Users,
        alwaysVisible: true,
        subItems: [
            { id: "all", label: "All Users", icon: Users },
            { id: "access", label: "User Access", icon: UserCog, requiredAccess: "userAccess" },
            { id: "skills", label: "Skills", icon: Sparkles, requiredAccess: "userAccess" },
        ],
    },
];

// ============================================================================
// Role workspace renderer
// ============================================================================

function RoleWorkspace({ role, badgeNumber }: { role: UserRole; badgeNumber: string }) {
    switch (role) {
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

// ============================================================================
// Component
// ============================================================================

type WorkspaceTab = "overview" | "settings";

export function DashboardOrchestrator({
    badgeNumber,
    role,
    dashboardAccess,
}: DashboardOrchestratorProps) {
    const [activeView, setActiveView] = useState<DashboardView>("workspace");
    const [activeSubItem, setActiveSubItem] = useState<string | null>(null);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [selectedProject, setSelectedProject] = useState<ProjectManifest | null>(null);
    const [selectedAccessUser, setSelectedAccessUser] = useState<UserWithSettings | null>(null);
    const [selectedSkillsUser, setSelectedSkillsUser] = useState<UserWithSettings | null>(null);
    const [asideTab, setAsideTab] = useState("details");
    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("overview");

    const roleLabel = USER_ROLE_LABELS[role];
    // Show aside for: users (all), projects (not schedule), access with user, or skills with user
    const showAside = (activeView === "users" && activeSubItem === "all") || 
                      (activeView === "projects" && activeSubItem !== "schedule") ||
                      (activeView === "users" && activeSubItem === "access" && selectedAccessUser !== null) ||
                      (activeView === "users" && activeSubItem === "skills" && selectedSkillsUser !== null);

    // Build nav items with active slot injection
    const navItems = useMemo<SideNavItem[]>(() => {
        return BASE_NAV_ITEMS.map((item) => {
            if (item.id === "projects") {
                return {
                    ...item,
                    activeSlot:
                        activeView === "projects" && activeSubItem === "schedule" ? (
                            <ProjectScheduleImportStatusPanel />
                        ) : undefined,
                };
            }
            return item;
        });
    }, [activeView, activeSubItem]);

    // Build aside content
    const asideContent = useMemo(() => {
        // All Users view
        if (activeView === "users" && activeSubItem === "all") {
            return selectedMember ? (
                <div className="flex flex-col h-full overflow-hidden">
                    <ProfileHeader badgeNumber={selectedMember.badge} compact />
                    <div className="px-3 pt-2 shrink-0">
                        <AnimatedTabs
                            tabs={ASIDE_TABS}
                            activeTab={asideTab}
                            onChange={setAsideTab}
                            variant="underline"
                            layoutId="dash-aside-tabs"
                        />
                    </div>
                    <div className="flex-1 overflow-auto px-3 pb-4 pt-2">
                        {asideTab === "details" ? (
                            <MemberStatCards
                                member={selectedMember}
                                mode="view"
                                variant="card"
                            />
                        ) : (
                            <ActivityTimelinePanel
                                badge={selectedMember.badge}
                                shift={selectedMember.shift ?? "1st"}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Select a user to view details
                </div>
            );
        }
        // Projects view
        if (activeView === "projects" && activeSubItem !== "schedule") {
            return selectedProject ? (
                <DashboardProjectAside project={selectedProject} />
            ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Select a project to view details
                </div>
            );
        }
        // User Access view - show Permissions panel in aside when user selected
        if (activeView === "users" && activeSubItem === "access" && selectedAccessUser) {
            return (
                <UserPermissionsAside
                    selectedUser={selectedAccessUser}
                    onClose={() => setSelectedAccessUser(null)}
                    managerBadge={badgeNumber}
                />
            );
        }
        // Skills view - show Skills panel in aside when user selected
        if (activeView === "users" && activeSubItem === "skills" && selectedSkillsUser) {
            return (
                <UserSkillsPanel
                    selectedUser={selectedSkillsUser}
                    onClose={() => setSelectedSkillsUser(null)}
                />
            );
        }
        return undefined;
    }, [activeView, activeSubItem, selectedMember, selectedProject, selectedAccessUser, selectedSkillsUser, asideTab, badgeNumber]);

    // Clear selection when switching views
    const handleViewChange = useCallback(
        (viewId: string) => {
            setActiveView(viewId as DashboardView);
            if (viewId !== "users") {
                setSelectedMember(null);
                setSelectedAccessUser(null);
                setSelectedSkillsUser(null);
            }
            if (viewId !== "projects") setSelectedProject(null);
            // Reset sub-item to first item when changing views
            if (viewId === "users") setActiveSubItem("all");
            if (viewId === "projects") setActiveSubItem("overview");
        },
        [],
    );

    return {
        title: `${roleLabel} Dashboard`,
        subtitle: `Badge #${badgeNumber}`,
        showAside,
        asideContent,
        sidePanel: (
            <DashboardSideNav
                items={navItems}
                activeView={activeView}
                onViewChange={handleViewChange}
                activeSubItem={activeSubItem}
                onSubItemChange={setActiveSubItem}
                access={dashboardAccess}
            />
        ),
        activeView,
        workspaceTab,
        setWorkspaceTab,
        content: (
            <>
                {activeView === "workspace" && (
                    <div className="space-y-4">
                        <ProfileHeader badgeNumber={badgeNumber} isEditable />
                        <AnimatedTabs
                            tabs={[
                                { id: "overview", label: "Overview", icon: <UserCircle className="h-4 w-4" /> },
                                { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
                            ]}
                            activeTab={workspaceTab}
                            onChange={(id) => setWorkspaceTab(id as WorkspaceTab)}
                            variant="segment"
                            className="max-w-md"
                        />
                        {workspaceTab === "overview" && (
                            <RoleWorkspace role={role} badgeNumber={badgeNumber} />
                        )}
                    </div>
                )}
                {activeView === "projects" && activeSubItem !== "schedule" && (
                    <DashboardProjectsGrid
                        onSelectProject={setSelectedProject}
                        selectedProjectId={selectedProject?.id}
                        activeSubItem={activeSubItem}
                    />
                )}
                {activeView === "projects" && activeSubItem === "schedule" && (
                    <ProjectScheduleFeatureView roleLabel={roleLabel} />
                )}
                {activeView === "users" && activeSubItem === "all" && (
                    <UsersView
                        onSelectMember={setSelectedMember}
                        selectedBadge={selectedMember?.badge}
                        performerBadge={badgeNumber}
                    />
                )}
                {activeView === "users" && activeSubItem === "access" && (
                    <UserPermissionsPanel
                        managerBadge={badgeNumber}
                        roleLabel={roleLabel}
                        onUserSelect={setSelectedAccessUser}
                        selectedBadge={selectedAccessUser?.badge}
                    />
                )}
                {activeView === "users" && activeSubItem === "skills" && (
                    <UserPermissionsPanel
                        managerBadge={badgeNumber}
                        roleLabel={roleLabel}
                        onUserSelect={setSelectedSkillsUser}
                        selectedBadge={selectedSkillsUser?.badge}
                    />
                )}
            </>
        ),
    };
}
