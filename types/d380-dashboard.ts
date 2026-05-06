import type { NotificationSeverity } from '@/types/d380-notifications'
import type { ShiftOptionId } from '@/types/d380-startup'

export type DashboardHeroSlideType =
  | 'WELCOME'
  | 'TOP_PERFORMERS'
  | 'TOP_PERFORMER'
  | 'HOLIDAY'
  | 'ANNOUNCEMENT'
  | 'SHIFT_COMPARISON'
  | 'SCHEDULE_PROGRESS'

export type DashboardRiskLevel = 'healthy' | 'watch' | 'late'
export type DashboardNotificationSeverity = NotificationSeverity
export type DashboardMetricTone = 'neutral' | 'positive' | 'attention'
export type DashboardProjectStage = 'Upcoming' | 'Conlay' | 'Conasy' | 'Test' | 'PWR Check' | 'BIQ'
export type DashboardAssignmentStatus = 'queued' | 'active' | 'watch'

export interface DashboardSummaryMetric {
  id: string
  label: string
  value: string
  detail: string
  tone: DashboardMetricTone
}

export interface DashboardPerformer {
  id: string
  name: string
  initials: string
  role: string
  shift: ShiftOptionId
  station: string
  completedAssignments: number
  qualityScore: number
  throughputDelta: number
  streakDays: number
  spotlight: string
}

export interface DashboardNotification {
  id: string
  title: string
  body: string
  severity: DashboardNotificationSeverity
  category: string
  timestampLabel: string
  actionLabel?: string
  projectId?: string
  linkedRoute?: string
}

export interface DashboardShiftSnapshot {
  shift: ShiftOptionId
  label: string
  activeProjects: number
  completedAssignments: number
  avgCycleHours: number
  utilizationPercent: number
  qualityPercent: number
  handoffReadyPercent: number
}

export interface DashboardProjectPreview {
  id: string
  pdNumber: string
  name: string
  stage: DashboardProjectStage
  member: string
  targetDate: string
  progressPercent: number
  units: number
  risk: DashboardRiskLevel
  statusLabel: string
  updatedLabel: string
}

export interface DashboardAssignmentPreview {
  id: string
  projectId: string
  projectName: string
  sheetName: string
  station: string
  assignee: string
  progressPercent: number
  dueLabel: string
  status: DashboardAssignmentStatus
}

export interface DashboardHeroSlideBase {
  id: string
  type: DashboardHeroSlideType
  eyebrow: string
  title: string
  description: string
  ctaLabel?: string
}

export interface WelcomeHeroSlide extends DashboardHeroSlideBase {
  type: 'WELCOME'
  shiftLabel: string
  operatingDate: string
  readyProjects: number
  restoredAssignments: number
}

export interface TopPerformersHeroSlide extends DashboardHeroSlideBase {
  type: 'TOP_PERFORMERS'
  performers: DashboardPerformer[]
}

export interface TopPerformerHeroSlide extends DashboardHeroSlideBase {
  type: 'TOP_PERFORMER'
  performer: DashboardPerformer
}

export interface HolidayHeroSlide extends DashboardHeroSlideBase {
  type: 'HOLIDAY'
  holidayName: string
  dateLabel: string
  coverageNote: string
}

export interface AnnouncementHeroSlide extends DashboardHeroSlideBase {
  type: 'ANNOUNCEMENT'
  announcementTag: string
  emphasis: string
}

export interface ShiftComparisonHeroSlide extends DashboardHeroSlideBase {
  type: 'SHIFT_COMPARISON'
  firstShift: DashboardShiftSnapshot
  secondShift: DashboardShiftSnapshot
}

export interface ScheduleProgressHeroSlide extends DashboardHeroSlideBase {
  type: 'SCHEDULE_PROGRESS'
  scheduledUnits: number
  completedUnits: number
  lateProjects: number
  completionPercent: number
}

export type DashboardHeroSlide =
  | WelcomeHeroSlide
  | TopPerformersHeroSlide
  | TopPerformerHeroSlide
  | HolidayHeroSlide
  | AnnouncementHeroSlide
  | ShiftComparisonHeroSlide
  | ScheduleProgressHeroSlide

export interface D380DashboardDataSet {
  operatingDate: string
  activeShift: ShiftOptionId
  summaryMetrics: DashboardSummaryMetric[]
  heroSlides: DashboardHeroSlide[]
  performers: DashboardPerformer[]
  notifications: DashboardNotification[]
  shiftSnapshots: DashboardShiftSnapshot[]
  projects: DashboardProjectPreview[]
  assignments: DashboardAssignmentPreview[]
}

export interface D380DashboardViewModel {
  operatingDateLabel: string
  activeShiftLabel: string
  heroSlides: DashboardHeroSlide[]
  summaryMetrics: DashboardSummaryMetric[]
  topPerformer: DashboardPerformer
  topPerformers: DashboardPerformer[]
  notifications: DashboardNotification[]
  primaryNotifications: DashboardNotification[]
  shiftComparison: {
    firstShift: DashboardShiftSnapshot
    secondShift: DashboardShiftSnapshot
  }
  upcomingProjects: DashboardProjectPreview[]
  inProgressAssignments: DashboardAssignmentPreview[]
  lateProjects: DashboardProjectPreview[]
  recentlyUpdatedProjects: DashboardProjectPreview[]
}