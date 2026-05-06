export type NotificationEventType =
  | 'STAGE_STARTED'
  | 'STAGE_RESUMED'
  | 'STAGE_COMPLETED'
  | 'STAGE_REJECTED'
  | 'HANDOFF_REQUIRED'
  | 'ASSIGNMENT_COMPLETED'
  | 'PROJECT_COMPLETED'
  | 'ASSIGNMENT_BLOCKED'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationStatusTabId = 'ALL' | 'UNREAD' | 'READ'

export interface D380NotificationCsvRow {
  notification_id: string
  event_type: NotificationEventType
  project_id: string
  pd_number: string
  project_name: string
  assignment_id: string
  sheet_name: string
  stage: string
  severity: NotificationSeverity
  is_read: 'true' | 'false'
  created_at: string
  created_by_badge: string
  recipient_group: string
  recipient_badges: string
  message: string
  linked_route: string
  linked_action_label: string
  project_filter_key: string
  type_filter_key: NotificationEventType
  unread_filter_key: 'read' | 'unread'
  data_mode: 'mock'
  notes: string
}

export interface D380NotificationRecord {
  id: string
  eventType: NotificationEventType
  projectId: string
  pdNumber: string
  projectName: string
  assignmentId?: string
  sheetName?: string
  stage?: string
  severity: NotificationSeverity
  isRead: boolean
  createdAt: string
  createdByBadge: string
  recipientGroup: string
  recipientBadges: string[]
  message: string
  linkedRoute: string
  linkedActionLabel: string
  projectFilterKey: string
  typeFilterKey: NotificationEventType
  unreadFilterKey: 'read' | 'unread'
  dataMode: 'mock'
  notes: string
}

export interface D380NotificationsDataSet {
  operatingDate: string
  notifications: D380NotificationRecord[]
}

export interface NotificationFilterState {
  searchText: string
  projectId: string
  type: 'ALL' | NotificationEventType
  unreadOnly: boolean
  statusTab: NotificationStatusTabId
}

export interface NotificationProjectOption {
  value: string
  label: string
  count: number
}

export interface NotificationTypeOption {
  value: 'ALL' | NotificationEventType
  label: string
  count: number
}

export interface NotificationStatusTabViewModel {
  id: NotificationStatusTabId
  label: string
  count: number
}

export interface NotificationCardViewModel {
  id: string
  title: string
  message: string
  eventType: NotificationEventType
  eventTypeLabel: string
  severity: NotificationSeverity
  isRead: boolean
  createdAtLabel: string
  createdByBadge: string
  projectId: string
  pdNumber: string
  projectName: string
  assignmentId?: string
  sheetName?: string
  stage?: string
  routeLabel: string
  routeHref: string
  recipientSummary: string
  rawMessage: string
  rawSheetName?: string
  rawPdNumber: string
}

export interface D380NotificationsViewModel {
  operatingDateLabel: string
  summary: {
    total: number
    unread: number
    blocked: number
    projects: number
  }
  projectOptions: NotificationProjectOption[]
  typeOptions: NotificationTypeOption[]
  statusTabs: NotificationStatusTabViewModel[]
  notifications: NotificationCardViewModel[]
  emptyState: {
    title: string
    description: string
  }
}