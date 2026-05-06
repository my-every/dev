"use client";

import { useState } from "react";
import { Users2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { UsersTeamsSummaryList } from "./users-teams-summary-list";
import type { WorkspaceUserRecord } from "./users-types";

interface UsersTeamsAvatarGroupProps {
  users: WorkspaceUserRecord[];
  max?: number;
  size?: number;
  selectedUserBadge?: string | null;
  onSelectUser?: (user: WorkspaceUserRecord) => void;
  className?: string;
}

function getUserInitials(user: WorkspaceUserRecord): string {
  if (user.initials) return user.initials.slice(0, 2).toUpperCase();
  const name = user.preferredName || user.fullName;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getUserColor(badge: string): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#3b82f6", "#06b6d4",
  ];
  let hash = 0;
  for (let i = 0; i < badge.length; i++) {
    hash = badge.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function UsersTeamsAvatarGroup({
  users,
  max = 6,
  size = 32,
  selectedUserBadge,
  onSelectUser,
  className,
}: UsersTeamsAvatarGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={`View all ${users.length} team members`}
      >
        <AvatarGroup max={max} size={size} className="cursor-pointer">
          {users.map((user) => {
            const initials = getUserInitials(user);
            const color = getUserColor(user.badge);
            return (
              <Avatar key={user.badge} style={{ width: size, height: size }}>
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            );
          })}
        </AvatarGroup>

        {users.length > 0 ? (
          <span className="ml-2 text-sm text-muted-foreground">
            {users.length} member{users.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users2 className="h-4 w-4" />
            No members
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="max-h-[90vh] overflow-hidden p-0 sm:max-w-225">
          <DialogHeader className="border-b border-border/60 px-5 py-3">
            <DialogTitle>Team Members</DialogTitle>
          </DialogHeader>
          <div className="h-[80vh] overflow-hidden">
            <ScrollArea className="h-full px-4 py-4">
              <UsersTeamsSummaryList
                data={{
                  users,
                  selectedUserBadge,
                  onSelectUser: (user) => {
                    onSelectUser?.(user);
                    setOpen(false);
                  },
                }}
              />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
