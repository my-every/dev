"use client";

import { useState, useMemo, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Check,
  ChevronDown,
  Clock,
  Search,
  Sparkles,
  Star,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BoardMemberView, BoardCandidateView, BoardAssignmentView } from "@/lib/board/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberQuickPickerProps {
  members: BoardMemberView[];
  candidates?: BoardCandidateView[];
  assignment?: BoardAssignmentView;
  selectedBadge?: string | null;
  onSelect: (badge: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  showRecommendations?: boolean;
  className?: string;
}

type FilterMode = "all" | "available" | "recommended";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAvailabilityConfig(status: BoardMemberView["availabilityStatus"]) {
  switch (status) {
    case "AVAILABLE":
      return { color: "bg-emerald-500", label: "Available", priority: 1 };
    case "ON_ASSIGNMENT":
      return { color: "bg-amber-500", label: "On Assignment", priority: 2 };
    case "OFF_SHIFT":
      return { color: "bg-slate-400", label: "Off Shift", priority: 3 };
    default:
      return { color: "bg-slate-400", label: "Unknown", priority: 4 };
  }
}

function getReadinessConfig(readiness: string) {
  switch (readiness) {
    case "READY":
      return { color: "text-emerald-600", bg: "bg-emerald-50", label: "Ready" };
    case "NEEDS_TRAINING":
      return { color: "text-amber-600", bg: "bg-amber-50", label: "Needs Training" };
    case "NOT_QUALIFIED":
      return { color: "text-red-600", bg: "bg-red-50", label: "Not Qualified" };
    default:
      return { color: "text-slate-600", bg: "bg-slate-50", label: "Unknown" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MemberQuickPicker({
  members,
  candidates,
  assignment,
  selectedBadge,
  onSelect,
  onClear,
  placeholder = "Select member...",
  disabled = false,
  showRecommendations = true,
  className,
}: MemberQuickPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("available");

  const selectedMember = useMemo(
    () => members.find((m) => m.badge === selectedBadge),
    [members, selectedBadge]
  );

  // Build member list with candidate scores if available
  const enrichedMembers = useMemo(() => {
    const candidateMap = new Map(candidates?.map((c) => [c.badge, c]) ?? []);
    return members
      .map((member) => ({
        ...member,
        candidate: candidateMap.get(member.badge),
      }))
      .sort((a, b) => {
        // Sort by: recommended > available > on assignment > off shift
        // Within each group, sort by score if available
        const availA = getAvailabilityConfig(a.availabilityStatus);
        const availB = getAvailabilityConfig(b.availabilityStatus);
        
        // Recommended first
        if (a.candidate?.isRecommended && !b.candidate?.isRecommended) return -1;
        if (!a.candidate?.isRecommended && b.candidate?.isRecommended) return 1;
        
        // Then by availability
        if (availA.priority !== availB.priority) return availA.priority - availB.priority;
        
        // Then by score
        const scoreA = a.candidate?.score ?? 0;
        const scoreB = b.candidate?.score ?? 0;
        return scoreB - scoreA;
      });
  }, [members, candidates]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return enrichedMembers.filter((member) => {
      const matchesSearch =
        !searchQuery ||
        member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.badge.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (filterMode) {
        case "available":
          return member.availabilityStatus === "AVAILABLE";
        case "recommended":
          return member.candidate?.isRecommended;
        default:
          return true;
      }
    });
  }, [enrichedMembers, searchQuery, filterMode]);

  // Stats
  const stats = useMemo(() => ({
    total: members.length,
    available: members.filter((m) => m.availabilityStatus === "AVAILABLE").length,
    recommended: candidates?.filter((c) => c.isRecommended).length ?? 0,
  }), [members, candidates]);

  const handleSelect = useCallback((badge: string) => {
    onSelect(badge);
    setOpen(false);
    setSearchQuery("");
  }, [onSelect]);

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-9 justify-between font-normal",
              !selectedMember && "text-muted-foreground",
              className
            )}
          >
            {selectedMember ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {selectedMember.initials || selectedMember.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
                      getAvailabilityConfig(selectedMember.availabilityStatus).color
                    )}
                  />
                </div>
                <span className="truncate">{selectedMember.fullName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          {/* Header */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or badge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-sm"
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

            {/* Filter Tabs */}
            <div className="mt-2 flex gap-1">
              <FilterTab
                active={filterMode === "all"}
                onClick={() => setFilterMode("all")}
                label="All"
                count={stats.total}
              />
              <FilterTab
                active={filterMode === "available"}
                onClick={() => setFilterMode("available")}
                label="Available"
                count={stats.available}
                icon={<div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              />
              {showRecommendations && stats.recommended > 0 && (
                <FilterTab
                  active={filterMode === "recommended"}
                  onClick={() => setFilterMode("recommended")}
                  label="Best Match"
                  count={stats.recommended}
                  icon={<Sparkles className="h-3 w-3 text-amber-500" />}
                />
              )}
            </div>
          </div>

          {/* Member List */}
          <ScrollArea className="h-64">
            <div className="p-1">
              {filteredMembers.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No members found
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredMembers.map((member) => (
                    <MemberOption
                      key={member.badge}
                      member={member}
                      candidate={member.candidate}
                      isSelected={member.badge === selectedBadge}
                      onSelect={() => handleSelect(member.badge)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          {selectedBadge && onClear && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                <X className="mr-1.5 h-3 w-3" />
                Clear Selection
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}

function FilterTab({ active, onClick, label, count, icon }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
      <span className={cn("text-[10px]", active ? "text-primary/70" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}

interface MemberOptionProps {
  member: BoardMemberView & { candidate?: BoardCandidateView };
  candidate?: BoardCandidateView;
  isSelected: boolean;
  onSelect: () => void;
}

function MemberOption({ member, candidate, isSelected, onSelect }: MemberOptionProps) {
  const availability = getAvailabilityConfig(member.availabilityStatus);
  const readiness = candidate ? getReadinessConfig(candidate.readiness) : null;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
        isSelected
          ? "bg-primary/10"
          : "hover:bg-muted"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {member.initials || member.fullName.slice(0, 2).toUpperCase()}
        </div>
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            availability.color
          )}
        />
        {candidate?.isRecommended && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100">
            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.fullName}</span>
          {isSelected && (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{member.badge}</span>
          <span className="text-muted-foreground/50">|</span>
          <span>{member.role}</span>
        </div>

        {/* Candidate Score/Match Info */}
        {candidate && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {candidate.matchedPartNumbers.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-5 text-[10px] font-normal">
                    <Wrench className="mr-1 h-2.5 w-2.5" />
                    {candidate.partNumberMatchCount} parts
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">Matching parts: {candidate.matchedPartNumbers.slice(0, 5).join(", ")}</p>
                  {candidate.matchedPartNumbers.length > 5 && (
                    <p className="text-xs text-muted-foreground">+{candidate.matchedPartNumbers.length - 5} more</p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
            {candidate.stageAssignmentCount > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] font-normal">
                <Award className="mr-1 h-2.5 w-2.5" />
                {candidate.stageAssignmentCount} similar
              </Badge>
            )}
            {readiness && (
              <Badge
                variant="secondary"
                className={cn("h-5 text-[10px] font-normal", readiness.bg, readiness.color)}
              >
                {readiness.label}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Active Assignments Count */}
      {member.activeAssignments.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-[10px]">
              {member.activeAssignments.length} active
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs font-medium">Active assignments:</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {member.activeAssignments.slice(0, 3).map((a) => (
                <li key={a.assignmentId} className="text-muted-foreground">
                  {a.sheetName} ({a.pdNumber})
                </li>
              ))}
              {member.activeAssignments.length > 3 && (
                <li className="text-muted-foreground">
                  +{member.activeAssignments.length - 3} more
                </li>
              )}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </motion.button>
  );
}

// Missing icon import
function Wrench({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
