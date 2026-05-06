"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  X,
  Columns3,
  RotateCcw,
  History,
  Filter,
  Check,
  EyeOff,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarSection } from "@/components/original-wire-list-sidebar/sidebar-section"
import { useOriginalWireListSidebar } from "@/hooks/use-original-wire-list-sidebar"
import { useOriginalWireListRecent } from "@/hooks/use-original-wire-list-recent"
import { resolveProjectAssignmentsByLocations } from "@/lib/green-changes/api"
import {
  SIDEBAR_COLUMNS,
  type OriginalRowMatchState,
} from "@/lib/original-wire-list-sidebar"
import type { SemanticWireListRow } from "@/lib/workbook/types"

interface RevisionWireListPanelProps {
  rows: SemanticWireListRow[]
  projectId: string
  sheetName: string
  activeRowId?: string | null
  onScrollToRow?: (rowId: string) => void
}

const MATCH_STATE_META: Record<OriginalRowMatchState, { label: string; icon: typeof Check }> = {
  matched: { label: "Visible", icon: Check },
  hidden: { label: "Hidden", icon: EyeOff },
  missing: { label: "Missing", icon: X },
  mismatch: { label: "Mismatch", icon: AlertTriangle },
}

export function RevisionWireListPanel({
  rows,
  projectId,
  sheetName,
  activeRowId = null,
  onScrollToRow,
}: RevisionWireListPanelProps) {
  const [assignmentByLocation, setAssignmentByLocation] = useState<Record<string, {
    stage?: string
    stageLabel?: string
    sheetName?: string
  } | null>>({})

  const greenChangeLocations = useMemo(() => {
    const locations = rows
      .filter((row) => Boolean(row.greenChangeType))
      .map((row) => row.toLocation || row.fromLocation || row.location || "")
      .filter((value) => Boolean(value))

    return Array.from(new Set(locations))
  }, [rows])

  useEffect(() => {
    let cancelled = false

    if (greenChangeLocations.length === 0) {
      setAssignmentByLocation({})
      return () => {
        cancelled = true
      }
    }

    void resolveProjectAssignmentsByLocations(projectId, greenChangeLocations)
      .then((result) => {
        if (!cancelled) {
          setAssignmentByLocation(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignmentByLocation({})
        }
      })

    return () => {
      cancelled = true
    }
  }, [greenChangeLocations, projectId])

  const visibleEnhancedRowIds = new Set(rows.map((row) => row.__rowId))
  const sidebar = useOriginalWireListSidebar({
    originalRows: rows,
    enhancedRows: rows,
    visibleEnhancedRowIds,
    assignmentByLocation,
    projectId,
    sheetName,
  })
  const recent = useOriginalWireListRecent({ projectId, sheetName })

  const handleItemClick = useCallback((originalRowId: string, enhancedRowId?: string) => {
    const item = sidebar.getNavItemByRowId(originalRowId)
    if (!item) {
      return
    }

    recent.addRecent({
      rowId: originalRowId,
      wireNo: item.wireNo,
      fromDeviceId: item.fromDeviceId,
      toDeviceId: item.toDeviceId,
    })

    if (enhancedRowId && item.matchState !== "missing") {
      onScrollToRow?.(enhancedRowId)
    }
  }, [onScrollToRow, recent, sidebar])

  const handleRecentClick = useCallback((rowId: string) => {
    const item = sidebar.getNavItemByRowId(rowId)
    if (item?.matchedEnhancedRowId && item.matchState !== "missing") {
      onScrollToRow?.(item.matchedEnhancedRowId)
    }
  }, [onScrollToRow, sidebar])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={sidebar.searchQuery}
            onChange={(event) => sidebar.setSearchQuery(event.target.value)}
            placeholder="Search original rows..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {sidebar.searchQuery && (
            <button
              type="button"
              onClick={sidebar.clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {recent.recentItems.length > 0 && !sidebar.searchQuery && (
        <div className="border-b border-border px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" />
              Recent
            </span>
            <button
              type="button"
              onClick={recent.clearRecent}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="space-y-0.5">
            {recent.recentItems.slice(0, 5).map((item) => (
              <button
                key={item.rowId}
                type="button"
                onClick={() => handleRecentClick(item.rowId)}
                className="w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-accent/50"
              >
                <span className="font-medium">{item.fromDeviceId}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span>{item.toDeviceId}</span>
                {item.wireNo && <span className="ml-1 text-muted-foreground">({item.wireNo})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">Visible Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SIDEBAR_COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={sidebar.columnVisibility[column.key]}
                onCheckedChange={() => sidebar.toggleColumn(column.key)}
                className="text-xs"
              >
                {column.label} ({column.group})
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem onClick={sidebar.resetColumnVisibility} className="text-xs">
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset to defaults
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">Match State</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sidebar.matchStateFilters) as OriginalRowMatchState[]).map((state) => {
              const Icon = MATCH_STATE_META[state].icon
              return (
                <DropdownMenuCheckboxItem
                  key={state}
                  checked={sidebar.matchStateFilters[state]}
                  onCheckedChange={() => sidebar.toggleMatchStateFilter(state)}
                  className="text-xs"
                >
                  <Icon className="mr-1 h-3 w-3" />
                  {MATCH_STATE_META[state].label}
                </DropdownMenuCheckboxItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem onClick={sidebar.resetMatchStateFilters} className="text-xs">
              <RotateCcw className="mr-1 h-3 w-3" />
              Show all
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto text-xs text-muted-foreground">
          {sidebar.statistics.totalOriginal} rows
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-0">
          {sidebar.sections.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No rows match the current search/filter.
            </div>
          ) : (
            sidebar.sections.map((section, index) => (
              <SidebarSection
                key={section.location}
                section={section}
                columnVisibility={sidebar.columnVisibility}
                activeRowId={activeRowId}
                onItemClick={handleItemClick}
                onToggleCollapse={() => sidebar.toggleSectionCollapsed(section.location)}
                showTableHeader={index === 0}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}