/**
 * Notification Service Contract
 * 
 * Manages notifications and events.
 * Reads from Share/380/State/notifications.json
 */

import type { ServiceResult, PaginatedResult } from './index'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory = 
  | 'STAGE_STARTED'
  | 'STAGE_COMPLETED'
  | 'STAGE_REJECTED'
  | 'ASSIGNMENT_BLOCKED'
  | 'ASSIGNMENT_UNBLOCKED'
  | 'HANDOFF_REQUIRED'
  | 'PROJECT_COMPLETED'
  | 'PROJECT_LATE'
  | 'MEMBER_ASSIGNED'
  | 'MEMBER_UNASSIGNED'
  | 'SYSTEM'

export interface Notification {
  /** Unique notification ID */
  id: string
  /** Notification title */
  title: string
  /** Notification message body */
  message: string
  /** Severity level */
  severity: NotificationSeverity
  /** Event category */
  category: NotificationCategory
  /** Related project ID */
  projectId: string | null
  /** Related PD number */
  pdNumber: string | null
  /** Related sheet name */
  sheetName: string | null
  /** Related member badge */
  memberBadge: string | null
  /** Route to navigate to */
  linkedRoute: string | null
  /** Action button label */
  linkedActionLabel: string | null
  /** Is notification read */
  read: boolean
  /** Is notification dismissed */
  dismissed: boolean
  /** Created timestamp */
  createdAt: string
  /** Read timestamp */
  readAt: string | null
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface NotificationFilter {
  /** Filter by severity */
  severity?: NotificationSeverity | NotificationSeverity[]
  /** Filter by category */
  category?: NotificationCategory | NotificationCategory[]
  /** Filter by project */
  projectId?: string
  /** Filter by member */
  memberBadge?: string
  /** Only unread */
  unreadOnly?: boolean
  /** Only not dismissed */
  activOnly?: boolean
  /** Created after */
  since?: string
}

export interface NotificationStats {
  /** Total notifications */
  total: number
  /** Unread count */
  unread: number
  /** By severity */
  bySeverity: Record<NotificationSeverity, number>
  /** By category */
  byCategory: Record<NotificationCategory, number>
}

export interface INotificationService {
  /**
   * Get all notifications.
   */
  getNotifications(): Promise<ServiceResult<Notification[]>>

  /**
   * Get paginated notifications with filters.
   */
  getFilteredNotifications(
    filter?: NotificationFilter,
    page?: number,
    pageSize?: number
  ): Promise<ServiceResult<PaginatedResult<Notification>>>

  /**
   * Get notification by ID.
   */
  getNotificationById(id: string): Promise<ServiceResult<Notification | null>>

  /**
   * Get recent notifications for dashboard preview.
   */
  getRecentNotifications(limit?: number): Promise<ServiceResult<Notification[]>>

  /**
   * Get notification stats.
   */
  getStats(): Promise<ServiceResult<NotificationStats>>

  /**
   * Mark notification as read.
   */
  markAsRead(id: string): Promise<ServiceResult<Notification>>

  /**
   * Mark all notifications as read.
   */
  markAllAsRead(): Promise<ServiceResult<void>>

  /**
   * Dismiss notification.
   */
  dismiss(id: string): Promise<ServiceResult<Notification>>

  /**
   * Dismiss all notifications.
   */
  dismissAll(): Promise<ServiceResult<void>>

  /**
   * Create a new notification.
   */
  create(notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed' | 'readAt' | 'dataMode'>): Promise<ServiceResult<Notification>>
}
