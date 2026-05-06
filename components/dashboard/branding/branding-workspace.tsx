"use client";

import { useState, useMemo, useCallback, type ReactNode, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  MessageSquare,
  MoreHorizontal,
  Search,
  Shield,
  Tag,
  User,
  Zap,
  AlertCircle,
  Activity,
  LayoutGrid,
  List,
  Settings2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AnimatedTabs from "@/components/ui/animated-tabs";
import type { ActivityEntry, ActivityAction } from "@/types/activity";

// ============================================================================
// Types
// ============================================================================

export interface BrandItem {
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

export interface BrandingWorkspaceStats {
  totalBrands: number;
  approvedBrands: number;
  pendingBrands: number;
  totalSheets: number;
  approvedSheets: number;
  totalWires: number;
}

export type BrandingWorkspaceTab = "overview" | "brands" | "activity" | "settings";

export interface BrandingWorkspaceProps {
  /** Unique identifier for the workspace (e.g., project ID) */
  workspaceId: string;
  /** Display title for the workspace */
  title?: string;
  /** Description shown below the title */
  description?: string;
  /** List of brands to display */
  brands: BrandItem[];
  /** Activity timeline entries */
  activities: ActivityEntry[];
  /** Pre-computed statistics (optional, will calculate from brands if not provided) */
  stats?: BrandingWorkspaceStats;
  /** Whether the workspace is in a ready/completed state */
  isReady?: boolean;
  /** Current authenticated user info */
  currentUser?: {
    badge: string;
    name: string;
  };
  /** Base URL path for routing (e.g., "/projects/123/branding") */
  basePath: string;
  /** Callback when a brand is selected */
  onSelectBrand?: (brand: BrandItem) => void;
  /** Callback when view action is clicked */
  onView?: () => void;
  /** Callback when import action is clicked */
  onImport?: () => void;
  /** Callback when an activity item is clicked */
  onActivityClick?: (activity: ActivityEntry) => void;
  /** Custom actions to render in the header */
  headerActions?: ReactNode;
  /** Custom content for the settings tab */
  settingsContent?: ReactNode;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getActivityIcon(action: ActivityAction) {
  switch (action) {
    case "COMPLETED":
      return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" };
    case "ASSIGNED":
    case "STARTED":
      return { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" };
    case "BLOCKED":
      return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" };
    case "UNBLOCKED":
    case "REOPENED":
      return { icon: CheckCircle, color: "text-sky-500", bg: "bg-sky-500/10" };
    case "REASSIGNED":
      return { icon: User, color: "text-orange-500", bg: "bg-orange-500/10" };
    case "STAGE_CHANGED":
      return { icon: Clock, color: "text-violet-500", bg: "bg-violet-500/10" };
    default:
      return { icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted/50" };
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

function getStatusStyle(status: BrandItem["status"]) {
  switch (status) {
    case "approved":
      return { border: "border-emerald-500/30", bg: "bg-emerald-500/5", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "pending":
      return { border: "border-amber-500/30", bg: "bg-amber-500/5", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case "in-progress":
      return { border: "border-sky-500/30", bg: "bg-sky-500/5", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
    case "error":
      return { border: "border-red-500/30", bg: "bg-red-500/5", badge: "bg-red-500/15 text-red-600 dark:text-red-400" };
    default:
      return { border: "border-border", bg: "bg-muted/30", badge: "bg-muted text-muted-foreground" };
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BrandCard({
  brand,
  isSelected,
  onClick,
  viewMode = "grid",
}: {
  brand: BrandItem;
  isSelected: boolean;
  onClick: () => void;
  viewMode?: "grid" | "list";
}) {
  const progress = brand.sheetCount > 0
    ? Math.round((brand.approvedCount / brand.sheetCount) * 100)
    : 0;
  const style = getStatusStyle(brand.status);

  if (viewMode === "list") {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-all",
          "hover:bg-accent/50",
          isSelected ? "border-primary ring-1 ring-primary/30 bg-primary/5" : style.border
        )}
        whileTap={{ scale: 0.995 }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: brand.color ?? "hsl(var(--primary))" }}
        >
          {brand.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{brand.name}</h3>
            <Badge variant="outline" className={cn("text-[10px] capitalize", style.badge)}>
              {brand.status.replace("-", " ")}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{brand.slug}</p>
        </div>
        <div className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex">
          <span>{brand.approvedCount}/{brand.sheetCount} sheets</span>
          <span>{brand.totalWires} wires</span>
        </div>
        <div className="w-20 shrink-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                brand.status === "approved" ? "bg-emerald-500" :
                brand.status === "error" ? "bg-red-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">{progress}%</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col rounded-2xl border p-4 text-left transition-all",
        "hover:shadow-sm",
        isSelected ? "border-primary ring-1 ring-primary/30 bg-primary/5" : cn(style.border, style.bg)
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: brand.color ?? "hsl(var(--primary))" }}
          >
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{brand.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{brand.slug}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-[10px] capitalize", style.badge)}>
          {brand.status.replace("-", " ")}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{brand.approvedCount}/{brand.sheetCount} sheets</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>{brand.totalWires} wires</span>
        </div>
        {brand.assignee && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border">
                  <AvatarImage src={brand.assignee.avatarUrl} />
                  <AvatarFallback className="text-[10px]">
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
    </motion.button>
  );
}

function ActivityTimelineItem({
  activity,
  onClick,
}: {
  activity: ActivityEntry;
  onClick?: () => void;
}) {
  const { icon: Icon, color, bg } = getActivityIcon(activity.action);
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent/50"
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{getActionLabel(activity.action)}</span>
          {activity.result && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0",
                activity.result === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : activity.result === "failure"
                  ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {activity.result}
            </Badge>
          )}
        </div>
        {activity.comment && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{activity.comment}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          {activity.performedBy && <span>Badge #{activity.performedBy}</span>}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </button>
  );
}

function ActivitySidePanel({
  activities,
  onActivityClick,
}: {
  activities: ActivityEntry[];
  onActivityClick?: (activity: ActivityEntry) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<ActivityAction | "all">("all");

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
          getActionLabel(a.action).toLowerCase().includes(search)
      );
    }
    return result.slice(0, 50);
  }, [activities, filterAction, searchTerm]);

  const actionTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.action));
    return Array.from(types).sort();
  }, [activities]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" />
          Activity Timeline
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {activities.length}
          </Badge>
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-between text-xs"
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
            <DropdownMenuSeparator />
            {actionTypes.map((action) => (
              <DropdownMenuItem key={action} onClick={() => setFilterAction(action)}>
                {getActionLabel(action)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No activities found</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <ActivityTimelineItem
                key={activity.id}
                activity={activity}
                onClick={() => onActivityClick?.(activity)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BrandingWorkspace({
  workspaceId,
  title = "Branding Workspace",
  description = "Review and manage brand lists across your projects.",
  brands,
  activities,
  stats: propStats,
  isReady = false,
  currentUser,
  basePath,
  onSelectBrand,
  onView,
  onImport,
  onActivityClick,
  headerActions,
  settingsContent,
  className,
}: BrandingWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<BrandItem["status"] | "all">("all");

  const activeTab = (searchParams.get("tab") as BrandingWorkspaceTab) || "overview";

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "brands", label: "Brands" },
      { id: "activity", label: "Activity" },
      { id: "settings", label: "Settings" },
    ],
    []
  );

  const handleTabChange = useCallback(
    (tabId: string) => {
      router.replace(`${basePath}?tab=${encodeURIComponent(tabId)}`);
    },
    [router, basePath]
  );

  const stats = useMemo<BrandingWorkspaceStats>(() => {
    if (propStats) return propStats;
    const brandsList = brands ?? [];
    const approved = brandsList.filter((b) => b.status === "approved").length;
    const pending = brandsList.filter((b) => b.status === "pending" || b.status === "in-progress").length;
    const totalSheets = brandsList.reduce((sum, b) => sum + b.sheetCount, 0);
    const approvedSheets = brandsList.reduce((sum, b) => sum + b.approvedCount, 0);
    const totalWires = brandsList.reduce((sum, b) => sum + b.totalWires, 0);
    return {
      totalBrands: brandsList.length,
      approvedBrands: approved,
      pendingBrands: pending,
      totalSheets,
      approvedSheets,
      totalWires,
    };
  }, [brands, propStats]);

  const filteredBrands = useMemo(() => {
    let result = [...(brands ?? [])];
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.slug.toLowerCase().includes(search)
      );
    }
    return result;
  }, [brands, statusFilter, searchTerm]);

  const handleBrandSelect = useCallback(
    (brand: BrandItem) => {
      setSelectedBrandId(brand.id);
      onSelectBrand?.(brand);
    },
    [onSelectBrand]
  );

  const activitySidePanel = (
    <ActivitySidePanel
      activities={activities}
      onActivityClick={onActivityClick}
    />
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="shrink-0 space-y-4 border-b px-4 pb-4 pt-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {isReady && (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Ready
                </Badge>
              )}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            {onView && (
              <Button onClick={onView} size="sm">
                <Layers3 className="mr-1.5 h-4 w-4" />
                View
              </Button>
            )}
            {onImport && (
              <Button onClick={onImport} variant="outline" size="sm">
                <FileUp className="mr-1.5 h-4 w-4" />
                Import
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid - Overview only */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <StatCard icon={Tag} label="Brands" value={stats.totalBrands} />
            <StatCard icon={CheckCircle} label="Approved" value={stats.approvedBrands} />
            <StatCard icon={Clock} label="Pending" value={stats.pendingBrands} />
            <StatCard icon={FileSpreadsheet} label="Sheets" value={`${stats.approvedSheets}/${stats.totalSheets}`} />
            <StatCard icon={Layers3} label="Wires" value={stats.totalWires.toLocaleString()} />
            <StatCard icon={Activity} label="Activities" value={activities.length} />
          </div>
        )}

        {/* Tabs */}
        <div className="sticky top-0 z-10 -mx-1">
          <AnimatedTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="pill"
            layoutId={`branding-workspace-${workspaceId}-tabs`}
          />
        </div>

        {/* Filters - Brands tab only */}
        {activeTab === "brands" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search brands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  {statusFilter === "all" ? "All Status" : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("approved")}>Approved</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("in-progress")}>In Progress</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("error")}>Error</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={cn(
        "flex min-h-0 flex-1 gap-4 overflow-hidden p-4 md:p-6",
        (activeTab === "overview" || activeTab === "brands") && "xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]"
      )}>
        <ScrollArea className="min-h-0 flex-1">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold">Recent Brands</h3>
                <div className={cn(
                  viewMode === "grid"
                    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "flex flex-col gap-2"
                )}>
                  {brands.slice(0, 6).map((brand) => (
                    <BrandCard
                      key={brand.id}
                      brand={brand}
                      isSelected={selectedBrandId === brand.id}
                      onClick={() => handleBrandSelect(brand)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
                {brands.length > 6 && (
                  <Button
                    variant="ghost"
                    className="mt-4 w-full"
                    onClick={() => handleTabChange("brands")}
                  >
                    View all {brands.length} brands
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Brands Tab */}
          {activeTab === "brands" && (
            <div className={cn(
              viewMode === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
                : "flex flex-col gap-2"
            )}>
              {filteredBrands.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Tag className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-4 text-sm text-muted-foreground">No brands found</p>
                </div>
              ) : (
                filteredBrands.map((brand) => (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    isSelected={selectedBrandId === brand.id}
                    onClick={() => handleBrandSelect(brand)}
                    viewMode={viewMode}
                  />
                ))
              )}
            </div>
          )}

          {/* Activity Tab (full width) */}
          {activeTab === "activity" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {activities.slice(0, 20).map((activity) => (
                <ActivityTimelineItem
                  key={activity.id}
                  activity={activity}
                  onClick={() => onActivityClick?.(activity)}
                />
              ))}
              {activities.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-4 text-sm text-muted-foreground">No activities yet</p>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {settingsContent ?? (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings2 className="h-4 w-4" />
                      Workspace Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure your branding workspace preferences here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Right Panel - Activity Sidebar (visible on overview/brands tabs, desktop only) */}
        {(activeTab === "overview" || activeTab === "brands") && (
          <div className="hidden min-h-0 overflow-hidden rounded-2xl border bg-card/70 xl:flex xl:flex-col">
            {activitySidePanel}
          </div>
        )}
      </div>
    </div>
  );
}
