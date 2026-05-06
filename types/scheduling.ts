import type { ShiftId } from "./shifts"

// Base time slot interface used across all scheduling components
export interface BaseTimeSlot {
  id: string
  startTime: string // "HH:mm" format
  endTime: string   // "HH:mm" format
}

// Assignment status for tracking workflow
export type AssignmentStatus =
  | "scheduled"
  | "in-progress"
  | "completed"
  | "blocked"
  | "cancelled"

// Priority levels for assignments
export type AssignmentPriority = "low" | "medium" | "high" | "urgent"

// Time display mode for timeline slots
export type TimeDisplayMode = "estimate" | "current" | "completion"

// Completion comparison result
export type CompletionComparison = "early" | "on-time" | "late"

// Assignee info for slot display
export interface Assignee {
  id: string
  name: string
  avatar?: string
}

// A project assignment on the timeline
export interface Assignment extends BaseTimeSlot {
  projectId: string
  projectName: string
  resourceId: string
  shiftId: ShiftId
  status: AssignmentStatus
  priority: AssignmentPriority
  isOvertime: boolean
  notes?: string
  color?: string
  // Assignee(s) - can be multiple people on one task
  assignees?: Assignee[]
  // Time tracking fields
  estimatedStartTime: string  // Original scheduled start
  estimatedEndTime: string    // Original scheduled end
  actualStartTime?: string    // When work actually started
  actualEndTime?: string      // When work actually ended (if completed)
  // Takeover support
  isTakeover?: boolean        // Was this taken over from previous shift
  previousAssignmentId?: string // ID of original assignment if taken over
  takenOverBy?: string        // ID of assignment that took over this one
}

// A resource (team member) that can be assigned work
export interface Resource {
  id: string
  name: string
  avatar?: string
  shiftId: ShiftId
  skills: string[]
  maxOvertimeMinutes: number
  isActive: boolean
}

// A project that can be scheduled
export interface Project {
  id: string
  name: string
  description?: string
  color: string
  estimatedMinutes: number
  priority: AssignmentPriority
  requiredSkills: string[]
}

// Daily capacity tracking for a resource
export interface DailyCapacity {
  date: string // "YYYY-MM-DD"
  resourceId: string
  shiftId: ShiftId
  standardMinutes: number
  overtimeMinutes: number
  assignedStandardMinutes: number
  assignedOvertimeMinutes: number
}

// Computed capacity values
export interface CapacitySummary {
  totalStandardMinutes: number
  totalOvertimeMinutes: number
  assignedStandardMinutes: number
  assignedOvertimeMinutes: number
  remainingStandardMinutes: number
  remainingOvertimeMinutes: number
  utilizationPercent: number
}

// Filter options for the scheduler view
export interface SchedulingFilters {
  shiftId: ShiftId | "all"
  resourceIds: string[]
  projectIds: string[]
  statuses: AssignmentStatus[]
  showOvertime: boolean
  timeDisplayMode: TimeDisplayMode
}

// View mode for the scheduler
export type ViewMode = "day" | "week"

// Timeline configuration
export interface TimelineConfig {
  startHour: number
  endHour: number
  snapIntervalMinutes: number
  pixelsPerMinute: number
  rowHeight: number
  minSlotDurationMinutes: number
}

// Drag and drop payloads
export interface DragPayload {
  type: "assignment" | "new-project"
  assignmentId?: string
  projectId?: string
  originalTime?: string
  originalResourceId?: string
}

export interface DropTarget {
  resourceId: string
  time: string
  shiftId: ShiftId
}

// Event handlers for scheduling operations
export interface SchedulingHandlers {
  onAssignmentCreate: (
    assignment: Omit<Assignment, "id">
  ) => Promise<Assignment>
  onAssignmentUpdate: (
    id: string,
    updates: Partial<Assignment>
  ) => Promise<Assignment>
  onAssignmentMove: (
    id: string,
    newTime: string,
    newResourceId: string
  ) => Promise<Assignment>
  onAssignmentDelete: (id: string) => Promise<void>
  onAssignmentStatusChange: (
    id: string,
    status: AssignmentStatus
  ) => Promise<Assignment>
}
