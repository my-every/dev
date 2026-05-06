import type {
  D380NotificationRecord,
  D380NotificationsDataSet,
  D380NotificationsViewModel,
  NotificationCardViewModel,
  NotificationEventType,
  NotificationFilterState,
  NotificationStatusTabId,
} from '@/types/d380-notifications'

const MOCK_NOTIFICATIONS: D380NotificationRecord[] = [
  {
    id: 'notif-001',
    eventType: 'STAGE_COMPLETED',
    projectId: 'proj-1',
    pdNumber: '4M093',
    projectName: 'STOCK2',
    assignmentId: 'jb71-b-pnl-customer',
    sheetName: 'JB71 B,PNL CUSTOMER',
    stage: 'BUILD_UP',
    severity: 'success',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    createdByBadge: '75241',
    recipientGroup: 'TEAM_LEADS',
    recipientBadges: ['75241'],
    message: 'Build Up completed for JB71 B,PNL CUSTOMER. Ready for build-up review.',
    linkedRoute: '/projects/4m093-stock2/assignments/jb71-b-pnl-customer',
    linkedActionLabel: 'View Assignment',
    projectFilterKey: 'proj-1',
    typeFilterKey: 'STAGE_COMPLETED',
    unreadFilterKey: 'unread',
    notes: '',
    dataMode: 'mock',
  },
  {
    id: 'notif-002',
    eventType: 'HANDOFF_REQUIRED',
    projectId: 'proj-1',
    pdNumber: '4M093',
    projectName: 'STOCK2',
    assignmentId: 'jb72-a-pnl-power',
    sheetName: 'JB72 A,PNL POWER',
    stage: 'WIRING',
    severity: 'warning',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    createdByBadge: '12345',
    recipientGroup: 'TEAM_LEADS',
    recipientBadges: ['75241'],
    message: 'Shift handoff required for JB72 A,PNL POWER wiring. 68% complete.',
    linkedRoute: '/projects/4m093-stock2/assignments/jb72-a-pnl-power',
    linkedActionLabel: 'View Assignment',
    projectFilterKey: 'proj-1',
    typeFilterKey: 'HANDOFF_REQUIRED',
    unreadFilterKey: 'unread',
    notes: '',
    dataMode: 'mock',
  },
  {
    id: 'notif-003',
    eventType: 'ASSIGNMENT_BLOCKED',
    projectId: 'proj-2',
    pdNumber: '4M368',
    projectName: 'LT2E',
    assignmentId: 'sc-main-panel',
    sheetName: 'SC MAIN PANEL',
    stage: 'BUILD_UP',
    severity: 'error',
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
    createdByBadge: '99001',
    recipientGroup: 'SUPERVISORS',
    recipientBadges: ['75241', '99002'],
    message: 'SC MAIN PANEL blocked during Build Up — missing terminal blocks.',
    linkedRoute: '/projects/4m368-lt2e/assignments/sc-main-panel',
    linkedActionLabel: 'Resolve Blocked',
    projectFilterKey: 'proj-2',
    typeFilterKey: 'ASSIGNMENT_BLOCKED',
    unreadFilterKey: 'unread',
    notes: '',
    dataMode: 'mock',
  },
  {
    id: 'notif-004',
    eventType: 'STAGE_STARTED',
    projectId: 'proj-1',
    pdNumber: '4M093',
    projectName: 'STOCK2',
    assignmentId: 'jb71-b-pnl-customer',
    sheetName: 'JB71 B,PNL CUSTOMER',
    stage: 'WIRING',
    severity: 'info',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    createdByBadge: '75241',
    recipientGroup: 'ALL',
    recipientBadges: ['75241'],
    message: 'Wiring started for JB71 B,PNL CUSTOMER by Phi.',
    linkedRoute: '/projects/4m093-stock2/assignments/jb71-b-pnl-customer',
    linkedActionLabel: 'View Assignment',
    projectFilterKey: 'proj-1',
    typeFilterKey: 'STAGE_STARTED',
    unreadFilterKey: 'read',
    notes: '',
    dataMode: 'mock',
  },
  {
    id: 'notif-005',
    eventType: 'ASSIGNMENT_COMPLETED',
    projectId: 'proj-2',
    pdNumber: '4M368',
    projectName: 'LT2E',
    assignmentId: 'sc-aux-panel',
    sheetName: 'SC AUX PANEL',
    severity: 'success',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    createdByBadge: '88001',
    recipientGroup: 'TEAM_LEADS',
    recipientBadges: ['75241'],
    message: 'SC AUX PANEL fully completed through BIQ.',
    linkedRoute: '/projects/4m368-lt2e/assignments/sc-aux-panel',
    linkedActionLabel: 'View Summary',
    projectFilterKey: 'proj-2',
    typeFilterKey: 'ASSIGNMENT_COMPLETED',
    unreadFilterKey: 'read',
    notes: '',
    dataMode: 'mock',
  },
]

const EMPTY_NOTIFICATIONS_DATA_SET: D380NotificationsDataSet = {
  operatingDate: new Date().toISOString().split('T')[0],
  notifications: MOCK_NOTIFICATIONS,
}

/**
 * Get the notifications data set with mock data.
 * Real data should be loaded from the notification service.
 */
export function getNotificationsDataSet(): D380NotificationsDataSet {
  return EMPTY_NOTIFICATIONS_DATA_SET
}

const eventTypeLabels: Record<NotificationEventType, string> = {
  STAGE_STARTED: 'Stage Started',
  STAGE_RESUMED: 'Stage Resumed',
  STAGE_COMPLETED: 'Stage Completed',
  STAGE_REJECTED: 'Stage Rejected',
  HANDOFF_REQUIRED: 'Handoff Required',
  ASSIGNMENT_COMPLETED: 'Assignment Completed',
  PROJECT_COMPLETED: 'Project Completed',
  ASSIGNMENT_BLOCKED: 'Assignment Blocked',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function filterNotificationsByProject(
  notifications: D380NotificationRecord[],
  projectId: string,
) {
  if (!projectId || projectId === 'ALL') {
    return notifications
  }

  return notifications.filter(notification => notification.projectId === projectId)
}

export function filterNotificationsByType(
  notifications: D380NotificationRecord[],
  type: NotificationFilterState['type'],
) {
  if (!type || type === 'ALL') {
    return notifications
  }

  return notifications.filter(notification => notification.eventType === type)
}

export function filterUnreadNotifications(
  notifications: D380NotificationRecord[],
  unreadOnly: boolean,
) {
  if (!unreadOnly) {
    return notifications
  }

  return notifications.filter(notification => !notification.isRead)
}

export function filterNotificationsBySearchText(
  notifications: D380NotificationRecord[],
  searchText: string,
) {
  const normalizedSearch = searchText.trim().toLowerCase()

  if (!normalizedSearch) {
    return notifications
  }

  return notifications.filter(notification => {
    const haystack = [notification.message, notification.sheetName, notification.pdNumber]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

export function filterNotificationsByStatusTab(
  notifications: D380NotificationRecord[],
  statusTab: NotificationStatusTabId,
) {
  if (statusTab === 'UNREAD') {
    return notifications.filter(notification => !notification.isRead)
  }

  if (statusTab === 'READ') {
    return notifications.filter(notification => notification.isRead)
  }

  return notifications
}

export function applyNotificationFilters(
  notifications: D380NotificationRecord[],
  filters: NotificationFilterState,
) {
  return filterNotificationsBySearchText(
    filterUnreadNotifications(
      filterNotificationsByStatusTab(
        filterNotificationsByType(filterNotificationsByProject(notifications, filters.projectId), filters.type), filters.statusTab,
      ),
      filters.unreadOnly,
    ),
    filters.searchText,
  ).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function buildNotificationTitle(notification: D380NotificationRecord) {
  const baseLabel = eventTypeLabels[notification.eventType]

  if (notification.sheetName) {
    return `${baseLabel} · ${notification.sheetName}`
  }

  return `${baseLabel} · ${notification.pdNumber}`
}

function buildRecipientSummary(notification: D380NotificationRecord) {
  return `${notification.recipientGroup.replace(/_/g, ' ')} · ${notification.recipientBadges.length} recipient${notification.recipientBadges.length === 1 ? '' : 's'}`
}

function toCardViewModel(notification: D380NotificationRecord): NotificationCardViewModel {
  return {
    id: notification.id,
    title: buildNotificationTitle(notification),
    message: notification.message,
    eventType: notification.eventType,
    eventTypeLabel: eventTypeLabels[notification.eventType],
    severity: notification.severity,
    isRead: notification.isRead,
    createdAtLabel: timestampFormatter.format(new Date(notification.createdAt)),
    createdByBadge: notification.createdByBadge,
    projectId: notification.projectId,
    pdNumber: notification.pdNumber,
    projectName: notification.projectName,
    assignmentId: notification.assignmentId,
    sheetName: notification.sheetName,
    stage: notification.stage,
    routeLabel: notification.linkedActionLabel,
    routeHref: notification.linkedRoute,
    recipientSummary: buildRecipientSummary(notification),
    rawMessage: notification.message,
    rawSheetName: notification.sheetName,
    rawPdNumber: notification.pdNumber,
  }
}

export function buildNotificationsViewModel({
  dataSet,
  filters,
}: {
  dataSet?: D380NotificationsDataSet
  filters: NotificationFilterState
}): D380NotificationsViewModel {
  const resolvedDataSet = dataSet ?? EMPTY_NOTIFICATIONS_DATA_SET
  const notifications = resolvedDataSet.notifications
  const filteredNotifications = applyNotificationFilters(notifications, filters)
  const unreadCount = notifications.filter(notification => !notification.isRead).length
  const blockedCount = notifications.filter(notification => notification.eventType === 'ASSIGNMENT_BLOCKED').length
  const uniqueProjects = new Set(notifications.map(notification => notification.projectId)).size

  return {
    operatingDateLabel: resolvedDataSet.operatingDate
      ? dateFormatter.format(new Date(`${resolvedDataSet.operatingDate}T00:00:00`))
      : dateFormatter.format(new Date()),
    summary: {
      total: notifications.length,
      unread: unreadCount,
      blocked: blockedCount,
      projects: uniqueProjects,
    },
    projectOptions: [
      {
        value: 'ALL',
        label: 'All projects',
        count: notifications.length,
      },
      ...Array.from(new Map(notifications.map(notification => [notification.projectId, notification])).values()).map(notification => ({
        value: notification.projectId,
        label: `${notification.pdNumber} · ${notification.projectName}`,
        count: notifications.filter(candidate => candidate.projectId === notification.projectId).length,
      })),
    ],
    typeOptions: [
      {
        value: 'ALL',
        label: 'All event types',
        count: notifications.length,
      },
      ...Object.entries(eventTypeLabels).map(([value, label]) => ({
        value: value as NotificationEventType,
        label,
        count: notifications.filter(notification => notification.eventType === value).length,
      })),
    ],
    statusTabs: [
      { id: 'ALL', label: 'All', count: notifications.length },
      { id: 'UNREAD', label: 'Unread', count: unreadCount },
      { id: 'READ', label: 'Read', count: notifications.length - unreadCount },
    ],
    notifications: filteredNotifications.map(toCardViewModel),
    emptyState: {
      title: 'No notifications match the current filters.',
      description: 'Adjust the project, event type, or unread filters to bring mock route-worthy notices back into view.',
    },
  }
}
