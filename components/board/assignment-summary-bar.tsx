"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  PlayCircle,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BoardProjectView, BoardMemberView, BoardAssignmentView } from "@/lib/board/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssignmentSummaryBarProps {
  projects: BoardProjectView[];
  members: BoardMemberView[];
  variant?: "compact" | "expanded";
  className?: string;
}

interface SummaryStats {
  totalProjects: number;
  totalAssignments: number;
  unassigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  totalMembers: number;
  availableMembers: number;
  onAssignmentMembers: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  utilizationPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function calculateStats(projects: BoardProjectView[], members: BoardMemberView[]): SummaryStats {
  const allAssignments: BoardAssignmentView[] = [];
  for (const project of projects) {
    allAssignments.push(...project.assignments);
  }

  const unassigned = allAssignments.filter((a) => !a.assignedBadge).length;
  const pending = allAssignments.filter((a) => a.status === "pending").length;
  const inProgress = allAssignments.filter((a) => a.status === "in-progress").length;
  const completed = allAssignments.filter((a) => a.status === "completed").length;

  const totalEstimatedMinutes = allAssignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
  
  // Calculate actual minutes from completed and in-progress assignments
  let totalActualMinutes = 0;
  for (const a of allAssignments) {
    if (a.actualStartTime && a.actualEndTime) {
      const start = new Date(a.actualStartTime).getTime();
      const end = new Date(a.actualEndTime).getTime();
      totalActualMinutes += Math.round((end - start) / 60000);
    }
  }

  const availableMembers = members.filter((m) => m.availabilityStatus === "AVAILABLE").length;
  const onAssignmentMembers = members.filter((m) => m.availabilityStatus === "ON_ASSIGNMENT").length;

  // Calculate utilization: assigned work / available capacity
  const assignedCount = allAssignments.length - unassigned;
  const utilizationPercent = allAssignments.length > 0
    ? Math.round((assignedCount / allAssignments.length) * 100)
    : 0;

  return {
    totalProjects: projects.length,
    totalAssignments: allAssignments.length,
    unassigned,
    pending,
    inProgress,
    completed,
    totalMembers: members.length,
    availableMembers,
    onAssignmentMembers,
    totalEstimatedMinutes,
    totalActualMinutes,
    utilizationPercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AssignmentSummaryBar({
  projects,
  members,
  variant = "compact",
  className,
}: AssignmentSummaryBarProps) {
  const stats = useMemo(() => calculateStats(projects, members), [projects, members]);

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-4 text-sm", className)}>
          {/* Assignments Summary */}
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{stats.totalAssignments}</span>
            <span className="text-muted-foreground">assignments</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Status Breakdown */}
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.unassigned}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Unassigned</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-blue-600">
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.inProgress}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>In Progress</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.completed}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completed</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Members */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{stats.availableMembers}</span>
            <span className="text-muted-foreground">available</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDuration(stats.totalEstimatedMinutes)}</span>
            <span className="text-muted-foreground">estimated</span>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Expanded variant
  return (
    <TooltipProvider>
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Assignments Card */}
          <StatCard
            icon={<Layers className="h-5 w-5" />}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
            title="Assignments"
            value={stats.totalAssignments}
            subtitle={`${stats.totalProjects} projects`}
          >
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar
                segments={[
                  { value: stats.completed, color: "bg-emerald-500", label: "Completed" },
                  { value: stats.inProgress, color: "bg-blue-500", label: "In Progress" },
                  { value: stats.pending, color: "bg-slate-300", label: "Pending" },
                ]}
                total={stats.totalAssignments}
              />
            </div>
          </StatCard>

          {/* Unassigned Alert Card */}
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            iconColor={stats.unassigned > 0 ? "text-amber-600" : "text-emerald-600"}
            iconBg={stats.unassigned > 0 ? "bg-amber-100" : "bg-emerald-100"}
            title="Unassigned"
            value={stats.unassigned}
            subtitle={stats.unassigned > 0 ? "need attention" : "all assigned"}
            valueColor={stats.unassigned > 0 ? "text-amber-600" : "text-emerald-600"}
          />

          {/* Team Availability Card */}
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconColor="text-violet-600"
            iconBg="bg-violet-100"
            title="Team"
            value={stats.totalMembers}
            subtitle="total members"
          >
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                {stats.availableMembers} available
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {stats.onAssignmentMembers} working
              </Badge>
            </div>
          </StatCard>

          {/* Utilization Card */}
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            title="Utilization"
            value={`${stats.utilizationPercent}%`}
            subtitle="assignments covered"
          >
            <div className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.utilizationPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </StatCard>
        </div>

        {/* Time Summary Row */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Estimated:</span>
              <span className="text-sm font-semibold">{formatDuration(stats.totalEstimatedMinutes)}</span>
            </div>
            {stats.totalActualMinutes > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Actual:</span>
                  <span className="text-sm font-semibold">{formatDuration(stats.totalActualMinutes)}</span>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.inProgress > 0 && (
              <span>{stats.inProgress} in progress right now</span>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string | number;
  subtitle: string;
  valueColor?: string;
  children?: React.ReactNode;
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  title,
  value,
  subtitle,
  valueColor = "text-foreground",
  children,
}: StatCardProps) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2", iconBg, iconColor)}>{icon}</div>
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className={cn("text-2xl font-bold", valueColor)}>{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface ProgressSegment {
  value: number;
  color: string;
  label: string;
}

interface ProgressBarProps {
  segments: ProgressSegment[];
  total: number;
}

function ProgressBar({ segments, total }: ProgressBarProps) {
  if (total === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
          {segments.map((segment, index) => {
            const percent = (segment.value / total) * 100;
            if (percent === 0) return null;
            return (
              <motion.div
                key={segment.label}
                className={cn("h-full", segment.color)}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              />
            );
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2 text-xs">
              <div className={cn("h-2 w-2 rounded-full", segment.color)} />
              <span>{segment.label}:</span>
              <span className="font-medium">{segment.value}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
