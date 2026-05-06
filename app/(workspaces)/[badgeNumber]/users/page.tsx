"use client";

import { use, useEffect, useMemo, useState } from "react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";

import {
  WorkspaceSectionTabs,
  type DetailSectionConfig,
  type ViewMode,
  UsersAccessSummaryList,
  UsersAuditSummaryList,
  UsersDirectoryCollection,
  UsersSidePanelNav,
  UsersSkillsSummaryList,
  UsersSubheader,
  UsersTeamsSummaryList,
  UserPreviewAside,
  UserDetailsModal,
  type WorkspaceUserRecord,
  getUserResponsibilityLabel,
} from "./_components";

type UsersWorkspacePageProps = {
  params: Promise<{
    badgeNumber: string;
  }>;
};

type LoadState = "loading" | "ready";

export default function UsersWorkspacePage({
  params: paramsPromise,
}: UsersWorkspacePageProps) {
  const params = use(paramsPromise);
  const [users, setUsers] = useState<WorkspaceUserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUserRecord | null>(
    null,
  );
  const [state, setState] = useState<LoadState>("loading");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<WorkspaceUserRecord | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      setState("loading");

      const responses = await Promise.all([
        fetch("/api/users/team?shift=1st", { cache: "no-store" }),
        fetch("/api/users/team?shift=2nd", { cache: "no-store" }),
      ]);

      const payloads = await Promise.all(
        responses.map(async (response) => {
          if (!response.ok) {
            return [];
          }
          const payload = (await response.json()) as {
            members?: WorkspaceUserRecord[];
          };
          return payload.members ?? [];
        }),
      );

      if (!mounted) {
        return;
      }

      const nextUsers = payloads
        .flat()
        .sort((left, right) => left.fullName.localeCompare(right.fullName));
      setUsers(nextUsers);
      setSelectedUser(
        (current) =>
          nextUsers.find((user) => user.badge === current?.badge) ??
          nextUsers[0] ??
          null,
      );
      setState("ready");
    }

    void loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const mode = state === "loading" ? "skeleton" : "dynamic";
  const commandSearchGroups = useMemo<CommandSearchGroup[]>(
    () => [
      {
        heading: "Workspace",
        items: [
          {
            id: "workspace-home",
            label: "Workspace Home",
            href: `/${params.badgeNumber}`,
            keywords: ["workspace", "home"],
          },
          {
            id: "users-root",
            label: "Users",
            href: `/${params.badgeNumber}/users`,
            keywords: ["users", "directory", "team"],
          },
        ],
      },
      {
        heading: "Users",
        items: users.slice(0, 20).map((user) => ({
          id: `user-${user.badge}`,
          label: user.preferredName || user.fullName,
          description: `${user.badge} • ${getUserResponsibilityLabel(user.role)}`,
          href: `/${params.badgeNumber}/users/${user.badge}`,
          keywords: [
            user.badge,
            user.fullName,
            user.role,
            user.shift ?? "",
          ].filter(Boolean),
        })),
      },
    ],
    [params.badgeNumber, users],
  );

  const accessSummary = useMemo(
    () =>
      Array.from(
        users.reduce((map, user) => {
          const label = getUserResponsibilityLabel(user.role || "Unknown");
          map.set(label, (map.get(label) ?? 0) + 1);
          return map;
        }, new Map<string, number>()),
      )
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value: `${value}` })),
    [users],
  );

  const skillsSummary = useMemo(() => {
    const skillCounts = new Map<string, number>();
    users.forEach((user) => {
      Object.keys(user.skills ?? {}).forEach((skill) => {
        skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
      });
    });

    return Array.from(skillCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([label, value]) => ({
        label: normalizeLabel(label),
        value: `${value}`,
      }));
  }, [users]);

  const auditSummary = useMemo(() => {
    const missingLogin = users.filter((user) => !user.lastLoginAt).length;
    const recentlyUpdated = users.filter((user) => {
      if (!user.updatedAt) return false;
      const age = Date.now() - new Date(user.updatedAt).getTime();
      return age <= 1000 * 60 * 60 * 24 * 30;
    }).length;

    return [
      { label: "Recently updated", value: `${recentlyUpdated}` },
      { label: "No login recorded", value: `${missingLogin}` },
      {
        label: "Shift 1st",
        value: `${users.filter((user) => user.shift === "1st").length}`,
      },
      {
        label: "Shift 2nd",
        value: `${users.filter((user) => user.shift === "2nd").length}`,
      },
    ];
  }, [users]);

  const teamsSummary = useMemo(() => {
    return {
      users,
      selectedUserBadge: selectedUser?.badge ?? null,
      onSelectUser: setSelectedUser,
    };
  }, [selectedUser?.badge, users]);

  const handleUserCardClick = (user: WorkspaceUserRecord) => {
    setModalUser(user);
    setModalOpen(true);
  };

  const sections: DetailSectionConfig[] = useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        renderNav: (viewMode) => <UsersRootNavItem mode={viewMode} label="Overview" eyebrow="Directory" />,
        renderPanel: (viewMode) => (
          <div className="space-y-4">
            <UsersDirectoryCollection
              users={users}
              mode={viewMode}
              selectedUserBadge={selectedUser?.badge ?? null}
              onSelectUser={handleUserCardClick}
            />
            <UsersAuditSummaryList mode={viewMode} data={auditSummary} />
          </div>
        ),
      },
      {
        id: "teams",
        label: "Teams",
        renderNav: (viewMode) => <UsersRootNavItem mode={viewMode} label="Teams" eyebrow="Organization" />,
        renderPanel: (viewMode) => <UsersTeamsSummaryList mode={viewMode} data={teamsSummary} />,
      },
      {
        id: "permissions",
        label: "Permissions",
        renderNav: (viewMode) => <UsersRootNavItem mode={viewMode} label="Permissions" eyebrow="Access" />,
        renderPanel: (viewMode) => <UsersAccessSummaryList mode={viewMode} data={accessSummary} />,
      },
      {
        id: "skills",
        label: "Skills",
        renderNav: (viewMode) => <UsersRootNavItem mode={viewMode} label="Skills" eyebrow="Capability" />,
        renderPanel: (viewMode) => <UsersSkillsSummaryList mode={viewMode} data={skillsSummary} />,
      },
    ],
    [accessSummary, auditSummary, selectedUser?.badge, setSelectedUser, skillsSummary, teamsSummary, users],
  );
  function normalizeLabel(value: string) {
    return value
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
  return (
    <PageContent
       
      title="Users"
      subtitle="Team directory"
      variant="wide"
      showPanel={true}
      showAside={true}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={false}
      showSubHeader={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder="Search users, badges, responsibilities, or shifts"
      sidePanel={
        <UsersSidePanelNav
          mode={mode}
          data={{
            users,
            selectedUserBadge: selectedUser?.badge ?? null,
            onSelectUser: setSelectedUser,
          }}
        />
      }
      subHeader={
        <UsersSubheader
          mode={mode}
          data={{
            headline: "Users",
            subline:
              "Live team directory backed by team roster, profile, and settings APIs.",
            totalUsers: users.length,
            shiftSummary: `${users.filter((user) => user.shift === "1st").length} first shift / ${users.filter((user) => user.shift === "2nd").length} second shift`,
          }}
        />
      }
    >
      <div className="space-y-4 p-4 sm:p-5 lg:p-6">
        <WorkspaceSectionTabs sections={sections} mode={mode} />
      </div>

      <UserDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        user={modalUser}
      />
    </PageContent>
  );
}

function UsersRootNavItem({
  label,
  eyebrow,
  mode,
}: {
  label: string;
  eyebrow: string;
  mode: ViewMode;
}) {
  if (mode === "skeleton") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3.5 w-24 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground">
        {label.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
      </div>
    </div>
  );
}
