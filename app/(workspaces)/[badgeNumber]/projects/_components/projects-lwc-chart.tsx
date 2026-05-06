"use client"

import * as React from "react"
import { useRef, useEffect, useMemo } from "react"
import { motion, useInView, useAnimationControls } from "framer-motion"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type LWCChartBucket = "NEW_FLEX" | "ONSKID" | "OFFSKID" | "OTHER"

interface ActiveLWCProject {
  lwcType?: string | null
  dueDate?: string | null
  status?: string | null
}

type ChartStatusFilter = "active" | "pending" | "upcoming" | "complete"

interface ActiveProjectsLWCChartProps extends React.ComponentPropsWithoutRef<"section"> {
  projects: ActiveLWCProject[]
}

interface ColumnData {
  title: string
  value: number
  /** String to prepend before the value (e.g., "$") */
  prependString?: string
  /** String to append after the value (e.g., "%") */
  appendString?: string
  /** Animation duration in seconds */
  animationDuration?: number
  /** Animation delay in seconds */
  animationDelay?: number
  /** ClassName applied to the animated column bar element */
  className?: string
  /** ClassName applied to the column's top border */
  topBorderClassName?: string
  /** ClassName applied to this column's title (overrides global titleClassName) */
  titleClassName?: string
  /** ClassName applied to this column's value (overrides global valueClassName) */
  valueClassName?: string
}

const LWC_BUCKET_META: Record<LWCChartBucket, { label: string; className: string; topBorderClassName: string }> = {
  NEW_FLEX: {
    label: "NEW / FLEX",
    className: "bg-green-500/20",
    topBorderClassName: "border-green-600/70",
  },
  ONSKID: {
    label: "ON SKID",
    className: "bg-blue-500/20",
    topBorderClassName: "border-blue-600/70",
  },
  OFFSKID: {
    label: "OFF SKID",
    className: "bg-amber-500/20",
    topBorderClassName: "border-amber-600/70",
  },
  OTHER: {
    label: "OTHER",
    className: "bg-slate-500/20",
    topBorderClassName: "border-slate-600/70",
  },
}

const STATUS_META: Record<ChartStatusFilter, { label: string }> = {
  active: { label: "Active" },
  pending: { label: "Pending" },
  upcoming: { label: "Upcoming" },
  complete: { label: "Complete" },
}

function normalizeLwcBucket(value: string | null | undefined): LWCChartBucket {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_")

  if (normalized === "NEW_FLEX" || normalized === "NEWFLEX" || normalized === "FLEX" || normalized === "NEW") {
    return "NEW_FLEX"
  }
  if (normalized === "ONSKID" || normalized === "ON_SKID") {
    return "ONSKID"
  }
  if (normalized === "OFFSKID" || normalized === "OFF_SKID") {
    return "OFFSKID"
  }
  return "OTHER"
}

function extractMonthKey(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const isoMonth = raw.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(isoMonth)) return null
  return isoMonth
}

function normalizeProjectStatus(value: string | null | undefined): "active" | "pending" | "complete" | "unknown" {
  const normalized = (value ?? "").trim().toLowerCase()
  // brandlist / branding / kitting are in-progress stages → treated as active
  if (normalized === "active" || normalized === "brandlist" || normalized === "branding" || normalized === "kitting") return "active"
  if (normalized === "pending" || normalized === "legals_pending") return "pending"
  if (normalized === "complete") return "complete"
  return "unknown"
}

function getCurrentAndNextMonthKeys(): { currentMonthKey: string; nextMonthKey: string } {
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`
  return { currentMonthKey, nextMonthKey }
}

function matchesStatusFilter(project: ActiveLWCProject, statusFilter: ChartStatusFilter): boolean {
  const normalizedStatus = normalizeProjectStatus(project.status)
  if (statusFilter === "active") return normalizedStatus === "active"
  if (statusFilter === "pending") return normalizedStatus === "pending"
  if (statusFilter === "complete") return normalizedStatus === "complete"

  const monthKey = extractMonthKey(project.dueDate)
  if (!monthKey) return false
  const { currentMonthKey, nextMonthKey } = getCurrentAndNextMonthKeys()
  return (monthKey === currentMonthKey || monthKey === nextMonthKey) && normalizedStatus !== "complete"
}

function formatMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return monthKey
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date)
}

function ActiveProjectsLWCChart({ projects, className, ...props }: ActiveProjectsLWCChartProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<ChartStatusFilter>("active")

  const statusFilteredProjects = useMemo(() => {
    return projects.filter((project) => matchesStatusFilter(project, selectedStatus))
  }, [projects, selectedStatus])

  const monthOptions = useMemo(() => {
    const monthSet = new Set<string>()
    statusFilteredProjects.forEach((project) => {
      const month = extractMonthKey(project.dueDate)
      if (month) {
        monthSet.add(month)
      }
    })
    return Array.from(monthSet).sort()
  }, [statusFilteredProjects])

  const [selectedMonth, setSelectedMonth] = React.useState<string>("all")

  useEffect(() => {
    if (selectedMonth === "all") return
    if (!monthOptions.includes(selectedMonth)) {
      setSelectedMonth("all")
    }
  }, [monthOptions, selectedMonth])

  const filteredProjects = useMemo(() => {
    if (selectedMonth === "all") return statusFilteredProjects
    return statusFilteredProjects.filter((project) => extractMonthKey(project.dueDate) === selectedMonth)
  }, [statusFilteredProjects, selectedMonth])

  const columns = useMemo<ColumnData[]>(() => {
    const counts: Record<LWCChartBucket, number> = {
      NEW_FLEX: 0,
      ONSKID: 0,
      OFFSKID: 0,
      OTHER: 0,
    }

    filteredProjects.forEach((project) => {
      const bucket = normalizeLwcBucket(project.lwcType)
      counts[bucket] += 1
    })

    const order: LWCChartBucket[] = ["NEW_FLEX", "ONSKID", "OFFSKID", "OTHER"]
    return order.map((bucket) => ({
      title: LWC_BUCKET_META[bucket].label,
      value: counts[bucket],
      className: LWC_BUCKET_META[bucket].className,
      topBorderClassName: LWC_BUCKET_META[bucket].topBorderClassName,
      animationDelay: 0.08,
      animationDuration: 0.8,
    }))
  }, [filteredProjects])

  const maxValue = useMemo(() => {
    const maxColumnValue = Math.max(...columns.map((column) => column.value), 0)
    return Math.max(maxColumnValue, 1)
  }, [columns])

  return (
    <section className={cn("rounded-lg border border-border bg-card p-3", className)} {...props}>
      <div className="mb-3 flex items-start justify-between gap-3">
        {/* Title — always visible, never truncated by controls */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Projects by LWC</p>
          <p className="text-xs text-muted-foreground">
            {STATUS_META[selectedStatus].label}
            {" · "}
            {selectedMonth === "all" ? "All due months" : formatMonthLabel(selectedMonth)}
            {" · "}
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Unified filter pill: month picker + status toggle */}
        <div className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-input bg-background">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 min-w-[7.5rem] gap-1 rounded-none border-0 px-3 text-xs shadow-none focus:ring-0">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="my-1.5 w-px bg-border" />

          {(Object.keys(STATUS_META) as ChartStatusFilter[]).map((statusKey) => (
            <button
              key={statusKey}
              type="button"
              onClick={() => setSelectedStatus(statusKey)}
              className={cn(
                "h-8 px-3 text-xs font-medium transition-colors",
                selectedStatus === statusKey
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {STATUS_META[statusKey].label}
            </button>
          ))}
        </div>
      </div>

      <ProjectLWCChart
        columns={columns}
        maxValue={maxValue}
        restartOnDataChange
        className="h-48 overflow-hidden rounded-md"
        titleClassName="text-xs"
        valueClassName="text-sm font-semibold"
      />
    </section>
  )
}

interface ProjectLWCChartProps extends React.ComponentPropsWithoutRef<"div"> {
  columns: ColumnData[]
  maxValue: number
  /** ClassName applied to all column titles */
  titleClassName?: string
  /** ClassName applied to all column values */
  valueClassName?: string
  /** When true, columns animate from zero whenever data changes. Default: false */
  restartOnDataChange?: boolean
}

interface ProjectLWCChartColumnProps extends React.ComponentPropsWithoutRef<"div"> {
  title: string
  value: number
  maxValue: number
  prependString?: string
  appendString?: string
  animationDuration: number
  animationDelay: number
  columnClassName?: string
  topBorderClassName?: string
  /** Global titleClassName from parent */
  globalTitleClassName?: string
  /** Global valueClassName from parent */
  globalValueClassName?: string
  /** Column-specific titleClassName (overrides global) */
  columnTitleClassName?: string
  /** Column-specific valueClassName (overrides global) */
  columnValueClassName?: string
  isInView: boolean
  isLast: boolean
  restartTrigger: number
}

function ProjectLWCChartColumn({
  title,
  value,
  maxValue,
  prependString,
  appendString,
  animationDuration,
  animationDelay,
  columnClassName,
  topBorderClassName,
  globalTitleClassName,
  globalValueClassName,
  columnTitleClassName,
  columnValueClassName,
  isInView,
  isLast,
  restartTrigger,
  className,
  ...props
}: ProjectLWCChartColumnProps) {
  const heightPercentage = (value / maxValue) * 100
  const heightPercentageRef = useRef(heightPercentage)
  heightPercentageRef.current = heightPercentage

  const barControls = useAnimationControls()
  const valueControls = useAnimationControls()

  // Handle animation when in view or when restart is triggered
  useEffect(() => {
    const animateFromZero = async () => {
      // Stop any running animations first
      barControls.stop()
      valueControls.stop()

      // Reset to zero instantly
      barControls.set({ height: 0 })
      valueControls.set({ opacity: 0 })

      // Small delay to ensure the reset is rendered before animating
      await new Promise(resolve => requestAnimationFrame(resolve))

      // Animate to target values
      if (isInView) {
        barControls.start({
          height: `${heightPercentageRef.current}%`,
          transition: {
            type: "spring",
            damping: 25,
            stiffness: 50,
            delay: animationDelay,
          },
        })

        valueControls.start({
          opacity: 1,
          transition: {
            delay: animationDelay + animationDuration * 0.5,
            duration: 0.3,
          },
        })
      }
    }

    animateFromZero()
  }, [restartTrigger, isInView, animationDelay, animationDuration, barControls, valueControls])

  return (
    <div
      data-slot="animated-charts-column"
      className={cn("relative flex-1 flex flex-col", !isLast && "border-r", className)}
      {...props}
    >
      {/* Title — in its own row so the bar never overlaps it */}
      <div data-slot="animated-charts-column-title-wrapper" className="shrink-0 px-3 pt-2 pb-1">
        <span
          data-slot="animated-charts-column-title"
          className={cn("text-base font-normal text-foreground/50", globalTitleClassName, columnTitleClassName)}
        >
          {title}
        </span>
      </div>

      {/* Bar container - takes remaining space and aligns bar to bottom */}
      <div className="relative flex-1 flex flex-col justify-end border-t border-border/10">
        {/* Column bar */}
        <motion.div
          data-slot="animated-charts-column-bar"
          className={cn("relative w-full border-t-2 border-border/30 bg-muted/20", columnClassName, topBorderClassName)}
          initial={{ height: 0 }}
          animate={barControls}
        >
          {/* Value anchored at the top-left of the bar */}
          <motion.span
            data-slot="animated-charts-column-value"
            className={cn(
              "absolute top-2 left-3 text-base font-normal text-foreground",
              globalValueClassName,
              columnValueClassName,
            )}
            initial={{ opacity: 0 }}
            animate={valueControls}
          >
            {prependString && `${prependString} `}
            {value}
            {appendString && ` ${appendString}`}
          </motion.span>
        </motion.div>
      </div>
    </div>
  )
}

function ProjectLWCChart({
  columns,
  maxValue,
  titleClassName,
  valueClassName,
  restartOnDataChange = false,
  className,
  ...props
}: ProjectLWCChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })

  // Generate a data signature to detect changes
  const dataSignature = useMemo(() => {
    return JSON.stringify(columns.map(c => ({ title: c.title, value: c.value })))
  }, [columns])

  // Track restart trigger - increments when data changes (if restartOnDataChange is true)
  const restartTriggerRef = useRef(0)
  const prevDataSignatureRef = useRef(dataSignature)

  if (restartOnDataChange && prevDataSignatureRef.current !== dataSignature) {
    restartTriggerRef.current += 1
    prevDataSignatureRef.current = dataSignature
  }

  return (
    <div ref={ref} data-slot="animated-charts" className={cn("flex w-full gap-0 border", className)} {...props}>
      {columns.map((column, index) => (
        <ProjectLWCChartColumn
          key={index}
          title={column.title}
          value={column.value}
          maxValue={maxValue}
          prependString={column.prependString}
          appendString={column.appendString}
          animationDuration={column.animationDuration ?? 1}
          animationDelay={column.animationDelay ?? 0}
          columnClassName={column.className}
          topBorderClassName={column.topBorderClassName}
          globalTitleClassName={titleClassName}
          globalValueClassName={valueClassName}
          columnTitleClassName={column.titleClassName}
          columnValueClassName={column.valueClassName}
          isInView={isInView}
          isLast={index === columns.length - 1}
          restartTrigger={restartTriggerRef.current}
        />
      ))}
    </div>
  )
}

export { ProjectLWCChart, ProjectLWCChartColumn, ActiveProjectsLWCChart }
export type { ProjectLWCChartProps, ProjectLWCChartColumnProps, ColumnData, ActiveLWCProject, ActiveProjectsLWCChartProps }