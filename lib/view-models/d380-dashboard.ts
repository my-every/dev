import type {
  D380DashboardDataSet,
  D380DashboardViewModel,
  DashboardNotification,
  DashboardHeroSlide,
  DashboardProjectPreview,
} from '@/types/d380-dashboard'
import type { D380NotificationsDataSet } from '@/types/d380-notifications'

const dashboardTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const dashboardNotificationSeverityMap = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const

function sortProjectsByRisk(projects: DashboardProjectPreview[]) {
  const riskWeight = {
    late: 0,
    watch: 1,
    healthy: 2,
  } as const

  return [...projects].sort((left, right) => {
    const riskDelta = riskWeight[left.risk] - riskWeight[right.risk]
    if (riskDelta !== 0) {
      return riskDelta
    }

    return right.progressPercent - left.progressPercent
  })
}

function hydrateHeroSlides(slides: DashboardHeroSlide[], performers: D380DashboardDataSet['performers']): DashboardHeroSlide[] {
  return slides.map(slide => {
    if (slide.type !== 'TOP_PERFORMERS') {
      return slide
    }

    return {
      ...slide,
      performers: performers.slice(0, 3),
    }
  })
}

function buildDashboardNotifications(notificationsDataSet?: D380NotificationsDataSet): DashboardNotification[] {
  if (!notificationsDataSet || notificationsDataSet.notifications.length === 0) {
    return []
  }

  return notificationsDataSet.notifications
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(notification => ({
      id: notification.id,
      title: notification.sheetName
        ? `${notification.eventType.replace(/_/g, ' ')} · ${notification.sheetName}`
        : `${notification.eventType.replace(/_/g, ' ')} · ${notification.pdNumber}`,
      body: notification.message,
      severity: dashboardNotificationSeverityMap[notification.severity],
      category: notification.eventType.replace(/_/g, ' '),
      timestampLabel: dashboardTimestampFormatter.format(new Date(notification.createdAt)),
      ...(notification.linkedActionLabel ? { actionLabel: notification.linkedActionLabel } : {}),
      ...(notification.projectId ? { projectId: notification.projectId } : {}),
      ...(notification.linkedRoute ? { linkedRoute: notification.linkedRoute } : {}),
    }))
}

const EMPTY_DASHBOARD_VIEW_MODEL: D380DashboardViewModel = {
  operatingDateLabel: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  activeShiftLabel: '1st Shift',
  heroSlides: [],
  summaryMetrics: [],
  topPerformer: {
    id: '',
    name: 'No data',
    initials: '--',
    role: '--',
    shift: '1st',
    station: '--',
    completedAssignments: 0,
    qualityScore: 0,
    throughputDelta: 0,
    streakDays: 0,
    spotlight: 'No performer data yet.',
  },
  topPerformers: [],
  notifications: [],
  primaryNotifications: [],
  shiftComparison: {
    firstShift: { shift: '1st', label: '1st Shift', activeProjects: 0, completedAssignments: 0, avgCycleHours: 0, utilizationPercent: 0, qualityPercent: 0, handoffReadyPercent: 0 },
    secondShift: { shift: '2nd', label: '2nd Shift', activeProjects: 0, completedAssignments: 0, avgCycleHours: 0, utilizationPercent: 0, qualityPercent: 0, handoffReadyPercent: 0 },
  },
  upcomingProjects: [],
  inProgressAssignments: [],
  lateProjects: [],
  recentlyUpdatedProjects: [],
}

export function getD380DashboardViewModel(dashboardDataSet?: D380DashboardDataSet, notificationsDataSet?: D380NotificationsDataSet): D380DashboardViewModel {
  if (!dashboardDataSet) {
    return EMPTY_DASHBOARD_VIEW_MODEL
  }

  const firstShift = dashboardDataSet.shiftSnapshots.find(snapshot => snapshot.shift === '1st')
  const secondShift = dashboardDataSet.shiftSnapshots.find(snapshot => snapshot.shift === '2nd')

  if (!firstShift || !secondShift) {
    return EMPTY_DASHBOARD_VIEW_MODEL
  }

  const topPerformer = dashboardDataSet.performers[0]
  const dashboardNotifications = buildDashboardNotifications(notificationsDataSet)

  if (!topPerformer) {
    return EMPTY_DASHBOARD_VIEW_MODEL
  }

  const projects = dashboardDataSet.projects
  const upcomingProjects = projects.filter(project => project.stage === 'Upcoming')
  const lateProjects = sortProjectsByRisk(projects.filter(project => project.risk === 'late'))
  const recentlyUpdatedProjects = [...projects].sort((left, right) => left.updatedLabel.localeCompare(right.updatedLabel))

  return {
    operatingDateLabel: dashboardDataSet.operatingDate,
    activeShiftLabel: dashboardDataSet.activeShift === '1st' ? '1st Shift' : '2nd Shift',
    heroSlides: hydrateHeroSlides(dashboardDataSet.heroSlides, dashboardDataSet.performers),
    summaryMetrics: dashboardDataSet.summaryMetrics,
    topPerformer,
    topPerformers: dashboardDataSet.performers,
    notifications: dashboardNotifications,
    primaryNotifications: dashboardNotifications.slice(0, 3),
    shiftComparison: {
      firstShift,
      secondShift,
    },
    upcomingProjects,
    inProgressAssignments: dashboardDataSet.assignments,
    lateProjects,
    recentlyUpdatedProjects,
  }
}
