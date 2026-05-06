"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProjectIcon } from "@/app/(workspaces)/[badgeNumber]/projects/_components";
import type { AssignableMember } from "@/components/projects/member-assignment-selector";
import type { ProjectManifest } from "@/types/project-manifest";

export interface TaskPreviewCardProps {
  title: string;
  assignedToBadge: string;
  memberByBadge: Map<string, AssignableMember>;
  selectedProject: ProjectManifest | null;
  operation: string;
  previewDateTime: string;
  scheduleHint?: string;
}

export function TaskPreviewCard({
  title,
  assignedToBadge,
  memberByBadge,
  selectedProject,
  operation,
  previewDateTime,
  scheduleHint,
}: TaskPreviewCardProps) {
  const assignedMember = assignedToBadge
    ? (memberByBadge.get(assignedToBadge) ?? null)
    : null;

  return (
    <div className="rounded-xl flex flex-col gap-0 border border-border bg-background p-0 overflow-hidden">
      {/* Title */}
      <p className="text-sm p-2.5 font-semibold text-foreground leading-snug">
        {title || selectedProject?.name || "—"}
      </p>

      {/* Assigned To + Date */}
      <div className="grid grid-cols-2 gap-0.5 px-3 pb-2 text-[11px]">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-muted-foreground text-[9px] uppercase tracking-wide">
            Assigned To
          </span>
          {assignedMember ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage
                  src={assignedMember.avatarPath ?? undefined}
                  alt={assignedMember.fullName}
                />
                <AvatarFallback className="text-[8px] font-medium">
                  {assignedMember.initials ?? "—"}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground text-[10px] font-medium truncate">
                {assignedMember.fullName}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-[10px]">Unassigned</span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-muted-foreground text-[9px] uppercase tracking-wide">
            Date
          </span>
          <span className="text-foreground text-[10px] font-medium">
            {previewDateTime}
          </span>
          {scheduleHint ? (
            <span className="text-[10px] text-muted-foreground">{scheduleHint}</span>
          ) : null}
        </div>
      </div>

      {/* Project card footer */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/30 px-2.5 py-2">
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          {selectedProject ? (
            <>
              <ProjectIcon
                name={selectedProject.name}
                color={selectedProject.color}
                interactive={false}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-foreground">
                    {selectedProject.name}
                  </span>
                  {selectedProject.lwcType && (
                    <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                      {selectedProject.lwcType}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-mono">{selectedProject.pdNumber}</span>
                  {selectedProject.unitNumber ? (
                    <>
                      <span>·</span>
                      <span>U{selectedProject.unitNumber}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Select project</span>
          )}
        </div>
        {operation ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {operation}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
