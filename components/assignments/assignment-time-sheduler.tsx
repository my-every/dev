"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Minus, Plus } from "lucide-react";

import { WorkLogTable, type WorkLogCellEdit, type WorkLogTableColumn } from "@/components/assignments/work-log-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatTime12Hour,
  Timeline,
  TimelineCurrentTime,
  TimelineGrid,
  TimelineHeader,
  TimelineProvider,
  TimelineRow,
  TimelineSlot,
  TimelineSlotContent,
  TimelineSlotData,
  TimelineSlotLabel,
  TimelineRowData,
  minutesToTime,
  timeToMinutes,
  useTimeline,
} from "@/components/ui/timeline";
import {
  FLOOR_AREAS,
  FLOOR_AREA_META,
  FLOOR_STATIONS,
  FloorArea,
  StationDefinition,
  STAGE_ESTIMATES,
} from "@/types/floor-layout";
import { cn } from "@/lib/utils";

type SelectedArea = FloorArea | "ALL";
type DayType = "weekday" | "weekend";
type ShiftType = "overtime" | "production";
type EditableSlotField = "assignmentLabel" | "member" | "stage" | "startTime" | "duration";

interface ShiftBand {
  startHour: number;
  startMinute?: number;
  endHour: number;
  endMinute?: number;
  type: ShiftType;
  label: string;
}

type AreaRowData = TimelineRowData & {
  shortLabel?: string;
  category?: string;
  isDivider?: boolean;
};

type SchedulerSlot = TimelineSlotData & {
  assignmentId?: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  assignmentLabel?: string;
  member?: string;
  stage?: string;
  status?: string;
  completionPct?: number;
  estimatedMinutes?: number;
};

export interface AssignmentTimeSchedulerProps {
  className?: string;
  title?: string;
  description?: string;
  initialFloorArea?: FloorArea;
  slotsByArea?: Partial<Record<FloorArea, SchedulerSlot[]>>;
  onSlotsChange?: (floorArea: FloorArea, slots: SchedulerSlot[]) => void;
}

const DEFAULT_CONFIG = {
  startHour: 0,
  endHour: 24,
  snapIntervalMinutes: 15,
  columnWidth: 180,
};

const NORMALIZED_BADGE_CLASS = "h-5 rounded-full px-2 text-[10px] font-semibold leading-none";
const DEFAULT_SLOT_COLOR = "#0ea5e9";

const WEEKDAY_SHIFTS: ShiftBand[] = [
  { startHour: 4, endHour: 6, type: "overtime", label: "OT" },
  { startHour: 6, endHour: 14, endMinute: 30, type: "production", label: "1st Shift" },
  { startHour: 15, endHour: 23, type: "production", label: "2nd Shift" },
];

const WEEKEND_SHIFTS: ShiftBand[] = [{ startHour: 4, endHour: 17, type: "overtime", label: "Weekend OT" }];

const SHIFT_COLORS: Record<ShiftType, { bg: string; strip: string; text: string; border: string }> = {
  overtime: {
    bg: "bg-amber-400/[0.07]",
    strip: "bg-amber-400/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-400/40",
  },
  production: {
    bg: "bg-sky-400/[0.06]",
    strip: "bg-sky-400/15",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-400/40",
  },
};

function createDefaultSlots(stations: StationDefinition[]): SchedulerSlot[] {
  const slotCount = Math.min(5, stations.length);
  const baseStartMinutes = 7 * 60;
  const stageCycle = ["BUILD_UP", "WIRING", "BOX_BUILD", "CROSS_WIRE", "TEST_1ST_PASS"];
  const colors = ["#0ea5e9", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];

  return stations.slice(0, slotCount).map((station, index) => ({
    stage: stageCycle[index % stageCycle.length],
    id: `${station.id}-slot-${index + 1}`,
    rowId: station.id,
    startTime: minutesToTime(baseStartMinutes + index * 60),
    duration: 90,
    estimatedMinutes: STAGE_ESTIMATES[stageCycle[index % stageCycle.length]]?.estimatedMinutes ?? 180,
    assignmentLabel: `Assignment ${index + 1}`,
    member: `Member ${index + 1}`,
    projectId: `P-${index + 1}`,
    projectName: `Project ${index + 1}`,
    projectColor: colors[index % colors.length],
  }));
}

function getEstimatedMinutes(slot: SchedulerSlot): number {
  if (typeof slot.estimatedMinutes === "number" && Number.isFinite(slot.estimatedMinutes)) {
    return slot.estimatedMinutes;
  }
  if (typeof slot.stage === "string") {
    return STAGE_ESTIMATES[slot.stage]?.estimatedMinutes ?? slot.duration;
  }
  return slot.duration;
}

function getForecastExtensionPercent(slot: SchedulerSlot): number {
  const estimated = getEstimatedMinutes(slot);
  const actual = Math.max(slot.duration, 15);
  const extension = ((estimated - actual) / actual) * 100;
  return Math.max(0, Math.min(extension, 900));
}

function clampToTimeline(startTime: string, durationMinutes: number): string {
  const rawMinutes = timeToMinutes(startTime);
  const minMinutes = DEFAULT_CONFIG.startHour * 60;
  const maxStart = DEFAULT_CONFIG.endHour * 60 - Math.max(durationMinutes, 15);
  const clamped = Math.max(minMinutes, Math.min(maxStart, rawMinutes));
  return minutesToTime(clamped);
}

function buildRowAreaMap(): Map<string, FloorArea> {
  const map = new Map<string, FloorArea>();
  for (const area of FLOOR_AREAS) {
    for (const station of FLOOR_STATIONS[area]) {
      map.set(station.id, area);
    }
  }
  return map;
}

const ROW_AREA_MAP = buildRowAreaMap();

function getBandPixels(band: ShiftBand, startHour: number, pixelsPerMinute: number) {
  const bandStartMin = band.startHour * 60 + (band.startMinute ?? 0);
  const bandEndMin = band.endHour * 60 + (band.endMinute ?? 0);
  const left = (bandStartMin - startHour * 60) * pixelsPerMinute;
  const width = (bandEndMin - bandStartMin) * pixelsPerMinute;
  return { left, width };
}

function getShiftWindow(dayType: DayType) {
  const shifts = dayType === "weekday" ? WEEKDAY_SHIFTS : WEEKEND_SHIFTS;
  const startMinutes = Math.min(...shifts.map((shift) => shift.startHour * 60 + (shift.startMinute ?? 0)));
  const endMinutes = Math.max(...shifts.map((shift) => shift.endHour * 60 + (shift.endMinute ?? 0)));

  return {
    startHour: Math.floor(startMinutes / 60),
    endHour: Math.ceil(endMinutes / 60),
  };
}

const ZOOM_STEPS = [100, 75, 50, 35, 25] as const;
type ZoomStep = (typeof ZOOM_STEPS)[number];

function zoomLabel(piv: number) {
  return `${Math.round(100 / piv)}x`;
}

const AREA_TABS: { value: SelectedArea; label: string }[] = [
  { value: "ALL", label: "All" },
  ...FLOOR_AREAS.map((area) => ({ value: area as SelectedArea, label: FLOOR_AREA_META[area].label })),
];

function ShiftBackgroundOverlay({ dayType }: { dayType: DayType }) {
  const { config, pixelsPerMinute } = useTimeline();
  const columnWidth = config.columnWidth ?? 112;
  const shifts = dayType === "weekday" ? WEEKDAY_SHIFTS : WEEKEND_SHIFTS;

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {shifts.map((band, i) => {
        const { left, width } = getBandPixels(band, config.startHour, pixelsPerMinute);
        return (
          <div
            key={i}
            className={cn("absolute top-0 bottom-0", SHIFT_COLORS[band.type].bg)}
            style={{ left: `${columnWidth + left}px`, width: `${width}px` }}
          />
        );
      })}
    </div>
  );
}

function ShiftBandsStrip({ dayType }: { dayType: DayType }) {
  const { config, pixelsPerMinute } = useTimeline();
  const columnWidth = config.columnWidth ?? 112;
  const shifts = dayType === "weekday" ? WEEKDAY_SHIFTS : WEEKEND_SHIFTS;
  const totalWidth = (config.endHour - config.startHour) * 60 * pixelsPerMinute;

  return (
    <div className="sticky top-12 z-9 flex h-7 shrink-0 border-b bg-background/90 backdrop-blur-sm">
      <div className="sticky left-0 z-5 flex shrink-0 items-center border-r bg-background/90 px-3" style={{ width: `${columnWidth}px` }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Shifts</span>
      </div>
      <div className="relative flex-1" style={{ minWidth: `${totalWidth}px` }}>
        {shifts.map((band, i) => {
          const { left, width } = getBandPixels(band, config.startHour, pixelsPerMinute);
          const colors = SHIFT_COLORS[band.type];
          return (
            <div
              key={i}
              className={cn(
                "absolute inset-y-0 flex items-center justify-center border-x px-1 text-[10px] font-semibold tracking-tight",
                colors.strip,
                colors.text,
                colors.border,
              )}
              style={{ left: `${left}px`, width: `${width}px` }}
            >
              <span className="truncate">{band.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ZoomControls({ percentageInView, onChange }: { percentageInView: number; onChange: (v: ZoomStep) => void }) {
  const idx = ZOOM_STEPS.indexOf(percentageInView as ZoomStep);
  const canOut = idx > 0;
  const canIn = idx < ZOOM_STEPS.length - 1;

  return (
    <div className="flex items-center overflow-hidden rounded-md border text-xs">
      <button
        type="button"
        disabled={!canOut}
        onClick={() => onChange(ZOOM_STEPS[idx - 1])}
        className="px-2 py-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
        aria-label="Zoom out"
      >
        <Minus className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => onChange(100)} title="Reset zoom" className="min-w-8 px-1 py-1 font-mono font-semibold text-muted-foreground transition-colors hover:bg-muted">
        {zoomLabel(percentageInView)}
      </button>
      <button
        type="button"
        disabled={!canIn}
        onClick={() => onChange(ZOOM_STEPS[idx + 1])}
        className="px-2 py-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-35"
        aria-label="Zoom in"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function EditableCell({ label, value, onSave, placeholder }: { label: string; value: string; placeholder?: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="truncate rounded px-1 text-left text-[10px] text-muted-foreground hover:bg-muted/70">
          {value || "-"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <Input value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} className="h-8 text-xs" />
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs" onClick={() => onSave(draft)}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SlotCard({ slot, rowLabel, showForecast }: { slot: SchedulerSlot; rowLabel: string; showForecast: boolean }) {
  const forecastPct = getForecastExtensionPercent(slot);
  const projectColor = slot.projectColor || DEFAULT_SLOT_COLOR;
  const endTime = minutesToTime(timeToMinutes(slot.startTime) + slot.duration);

  return (
    <TimelineSlot slot={slot} className="overflow-visible rounded-lg min-w-28 min-h-24 bg-zinc-100 text-zinc-800 shadow-sm border-2" style={{ borderColor: projectColor }}>
      <div className="relative flex h-full min-w-0 flex-col gap-0.5 rounded-md p-1.5">
        {showForecast && forecastPct > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 left-full z-1 rounded-r-md border-y-2 border-r-2 border-dashed bg-sky-100/30"
            style={{
              width: `${forecastPct}%`,
              borderColor: projectColor,
              backgroundImage: "repeating-linear-gradient(to right, rgba(15,23,42,0.25) 0px, rgba(15,23,42,0.25) 2px, transparent 2px, transparent 16px)",
              backgroundPosition: "bottom",
              backgroundRepeat: "repeat-x",
              backgroundSize: "16px 18px",
            }}
          >
            <div className="absolute right-3 bottom-2 text-[10px] font-medium text-zinc-500">Est. {Math.max(1, Math.round(getEstimatedMinutes(slot) / 60))} hrs</div>
          </div>
        )}

        <div className="flex min-w-0 items-center justify-between gap-1">
          <Badge variant="solid" className="h-5 rounded-full px-2 text-[10px]" style={{ backgroundColor: projectColor }}>
            {slot.projectId ?? "Project"}
          </Badge>
          <Badge variant="dot" className={cn(NORMALIZED_BADGE_CLASS, "shrink-0 border-zinc-300 bg-zinc-50 text-zinc-700")}>
            {slot.status ?? "NS"}
          </Badge>
        </div>

        <TimelineSlotLabel className="truncate text-[11px] font-bold uppercase leading-tight tracking-tight text-zinc-800">
          {slot.assignmentLabel ?? slot.id}
        </TimelineSlotLabel>

        <TimelineSlotContent className="truncate text-[10px] font-semibold uppercase text-sky-600">
          {typeof slot.stage === "string" ? slot.stage.replace(/_/g, " ") : rowLabel}
        </TimelineSlotContent>

        <TimelineSlotContent className="truncate text-[10px] text-zinc-500">{slot.member ?? "Unassigned"}</TimelineSlotContent>

        <div className="mt-auto flex min-w-0 items-center justify-between gap-1">
          <span className="shrink-0 font-mono text-[9px] text-zinc-400">{formatTime12Hour(slot.startTime)}-{formatTime12Hour(endTime)}</span>
          <div className="flex min-w-0 items-center gap-1">
            <div className="h-1 w-8 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${typeof slot.completionPct === "number" ? slot.completionPct : 0}%` }} />
            </div>
            <span className="shrink-0 text-[9px] tabular-nums text-zinc-400">{typeof slot.completionPct === "number" ? slot.completionPct : 0}%</span>
          </div>
        </div>
      </div>
    </TimelineSlot>
  );
}

function ShiftLegend({ dayType }: { dayType: DayType }) {
  const shifts = dayType === "weekday" ? WEEKDAY_SHIFTS : WEEKEND_SHIFTS;
  const unique = [...new Map(shifts.map((s) => [s.type, s])).values()];
  return (
    <div className="flex items-center gap-3">
      {unique.map((band) => (
        <span key={band.type} className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className={cn("inline-block h-2 w-3 rounded-sm border", SHIFT_COLORS[band.type].strip, SHIFT_COLORS[band.type].border)} />
          {band.type === "overtime" ? "Overtime" : "Production"}
        </span>
      ))}
    </div>
  );
}

function getDayType(date: Date): DayType {
  const day = date.getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export function AssignmentTimeScheduler({
  className,
  title = "Assignment Time Scheduler",
  description = "Drag assignments across stations and time windows.",
  initialFloorArea = "NEW_FLEX",
  slotsByArea,
  onSlotsChange,
}: AssignmentTimeSchedulerProps) {
  const [selectedArea, setSelectedArea] = useState<SelectedArea>(initialFloorArea);
  const [showAssignmentForecast, setShowAssignmentForecast] = useState(true);
  const [showSwsLog, setShowSwsLog] = useState(false);
  const [showFullDay, setShowFullDay] = useState(false);
  const [dayType, setDayType] = useState<DayType>(() => getDayType(new Date()));
  const [percentageInView, setPercentageInView] = useState<ZoomStep>(100);
  const [worklogFilter, setWorklogFilter] = useState<"all" | "in-progress" | "done">("all");

  const initialSlots = useMemo<Record<FloorArea, SchedulerSlot[]>>(() => {
    const next = {} as Record<FloorArea, SchedulerSlot[]>;
    for (const area of FLOOR_AREAS) {
      next[area] = slotsByArea?.[area] ?? createDefaultSlots(FLOOR_STATIONS[area]);
    }
    return next;
  }, [slotsByArea]);

  const [slotsState, setSlotsState] = useState<Record<FloorArea, SchedulerSlot[]>>(initialSlots);

  const rows = useMemo<AreaRowData[]>(() => {
    if (selectedArea !== "ALL") {
      return FLOOR_STATIONS[selectedArea].map((s) => ({ id: s.id, label: s.label, shortLabel: s.shortLabel, category: s.category }));
    }
    const result: AreaRowData[] = [];
    for (const area of FLOOR_AREAS) {
      result.push({ id: `__divider__${area}`, label: FLOOR_AREA_META[area].label, isDivider: true });
      for (const station of FLOOR_STATIONS[area]) {
        result.push({ id: station.id, label: station.label, shortLabel: station.shortLabel, category: station.category });
      }
    }
    return result;
  }, [selectedArea]);

  const slots = useMemo<SchedulerSlot[]>(() => {
    if (selectedArea !== "ALL") return slotsState[selectedArea] ?? [];
    return FLOOR_AREAS.flatMap((area) => slotsState[area] ?? []);
  }, [selectedArea, slotsState]);

  const handleSlotPositionChange = async (slotId: string, newTime: string, newRowId: string) => {
    if (newRowId.startsWith("__divider__")) return true;

    setSlotsState((prev) => {
      const sourceArea = selectedArea !== "ALL"
        ? (selectedArea as FloorArea)
        : FLOOR_AREAS.find((a) => prev[a].some((s) => s.id === slotId)) ?? "NEW_FLEX";

      const targetArea = ROW_AREA_MAP.get(newRowId) ?? sourceArea;
      const existingSlot = prev[sourceArea].find((s) => s.id === slotId);
      if (!existingSlot) return prev;

      const updatedSlot: SchedulerSlot = {
        ...existingSlot,
        rowId: newRowId,
        startTime: clampToTimeline(newTime, existingSlot.duration),
      };

      const nextSource = prev[sourceArea].filter((s) => s.id !== slotId);
      const nextTarget =
        sourceArea === targetArea
          ? prev[sourceArea].map((s) => (s.id === slotId ? updatedSlot : s))
          : [...prev[targetArea].filter((s) => s.id !== slotId), updatedSlot];

      const next = {
        ...prev,
        [sourceArea]: sourceArea === targetArea ? nextTarget : nextSource,
        [targetArea]: nextTarget,
      };

      onSlotsChange?.(targetArea, nextTarget);
      return next;
    });

    return true;
  };

  const updateSlotField = (slotId: string, field: EditableSlotField, value: string) => {
    setSlotsState((previous) => {
      const next = { ...previous };
      for (const area of FLOOR_AREAS) {
        next[area] = next[area].map((slot) => {
          if (slot.id !== slotId) return slot;
          if (field === "duration") {
            const parsed = Number(value);
            return { ...slot, duration: Number.isFinite(parsed) ? Math.max(15, parsed) : slot.duration };
          }
          return { ...slot, [field]: value };
        });
      }
      return next;
    });
  };

  const rowSlotMap = useMemo(() => {
    const map = new Map<string, SchedulerSlot[]>();
    for (const slot of slots) {
      const arr = map.get(slot.rowId) ?? [];
      arr.push(slot);
      map.set(slot.rowId, arr);
    }
    return map;
  }, [slots]);

  const shiftWindow = useMemo(() => getShiftWindow(dayType), [dayType]);

  const timelineConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      startHour: showFullDay ? DEFAULT_CONFIG.startHour : shiftWindow.startHour,
      endHour: showFullDay ? DEFAULT_CONFIG.endHour : shiftWindow.endHour,
      columnWidth: showSwsLog ? 320 : 180,
    }),
    [showFullDay, shiftWindow.endHour, shiftWindow.startHour, showSwsLog],
  );
  const timelineHeightClass = "h-full min-h-[420px]";

  const worklogRows = useMemo(() => {
    const rowsData = slots.map((slot) => ({
      id: slot.id,
      project: slot.projectName ?? slot.projectId ?? "Project",
      assignment: slot.assignmentLabel ?? slot.id,
      stage: String(slot.stage ?? "-").replace(/_/g, " "),
      member: slot.member ?? "Unassigned",
      station: slot.rowId,
      start: slot.startTime,
      end: minutesToTime(timeToMinutes(slot.startTime) + slot.duration),
      duration: slot.duration,
      status: slot.status ?? "NS",
    }));
    if (worklogFilter === "in-progress") return rowsData.filter((row) => row.status !== "DONE");
    if (worklogFilter === "done") return rowsData.filter((row) => row.status === "DONE");
    return rowsData;
  }, [slots, worklogFilter]);

  const stageOptions = useMemo(() => {
    const values = new Set<string>();
    worklogRows.forEach((row) => values.add(String(row.stage ?? "-").trim()));
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [worklogRows]);

  const stationOptions = useMemo(() => rows.filter((row) => !row.isDivider).map((row) => row.id), [rows]);
  const statusOptions = useMemo(() => ["NS", "pending", "scheduled", "in-progress", "DONE", "completed"], []);

  const worklogColumns = useMemo<WorkLogTableColumn<(typeof worklogRows)[number]>[]>(() => [
    { key: "project", label: "Project", accessor: (row) => row.project, editable: true, editorType: "text" },
    { key: "assignment", label: "Assignment", accessor: (row) => row.assignment, editable: true, editorType: "text" },
    { key: "stage", label: "Stage", accessor: (row) => row.stage, editable: true, editorType: "select", editorOptions: stageOptions },
    { key: "member", label: "Member", accessor: (row) => row.member, editable: true, editorType: "text" },
    {
      key: "station",
      label: "Station",
      accessor: (row) => row.station,
      editable: true,
      editorType: "select",
      editorOptions: stationOptions,
      hidden: selectedArea !== "ALL",
    },
    { key: "start", label: "Start", accessor: (row) => row.start, editable: true, editorType: "time", cellClassName: "font-mono" },
    { key: "end", label: "End", accessor: (row) => row.end, editable: true, editorType: "time", cellClassName: "font-mono" },
    { key: "duration", label: "Duration", accessor: (row) => `${row.duration}m`, editable: true, editorType: "number" },
    { key: "status", label: "Status", accessor: (row) => row.status, editable: true, editorType: "select", editorOptions: statusOptions },
  ], [selectedArea, stageOptions, stationOptions, statusOptions]);

  const handleWorklogSaveEdits = (edits: WorkLogCellEdit[]) => {
    if (!edits.length) {
      return;
    }

    setSlotsState((previous) => {
      const next = {} as Record<FloorArea, SchedulerSlot[]>;
      for (const area of FLOOR_AREAS) {
        next[area] = [...previous[area]];
      }

      for (const edit of edits) {
        const sourceArea = FLOOR_AREAS.find((area) => next[area].some((slot) => slot.id === edit.rowId));
        if (!sourceArea) {
          continue;
        }

        const sourceIndex = next[sourceArea].findIndex((slot) => slot.id === edit.rowId);
        if (sourceIndex < 0) {
          continue;
        }

        const currentSlot = next[sourceArea][sourceIndex];
        if (!currentSlot) {
          continue;
        }

        let updatedSlot: SchedulerSlot = { ...currentSlot };

        switch (edit.columnKey) {
          case "project":
            updatedSlot.projectName = edit.value;
            break;
          case "assignment":
            updatedSlot.assignmentLabel = edit.value;
            break;
          case "stage":
            updatedSlot.stage = edit.value.toUpperCase().replace(/\s+/g, "_");
            break;
          case "member":
            updatedSlot.member = edit.value;
            break;
          case "start":
            updatedSlot.startTime = clampToTimeline(edit.value || currentSlot.startTime, currentSlot.duration);
            break;
          case "end": {
            const startMinutes = timeToMinutes(currentSlot.startTime);
            const endMinutes = timeToMinutes(edit.value || currentSlot.startTime);
            updatedSlot.duration = Math.max(15, endMinutes - startMinutes);
            break;
          }
          case "duration": {
            const parsed = Number(String(edit.value).replace(/[^0-9.-]/g, ""));
            updatedSlot.duration = Number.isFinite(parsed) ? Math.max(15, parsed) : currentSlot.duration;
            break;
          }
          case "status":
            updatedSlot.status = edit.value;
            break;
          case "station": {
            const targetRowId = edit.value;
            const targetArea = ROW_AREA_MAP.get(targetRowId) ?? sourceArea;
            updatedSlot.rowId = targetRowId;

            if (targetArea === sourceArea) {
              next[sourceArea][sourceIndex] = updatedSlot;
            } else {
              next[sourceArea] = next[sourceArea].filter((slot) => slot.id !== edit.rowId);
              next[targetArea] = [...next[targetArea], updatedSlot];
            }
            continue;
          }
          default:
            break;
        }

        next[sourceArea][sourceIndex] = updatedSlot;
      }

      return next;
    });
  };

  return (
    <section className={cn("flex h-full min-h-0 flex-col gap-3 rounded-lg border bg-card p-4", className)}>
      <div className="rounded-md border bg-background/50 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox id="timeline-show-full-day" checked={showFullDay} onCheckedChange={(checked) => setShowFullDay(Boolean(checked))} />
            <label htmlFor="timeline-show-full-day" className="cursor-pointer">Show full day (12 AM - 12 AM)</label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {AREA_TABS.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={selectedArea === tab.value ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSelectedArea(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {!showFullDay ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Operating window: {formatTime12Hour(`${String(shiftWindow.startHour).padStart(2, "0")}:00`)} - {formatTime12Hour(`${String(shiftWindow.endHour).padStart(2, "0")}:00`)}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        <WorkLogTable
          title="Assignment Worklog"
          description="Timeline-backed assignment logs. Switch to edit mode for inline updates."
          rows={worklogRows}
          columns={worklogColumns}
          rowKey={(row) => row.id}
          showFilters={false}
          onSaveEdits={handleWorklogSaveEdits}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
      <TimelineProvider
        className="flex min-h-0 flex-1 flex-col"
        config={timelineConfig}
        percentageInView={percentageInView}
        onSlotPositionChange={handleSlotPositionChange}
        onValidateDrop={(_, __, newRowId) => !newRowId.startsWith("__divider__")}>

        <Timeline slots={slots} rows={rows} className={cn(timelineHeightClass, "rounded-md")}>

          <TimelineHeader columnLabel="Station" />
          <TimelineGrid>
            <ShiftBandsStrip dayType={dayType} />
            <ShiftBackgroundOverlay dayType={dayType} />

            {rows.map((row) =>
              row.isDivider ? (
                <TimelineRow
                  key={row.id}
                  row={row}
                  slots={slots}
                  className="h-8 bg-muted/40"
                  renderRowHeader={() => (
                    <div className="flex h-full w-full items-center px-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{row.label}</span>
                    </div>
                  )}
                >
                  {() => null}
                </TimelineRow>
              ) : (
                <TimelineRow
                  key={row.id}
                  row={row}
                  slots={slots}
                  className={cn(showSwsLog ? "h-28 sm:h-32" : "h-20 sm:h-24")}
                  renderRowHeader={() => {
                    const rowSlots = rowSlotMap.get(row.id) ?? [];
                    const primary = rowSlots[0];
                    const extra = rowSlots.length - 1;
                    const completionPct = primary && typeof primary.completionPct === "number" ? primary.completionPct : 0;
                    const endTime = primary ? minutesToTime(timeToMinutes(primary.startTime) + primary.duration) : null;

                    if (showSwsLog) {
                      return (
                        <div className="flex h-full w-full flex-col justify-center gap-0.5 px-3 py-1.5">
                          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{(row as AreaRowData).shortLabel ?? row.label}</p>
                          {primary ? (
                            <>
                              <EditableCell label="Assignment" value={primary.assignmentLabel ?? ""} onSave={(value) => updateSlotField(primary.id, "assignmentLabel", value)} placeholder="Assignment label" />
                              <div className="flex flex-wrap items-center gap-1">
                                <EditableCell label="Member" value={primary.member ?? ""} onSave={(value) => updateSlotField(primary.id, "member", value)} placeholder="Member" />
                                <EditableCell label="Stage" value={String(primary.stage ?? "-").replace(/_/g, " ")} onSave={(value) => updateSlotField(primary.id, "stage", value.toUpperCase().replace(/\s+/g, "_"))} placeholder="Stage" />
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <EditableCell label="Start Time" value={primary.startTime} onSave={(value) => updateSlotField(primary.id, "startTime", clampToTimeline(value, primary.duration))} placeholder="HH:MM" />
                                <EditableCell label="Duration" value={String(primary.duration)} onSave={(value) => updateSlotField(primary.id, "duration", value)} placeholder="Minutes" />
                              </div>
                              <p className="font-mono text-[10px] text-muted-foreground">{primary.startTime} {"->"} {endTime}</p>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${completionPct}%` }} />
                                </div>
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{completionPct}%</span>
                              </div>
                              {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra} more</span>}
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">No assignment</p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="w-full px-3 py-1">
                        <p className="truncate text-xs font-semibold leading-4">{(row as AreaRowData).shortLabel ?? row.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground leading-4">{row.label}</p>
                      </div>
                    );
                  }}
                >
                  {(slot: TimelineSlotData) => <SlotCard slot={slot as SchedulerSlot} rowLabel={row.label} showForecast={showAssignmentForecast} />}
                </TimelineRow>
              ),
            )}
            <TimelineCurrentTime />
          </TimelineGrid>
        </Timeline>
      </TimelineProvider>
      </div>

     
    </section>
  );
}
