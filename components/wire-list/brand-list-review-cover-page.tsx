"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileUp,
  Filter,
  Layers3,
  LogIn,
  MessageSquare,
  MoreHorizontal,
  Search,
  Shield,
  User,
  Zap,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MultiSheetStatusSummary } from "@/components/wire-list/multi-sheet-review-types";
import type { MultiSheetImportSession } from "@/lib/wire-brand-list/multi-sheet-review";
import type { ActivityEntry, ActivityAction } from "@/types/activity";

// ============================================================================
// Types
// ============================================================================

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  sheetCount: number;
  totalWires: number;
  approvedCount: number;
  status: "approved" | "pending" | "in-progress" | "error";
  lastUpdated: string;
  color?: string;
  assignee?: {
    badge: string;
    name: string;
    avatarUrl?: string;
  };
}

interface BrandListReviewCoverPageProps {
  brands: BrandItem[];
  activities: ActivityEntry[];
  reviewState: MultiSheetStatusSummary;
  importSession: MultiSheetImportSession | null;
  pendingImportCount: number;
  canViewCompletedReview: boolean;
  coverActionLabel: string;
  isAuthenticated: boolean;
  userLabel: string | null;
  onSelectBrand: (brand: BrandItem) => void;
  onContinue: () => void;
  onImport: () => void;
  onOpenTutorial: () => void;
  onOpenLogin: () => void;
  onActivityClick?: (activity: ActivityEntry) => void;
  className?: string;
}

// ============================================================================
// Activity Timeline Helpers
// ============================================================================

function getActivityIcon(action: ActivityAction) {
  switch (action) {
    case "COMPLETED":
      return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/15" };
    case "ASSIGNED":
    case "STARTED":
      return { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/15" };
    case "BLOCKED":
      return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/15" };
    case "UNBLOCKED":
    case "REOPENED":
      return { icon: CheckCircle, color: "text-sky-500", bg: "bg-sky-500/15" };
    case "REASSIGNED":
      return { icon: User, color: "text-orange-500", bg: "bg-orange-500/15" };
    case "STAGE_CHANGED":
      return { icon: Clock, color: "text-violet-500", bg: "bg-violet-500/15" };
    default:
      return { icon: MessageSquare, color: "text-slate-400", bg: "bg-slate-500/15" };
  }
}

function getActionLabel(action: ActivityAction): string {
  const labels: Partial<Record<ActivityAction, string>> = {
    ASSIGNED: "Assigned",
    REASSIGNED: "Reassigned",
    STARTED: "Started",
    BLOCKED: "Blocked",
    UNBLOCKED: "Unblocked",
    STAGE_CHANGED: "Stage Changed",
    COMPLETED: "Completed",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
  };
  return labels[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function getStatusColor(status: BrandItem["status"]) {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "pending":
      return "border-amber-500/30 bg-amber-500/10";
    case "in-progress":
      return "border-sky-500/30 bg-sky-500/10";
    case "error":
      return "border-red-500/30 bg-red-500/10";
    default:
      return "border-white/10 bg-white/5";
  }
}

function getStatusBadgeStyle(status: BrandItem["status"]) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "pending":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "in-progress":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "error":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</div>
      <div className="mt-1.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function BrandCard({
  brand,
  isSelected,
  onClick,
}: {
  brand: BrandItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const progress = brand.sheetCount > 0
    ? Math.round((brand.approvedCount / brand.sheetCount) * 100)
    : 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col rounded-2xl border p-4 text-left transition-all duration-200",
        "hover:border-white/30 hover:bg-white/8",
        isSelected
          ? "border-primary ring-2 ring-primary/30 bg-primary/10"
          : getStatusColor(brand.status)
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      layout
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{
              backgroundColor: brand.color ?? "hsl(var(--primary))",
            }}
          >
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{brand.name}</h3>
            <p className="mt-0.5 text-xs text-white/60">{brand.slug}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] capitalize", getStatusBadgeStyle(brand.status))}
        >
          {brand.status.replace("-", " ")}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>{brand.approvedCount}/{brand.sheetCount} sheets</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn(
              "h-full rounded-full",
              brand.status === "approved" ? "bg-emerald-500" :
              brand.status === "error" ? "bg-red-500" : "bg-primary"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-white/50" />
          <span className="text-xs text-white/60">{brand.totalWires} wires</span>
        </div>
        {brand.assignee && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border border-white/20">
                  <AvatarImage src={brand.assignee.avatarUrl} />
                  <AvatarFallback className="bg-white/10 text-[10px] text-white">
                    {brand.assignee.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {brand.assignee.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Chevron indicator */}
      <ChevronRight
        className={cn(
          "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-all",
          "group-hover:translate-x-0.5 group-hover:text-white/60",
          isSelected && "text-primary"
        )}
      />
    </motion.button>
  );
}

function ActivityTimelineItem({
  activity,
  onClick,
  compact = false,
}: {
  activity: ActivityEntry;
  onClick?: () => void;
  compact?: boolean;
}) {
  const { icon: Icon, color, bg } = getActivityIcon(activity.action);
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors",
        "hover:bg-white/5",
        compact ? "py-2" : "py-3"
      )}
      whileHover={{ x: 2 }}
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {getActionLabel(activity.action)}
          </span>
          {activity.result && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0",
                activity.result === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : activity.result === "failure"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {activity.result}
            </Badge>
          )}
        </div>
        {activity.comment && !compact && (
          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{activity.comment}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
          {activity.performedBy && <span>Badge #{activity.performedBy}</span>}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </motion.button>
  );
}

function ActivityTimelineSidebar({
  activities,
  onActivityClick,
  className,
}: {
  activities: ActivityEntry[];
  onActivityClick?: (activity: ActivityEntry) => void;
  className?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<ActivityAction | "all">("all");
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredActivities = useMemo(() => {
    let result = [...activities];

    if (filterAction !== "all") {
      result = result.filter((a) => a.action === filterAction);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.comment?.toLowerCase().includes(search) ||
          getActionLabel(a.action).toLowerCase().includes(search) ||
          a.performedBy?.includes(search)
      );
    }

    return result.slice(0, 50);
  }, [activities, filterAction, searchTerm]);

  const actionTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.action));
    return Array.from(types).sort();
  }, [activities]);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 backdrop-blur-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Activity Timeline</h3>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="border-white/20 bg-white/5 text-[10px] text-white/70">
            {activities.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/50 hover:text-white"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="flex flex-col gap-2 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-white/40"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 justify-between border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3 w-3" />
                      {filterAction === "all" ? "All Actions" : getActionLabel(filterAction)}
                    </div>
                    <ChevronRight className="h-3 w-3 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => setFilterAction("all")}>
                    All Actions
                  </DropdownMenuItem>
                  {actionTypes.map((action) => (
                    <DropdownMenuItem key={action} onClick={() => setFilterAction(action)}>
                      {getActionLabel(action)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activities list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-white/20" />
              <p className="mt-3 text-sm text-white/40">No activities found</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <ActivityTimelineItem
                key={activity.id}
                activity={activity}
                onClick={() => onActivityClick?.(activity)}
                compact={!isExpanded}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-2">
        <p className="text-[10px] text-white/40">
          Showing {filteredActivities.length} of {activities.length} activities
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BrandListReviewCoverPage({
  brands,
  activities,
  reviewState,
  importSession,
  pendingImportCount,
  canViewCompletedReview,
  coverActionLabel,
  isAuthenticated,
  userLabel,
  onSelectBrand,
  onContinue,
  onImport,
  onOpenTutorial,
  onOpenLogin,
  onActivityClick,
  className,
}: BrandListReviewCoverPageProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileTimelineOpen, setIsMobileTimelineOpen] = useState(false);

  const filteredBrands = useMemo(() => {
    if (!searchTerm.trim()) return brands;
    const search = searchTerm.toLowerCase();
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(search) ||
        b.slug.toLowerCase().includes(search)
    );
  }, [brands, searchTerm]);

  const handleBrandSelect = useCallback(
    (brand: BrandItem) => {
      setSelectedBrandId(brand.id);
      onSelectBrand(brand);
    },
    [onSelectBrand]
  );

  const stats = useMemo(() => {
    const approved = brands.filter((b) => b.status === "approved").length;
    const pending = brands.filter((b) => b.status === "pending").length;
    const inProgress = brands.filter((b) => b.status === "in-progress").length;
    return { approved, pending, inProgress, total: brands.length };
  }, [brands]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full bg-black/40 backdrop-blur-md",
        className
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0  " />

      {/* Main content area */}
      <div className="relative flex flex-1 flex-col overflow-hidden p-4 lg:flex-row lg:gap-6 lg:p-6">
        {/* Left side - Brand cards + controls */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="mb-4 flex flex-col gap-4 lg:mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/65">
                  Brand List Review
                </div>
                <h1 className="mt-3 text-2xl font-bold text-white lg:text-3xl">
                  {canViewCompletedReview
                    ? "Ready to View"
                    : coverActionLabel === "Continue"
                    ? "In Progress"
                    : "Get Started"}
                </h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
                  Review and approve branding sheets for each project. Track progress
                  and collaborate with your team.
                </p>
              </div>

              {/* Mobile timeline toggle */}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden border-white/20 bg-white/5 text-white"
                onClick={() => setIsMobileTimelineOpen(true)}
              >
                <Clock className="mr-1.5 h-4 w-4" />
                Activity
              </Button>
            </div>

            {/* Status and metrics */}
            <div className="flex flex-wrap items-center gap-3">
              {reviewState.brandingWorkbookReady ? (
                <Badge className="bg-emerald-500/20 text-emerald-200">Export Ready</Badge>
              ) : (
                <Badge variant="secondary" className="bg-sky-500/20 text-sky-200">
                  Review Open
                </Badge>
              )}
              <div className="hidden h-4 w-px bg-white/20 sm:block" />
              <span className="text-xs text-white/60">
                {stats.approved}/{stats.total} brands approved
              </span>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
              <MetricCard label="Sheets" value={`${reviewState.totalSheets}`} />
              <MetricCard
                label="Approved"
                value={`${reviewState.approvedSheets}/${reviewState.totalSheets}`}
              />
              <MetricCard
                label="Schemas"
                value={`${reviewState.savedSchemas}/${reviewState.totalSheets}`}
              />
              <MetricCard label="Pending" value={`${pendingImportCount}`} />
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
            />
          </div>

          {/* Brand cards grid */}
          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="grid gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredBrands.map((brand) => (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    isSelected={selectedBrandId === brand.id}
                    onClick={() => handleBrandSelect(brand)}
                  />
                ))}
              </AnimatePresence>
            </div>
            {filteredBrands.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <FileSpreadsheet className="h-12 w-12 text-white/20" />
                <p className="mt-4 text-sm text-white/50">No brands found</p>
              </div>
            )}
          </ScrollArea>

          {/* Action buttons */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:mt-6">
            <Button
              type="button"
              size="lg"
              className="h-11 flex-1 rounded-xl bg-white text-slate-950 hover:bg-white/92"
              onClick={onContinue}
            >
              <Layers3 className="mr-2 h-4 w-4" />
              {coverActionLabel}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-11 flex-1 rounded-xl border-white/20 bg-white/6 text-white hover:bg-white/12 hover:text-white"
              onClick={onImport}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="h-11 rounded-xl text-white/70 hover:bg-white/10 hover:text-white sm:flex-none sm:px-4"
              onClick={onOpenTutorial}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Tutorial</span>
            </Button>
          </div>

          {/* Auth status */}
          <div className="mt-4 space-y-3">
            {!isAuthenticated ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 rounded-xl border-white/20 bg-white/6 hover:bg-white/12"
                onClick={onOpenLogin}
              >
                <LogIn className="h-4 w-4" />
                Sign in with Badge
              </Button>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
                <CheckCircle className="mr-2 inline-block h-4 w-4" />
                Tracking as <span className="font-semibold">{userLabel}</span>
              </div>
            )}

            {importSession && (
              <div className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-100">
                <div className="font-semibold">Resume import</div>
                <div className="mt-0.5 text-xs text-sky-200/80">
                  {importSession.workbookFileName}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Activity Timeline (desktop) */}
        <div className="hidden w-80 shrink-0 lg:block xl:w-96">
          <ActivityTimelineSidebar
            activities={activities}
            onActivityClick={onActivityClick}
            className="h-full"
          />
        </div>
      </div>

      {/* Mobile Activity Timeline Drawer */}
      <AnimatePresence>
        {isMobileTimelineOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMobileTimelineOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-sm lg:hidden"
            >
              <div className="flex h-full flex-col bg-slate-950/95 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">Activity Timeline</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/60 hover:text-white"
                    onClick={() => setIsMobileTimelineOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ActivityTimelineSidebar
                    activities={activities}
                    onActivityClick={(activity) => {
                      onActivityClick?.(activity);
                      setIsMobileTimelineOpen(false);
                    }}
                    className="h-full rounded-none border-0"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
