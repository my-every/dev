"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Search,
  Sun,
  Moon,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  BoardProjectView,
  BoardAssignmentView,
  BoardMemberView,
} from "@/lib/board/types";
import { SHIFT_SCHEDULES, type ShiftId } from "@/types/shifts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickAssignmentPanelProps {
  projects: BoardProjectView[];
  members: BoardMemberView[];
  onAssign: (assignmentId: string, memberBadge: string) => Promise<void>;
  onUnassign?: (assignmentId: string) => Promise<void>;
  className?: string;
}

type ViewMode = "assignments" | "members";
type ShiftFilter = "all" | "1st" | "2nd";

interface AssignmentWithProject extends BoardAssignmentView {
  projectName: string;
  pdNumber: string;
}

interface TeamGroup {
  teamName: string;
  members: BoardMemberView[];
  availableCount: number;
  onAssignmentCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "in-progress":
      return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "pending":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getAvailabilityIndicator(status: BoardMemberView["availabilityStatus"]): {
  color: string;
  label: string;
} {
  switch (status) {
    case "AVAILABLE":
      return { color: "bg-emerald-500", label: "Available" };
    case "ON_ASSIGNMENT":
      return { color: "bg-amber-500", label: "On Assignment" };
    case "OFF_SHIFT":
      return { color: "bg-muted-foreground/50", label: "Off Shift" };
    default:
      return { color: "bg-muted-foreground/50", label: "Unknown" };
  }
}

function getCurrentShift(): ShiftId {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinutes;

  // 1st shift: 04:00 (240) to 14:30 (870)
  // 2nd shift: 15:00 (900) to 01:00 next day (1500 or 60)
  const firstShiftStart = 4 * 60; // 04:00
  const firstShiftEnd = 14 * 60 + 30; // 14:30
  
  if (currentTime >= firstShiftStart && currentTime < firstShiftEnd) {
    return "1st";
  }
  return "2nd";
}

function parseShiftFromDir(shiftDir: string): ShiftId | null {
  if (shiftDir.includes("1st")) return "1st";
  if (shiftDir.includes("2nd")) return "2nd";
  return null;
}

function groupMembersByTeam(members: BoardMemberView[]): TeamGroup[] {
  const teamMap = new Map<string, BoardMemberView[]>();
  
  for (const member of members) {
    const teamName = member.role || "Unassigned";
    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, []);
    }
    teamMap.get(teamName)!.push(member);
  }

  const groups: TeamGroup[] = [];
  for (const [teamName, teamMembers] of teamMap) {
    const availableCount = teamMembers.filter(m => m.availabilityStatus === "AVAILABLE").length;
    const onAssignmentCount = teamMembers.filter(m => m.availabilityStatus === "ON_ASSIGNMENT").length;
    groups.push({
      teamName,
      members: teamMembers.sort((a, b) => a.fullName.localeCompare(b.fullName)),
      availableCount,
      onAssignmentCount,
    });
  }

  // Sort teams: those with available members first, then alphabetically
  return groups.sort((a, b) => {
    if (a.availableCount > 0 && b.availableCount === 0) return -1;
    if (a.availableCount === 0 && b.availableCount > 0) return 1;
    return a.teamName.localeCompare(b.teamName);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function QuickAssignmentPanel({
  projects,
  members,
  onAssign,
  onUnassign,
  className,
}: QuickAssignmentPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("assignments");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithProject | null>(null);
  const [selectedMember, setSelectedMember] = useState<BoardMemberView | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>("all");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Auto-detect current shift on mount and update every minute
  useEffect(() => {
    const detectAndSetShift = () => {
      const currentShift = getCurrentShift();
      setShiftFilter(currentShift);
    };
    
    detectAndSetShift();
    const interval = setInterval(detectAndSetShift, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  // Flatten all assignments with project context
  const allAssignments = useMemo(() => {
    const assignments: AssignmentWithProject[] = [];
    for (const project of projects) {
      for (const assignment of project.assignments) {
        assignments.push({
          ...assignment,
          projectName: project.name,
          pdNumber: project.pdNumber,
        });
      }
    }
    return assignments.sort((a, b) => {
      // Sort by unassigned first, then by status
      if (!a.assignedBadge && b.assignedBadge) return -1;
      if (a.assignedBadge && !b.assignedBadge) return 1;
      return a.sheetName.localeCompare(b.sheetName);
    });
  }, [projects]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((a) => {
      const matchesSearch =
        !searchQuery ||
        a.sheetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.pdNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.projectName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [allAssignments, searchQuery]);

  // Filter members by shift and search
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by shift
      const memberShift = m.shift;
      const matchesShift = 
        shiftFilter === "all" || 
        (shiftFilter === "1st" && memberShift.includes("1st")) ||
        (shiftFilter === "2nd" && memberShift.includes("2nd"));
      
      return matchesSearch && matchesShift;
    });
  }, [members, searchQuery, shiftFilter]);

  // Group filtered members by team
  const teamGroups = useMemo(() => {
    return groupMembersByTeam(filteredMembers);
  }, [filteredMembers]);

  // Available members (for assignment)
  const availableMembers = useMemo(() => {
    return filteredMembers.filter((m) => m.availabilityStatus === "AVAILABLE");
  }, [filteredMembers]);

  // Toggle team expansion
  const toggleTeamExpansion = useCallback((teamName: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
  }, []);

  // Expand all teams with available members by default
  useEffect(() => {
    const teamsWithAvailable = teamGroups
      .filter((g) => g.availableCount > 0)
      .map((g) => g.teamName);
    setExpandedTeams(new Set(teamsWithAvailable));
  }, [teamGroups]);

  // Stats
  const stats = useMemo(() => {
    const unassigned = allAssignments.filter((a) => !a.assignedBadge).length;
    const inProgress = allAssignments.filter((a) => a.status === "in-progress").length;
    const available = members.filter((m) => m.availabilityStatus === "AVAILABLE").length;
    const totalTime = allAssignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
    return { unassigned, inProgress, available, totalTime };
  }, [allAssignments, members]);

  const handleAssign = useCallback(async () => {
    if (!selectedAssignment || !selectedMember) return;
    setIsAssigning(true);
    try {
      await onAssign(selectedAssignment.assignmentId, selectedMember.badge);
      setSelectedAssignment(null);
      setSelectedMember(null);
    } finally {
      setIsAssigning(false);
    }
  }, [selectedAssignment, selectedMember, onAssign]);

  const handleSelectAssignment = useCallback((assignment: AssignmentWithProject) => {
    setSelectedAssignment((prev) =>
      prev?.assignmentId === assignment.assignmentId ? null : assignment
    );
    setSelectedMember(null);
  }, []);

  const handleSelectMember = useCallback((member: BoardMemberView) => {
    setSelectedMember((prev) => (prev?.badge === member.badge ? null : member));
  }, []);

  return (
    <TooltipProvider>
      <div className={cn("flex h-full flex-col bg-background", className)}>
        {/* Header with Stats */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Quick Assignment</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal">
                <Layers className="mr-1 h-3 w-3" />
                {stats.unassigned} unassigned
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                <Users className="mr-1 h-3 w-3" />
                {stats.available} available
              </Badge>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="mt-3 flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setViewMode("assignments")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "assignments"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="mr-1.5 inline h-3.5 w-3.5" />
              Assignments
            </button>
            <button
              onClick={() => setViewMode("members")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "members"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="mr-1.5 inline h-3.5 w-3.5" />
              Members
            </button>
          </div>

          {/* Shift Filter Toggle - Only show in Members view */}
          {viewMode === "members" && (
            <div className="mt-2 flex items-center gap-1 rounded-lg border bg-background p-1">
              <button
                onClick={() => setShiftFilter("all")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  shiftFilter === "all"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Shifts
              </button>
              <button
                onClick={() => setShiftFilter("1st")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                  shiftFilter === "1st"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="h-3 w-3" />
                1st
              </button>
              <button
                onClick={() => setShiftFilter("2nd")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors flex items-center justify-center gap-1",
                  shiftFilter === "2nd"
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="h-3 w-3" />
                2nd
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={viewMode === "assignments" ? "Search assignments..." : "Search members..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selection Preview */}
        <AnimatePresence>
          {(selectedAssignment || selectedMember) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b bg-muted/30"
            >
              <div className="flex items-center gap-2 px-4 py-2">
                {selectedAssignment && (
                  <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1 text-xs">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedAssignment.sheetName}</span>
                    <button
                      onClick={() => setSelectedAssignment(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {selectedAssignment && selectedMember && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {selectedMember && (
                  <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{selectedMember.fullName}</span>
                    <button
                      onClick={() => setSelectedMember(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {selectedAssignment && selectedMember && (
                  <Button
                    size="sm"
                    className="ml-auto h-7 gap-1.5 text-xs"
                    onClick={handleAssign}
                    disabled={isAssigning}
                  >
                    {isAssigning ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3" />
                        Assign Now
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {viewMode === "assignments" ? (
              <div className="space-y-1">
                {filteredAssignments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No assignments found
                  </div>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.assignmentId}
                      assignment={assignment}
                      isSelected={selectedAssignment?.assignmentId === assignment.assignmentId}
                      onSelect={() => handleSelectAssignment(assignment)}
                      members={members}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {teamGroups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No members found
                  </div>
                ) : (
                  teamGroups.map((group) => (
                    <TeamGroupSection
                      key={group.teamName}
                      group={group}
                      isExpanded={expandedTeams.has(group.teamName)}
                      onToggle={() => toggleTeamExpansion(group.teamName)}
                      selectedMember={selectedMember}
                      onSelectMember={handleSelectMember}
                      disabled={!selectedAssignment && viewMode === "members"}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Stats */}
        <div className="border-t bg-muted/30 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                <strong className="text-foreground">{allAssignments.length}</strong> total
              </span>
              <span>
                <strong className="text-foreground">{stats.inProgress}</strong> in progress
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatMinutes(stats.totalTime)} estimated</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface AssignmentRowProps {
  assignment: AssignmentWithProject;
  isSelected: boolean;
  onSelect: () => void;
  members: BoardMemberView[];
}

function AssignmentRow({ assignment, isSelected, onSelect, members }: AssignmentRowProps) {
  const assignedMember = assignment.assignedBadge
    ? members.find((m) => m.badge === assignment.assignedBadge)
    : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group w-full rounded-lg border p-2.5 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-transparent bg-muted/50 hover:border-border hover:bg-muted"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{assignment.sheetName}</span>
            <Badge variant="outline" className={cn("text-[10px]", getStatusColor(assignment.status))}>
              {assignment.status}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{assignment.pdNumber}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="truncate">{assignment.projectName}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {assignedMember ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {assignedMember.initials || assignedMember.fullName.slice(0, 2).toUpperCase()}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{assignedMember.fullName}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
              <User className="h-3 w-3 text-muted-foreground/50" />
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatMinutes(assignment.estimatedMinutes)}
          </span>
        </div>
      </div>
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 border-t pt-2"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Stage: {assignment.stageRoleLabel}</span>
            {assignment.partNumbers.length > 0 && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>{assignment.partNumbers.length} part(s)</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Group Section
// ─────────────────────────────────────────────────────────────────────────────

interface TeamGroupSectionProps {
  group: TeamGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedMember: BoardMemberView | null;
  onSelectMember: (member: BoardMemberView) => void;
  disabled?: boolean;
}

function TeamGroupSection({
  group,
  isExpanded,
  onToggle,
  selectedMember,
  onSelectMember,
  disabled,
}: TeamGroupSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                !isExpanded && "-rotate-90"
              )}
            />
            <span className="text-sm font-medium capitalize">{group.teamName}</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {group.members.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {group.availableCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {group.availableCount} available
              </Badge>
            )}
            {group.onAssignmentCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {group.onAssignmentCount} busy
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1 pl-2">
          {group.members.map((member) => (
            <MemberRow
              key={member.badge}
              member={member}
              isSelected={selectedMember?.badge === member.badge}
              onSelect={() => onSelectMember(member)}
              disabled={disabled}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member Row
// ─────────────────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: BoardMemberView;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function MemberRow({ member, isSelected, onSelect, disabled }: MemberRowProps) {
  const availability = getAvailabilityIndicator(member.availabilityStatus);

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "group w-full rounded-lg border p-2.5 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-transparent bg-muted/50 hover:border-border hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {member.initials || member.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
              availability.color
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{member.fullName}</span>
            {member.activeAssignments.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {member.activeAssignments.length} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{member.badge}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="capitalize">{member.role}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{availability.label}</span>
          </div>
        </div>
        {isSelected && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
    </button>
  );
}
