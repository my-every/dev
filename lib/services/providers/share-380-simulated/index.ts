import type {
  Assignment,
  AssignmentFilter,
  AssignmentPlacement,
  AssignmentStatus,
  IAssignmentStateService,
} from '@/lib/services/contracts/assignment-state-service'
import type {
  INotificationService,
  Notification,
  NotificationFilter,
  NotificationStats,
} from '@/lib/services/contracts/notification-service'
import type { ShiftId, PaginatedResult, ServiceResult } from '@/lib/services/contracts'
import type {
  IWorkspaceService,
  ShiftSnapshot,
  WorkspaceSession,
  WorkspaceSummaryMetrics,
} from '@/lib/services/contracts/workspace-service'
import type { Share380Provider } from '@/lib/services/provider-types'

import { LeaderboardServiceImpl } from './leaderboard-service'
import { ProjectDetailsV2ServiceImpl } from './project-details-v2-service'
import { ProjectDiscoveryServiceImpl } from './project-discovery-service'
import { SimulatedSessionService } from './session-service'
import { TeamRosterServiceImpl } from './team-roster-service'
import { WorkAreaServiceImpl } from './work-area-service'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function err<T>(message: string): ServiceResult<T> {
  return {
    data: null,
    error: message,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)
  return {
    items: pageItems,
    total: items.length,
    page,
    pageSize,
    hasMore: start + pageItems.length < items.length,
  }
}

class SimulatedWorkspaceService implements IWorkspaceService {
  private session: WorkspaceSession = {
    operatingDate: new Date().toISOString().split('T')[0],
    activeShift: '1st',
    userBadge: null,
    userName: null,
    sessionStartedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    dataMode: 'mock',
  }

  async getSession(): Promise<ServiceResult<WorkspaceSession>> {
    return ok(this.session)
  }

  async setOperatingDate(date: string): Promise<ServiceResult<WorkspaceSession>> {
    this.session = { ...this.session, operatingDate: date, lastActivityAt: new Date().toISOString() }
    return ok(this.session)
  }

  async setActiveShift(shift: ShiftId): Promise<ServiceResult<WorkspaceSession>> {
    this.session = { ...this.session, activeShift: shift, lastActivityAt: new Date().toISOString() }
    return ok(this.session)
  }

  async setSessionUser(badge: string): Promise<ServiceResult<WorkspaceSession>> {
    this.session = {
      ...this.session,
      userBadge: badge,
      userName: `User ${badge}`,
      lastActivityAt: new Date().toISOString(),
    }
    return ok(this.session)
  }

  async getSummaryMetrics(): Promise<ServiceResult<WorkspaceSummaryMetrics>> {
    return ok({
      activeProjectCount: 0,
      inProgressSheetCount: 0,
      blockedAssignmentCount: 0,
      wiresCompletedToday: 0,
      staffedWorkAreaCount: 0,
      teamMembersOnShift: 0,
    })
  }

  async getShiftSnapshots(date: string): Promise<ServiceResult<ShiftSnapshot[]>> {
    return ok([
      {
        shift: '1st',
        shiftLabel: '1st Shift',
        operatingDate: date,
        memberCount: 0,
        completedSheets: 0,
        wiresCompleted: 0,
        averageEfficiency: 0,
        blockedCount: 0,
      },
      {
        shift: '2nd',
        shiftLabel: '2nd Shift',
        operatingDate: date,
        memberCount: 0,
        completedSheets: 0,
        wiresCompleted: 0,
        averageEfficiency: 0,
        blockedCount: 0,
      },
    ])
  }

  async clearSession(): Promise<ServiceResult<void>> {
    this.session = {
      operatingDate: new Date().toISOString().split('T')[0],
      activeShift: '1st',
      userBadge: null,
      userName: null,
      sessionStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      dataMode: 'mock',
    }
    return ok(undefined)
  }
}

export class SimulatedAssignmentStateService implements IAssignmentStateService {
  private assignments: Assignment[] = []

  async getActiveAssignments(): Promise<ServiceResult<Assignment[]>> {
    return ok(this.assignments)
  }

  async getAssignments(
    filter?: AssignmentFilter,
    page = 1,
    pageSize = 25
  ): Promise<ServiceResult<PaginatedResult<Assignment>>> {
    let items = [...this.assignments]
    if (filter?.projectId) items = items.filter(item => item.projectId === filter.projectId)
    if (filter?.workAreaId) items = items.filter(item => item.currentWorkAreaId === filter.workAreaId)
    if (filter?.memberBadge) items = items.filter(item => item.currentMemberBadges.includes(filter.memberBadge!))
    if (filter?.blockedOnly) items = items.filter(item => item.status === 'BLOCKED')
    if (filter?.carryoverOnly) items = items.filter(item => item.carriedFromPriorShift)

    return ok(paginate(items, page, pageSize))
  }

  async getAssignmentById(id: string): Promise<ServiceResult<Assignment | null>> {
    return ok(this.assignments.find(item => item.id === id) ?? null)
  }

  async getAssignmentsByProject(projectId: string): Promise<ServiceResult<Assignment[]>> {
    return ok(this.assignments.filter(item => item.projectId === projectId))
  }

  async getAssignmentsByWorkArea(workAreaId: string): Promise<ServiceResult<Assignment[]>> {
    return ok(this.assignments.filter(item => item.currentWorkAreaId === workAreaId))
  }

  async getAssignmentsByMember(badge: string): Promise<ServiceResult<Assignment[]>> {
    return ok(this.assignments.filter(item => item.currentMemberBadges.includes(badge)))
  }

  async getBacklog(): Promise<ServiceResult<{ unassigned: Assignment[]; blocked: Assignment[]; carryover: Assignment[] }>> {
    return ok({
      unassigned: this.assignments.filter(item => item.status === 'UNASSIGNED'),
      blocked: this.assignments.filter(item => item.status === 'BLOCKED'),
      carryover: this.assignments.filter(item => item.carriedFromPriorShift),
    })
  }

  async getRecommendedAssignments(workAreaId: string, limit = 10): Promise<ServiceResult<Assignment[]>> {
    const items = this.assignments
      .filter(item => item.currentWorkAreaId === null || item.currentWorkAreaId === workAreaId)
      .slice(0, limit)
    return ok(items)
  }

  async placeAssignment(placement: AssignmentPlacement): Promise<ServiceResult<Assignment>> {
    const index = this.assignments.findIndex(item => item.id === placement.assignmentId)
    if (index < 0) return err(`Assignment ${placement.assignmentId} not found`)

    const next: Assignment = {
      ...this.assignments[index],
      currentWorkAreaId: placement.workAreaId,
      currentMemberBadges: placement.memberBadges,
      traineeAllowed: placement.traineePairing,
      status: 'ASSIGNED',
      updatedAt: new Date().toISOString(),
    }
    this.assignments[index] = next
    return ok(next)
  }

  async updateStatus(id: string, status: AssignmentStatus, note?: string): Promise<ServiceResult<Assignment>> {
    const index = this.assignments.findIndex(item => item.id === id)
    if (index < 0) return err(`Assignment ${id} not found`)

    const next: Assignment = {
      ...this.assignments[index],
      status,
      statusNote: note ?? this.assignments[index].statusNote,
      updatedAt: new Date().toISOString(),
    }
    this.assignments[index] = next
    return ok(next)
  }

  async advanceStage(id: string): Promise<ServiceResult<Assignment>> {
    const current = await this.getAssignmentById(id)
    if (!current.data) return err(`Assignment ${id} not found`)
    return ok({ ...current.data, updatedAt: new Date().toISOString() })
  }

  async blockAssignment(id: string, reason: string): Promise<ServiceResult<Assignment>> {
    return this.updateStatus(id, 'BLOCKED', reason)
  }

  async unblockAssignment(id: string): Promise<ServiceResult<Assignment>> {
    return this.updateStatus(id, 'ASSIGNED')
  }

  async updateProgress(id: string, progressPercent: number, completedWires?: number): Promise<ServiceResult<Assignment>> {
    const index = this.assignments.findIndex(item => item.id === id)
    if (index < 0) return err(`Assignment ${id} not found`)

    const next: Assignment = {
      ...this.assignments[index],
      progressPercent,
      completedWires: completedWires ?? this.assignments[index].completedWires,
      updatedAt: new Date().toISOString(),
    }
    this.assignments[index] = next
    return ok(next)
  }
}

class SimulatedNotificationService implements INotificationService {
  private notifications: Notification[] = []

  async getNotifications(): Promise<ServiceResult<Notification[]>> {
    return ok(this.notifications)
  }

  async getFilteredNotifications(
    filter?: NotificationFilter,
    page = 1,
    pageSize = 20
  ): Promise<ServiceResult<PaginatedResult<Notification>>> {
    let items = [...this.notifications]
    if (filter?.projectId) items = items.filter(item => item.projectId === filter.projectId)
    if (filter?.memberBadge) items = items.filter(item => item.memberBadge === filter.memberBadge)
    if (filter?.unreadOnly) items = items.filter(item => !item.read)
    if (filter?.activOnly) items = items.filter(item => !item.dismissed)
    return ok(paginate(items, page, pageSize))
  }

  async getNotificationById(id: string): Promise<ServiceResult<Notification | null>> {
    return ok(this.notifications.find(item => item.id === id) ?? null)
  }

  async getRecentNotifications(limit = 5): Promise<ServiceResult<Notification[]>> {
    return ok([...this.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit))
  }

  async getStats(): Promise<ServiceResult<NotificationStats>> {
    const bySeverity = {
      info: this.notifications.filter(item => item.severity === 'info').length,
      success: this.notifications.filter(item => item.severity === 'success').length,
      warning: this.notifications.filter(item => item.severity === 'warning').length,
      error: this.notifications.filter(item => item.severity === 'error').length,
    }

    const byCategory = this.notifications.reduce<Record<Notification['category'], number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1
      return acc
    }, {
      STAGE_STARTED: 0,
      STAGE_COMPLETED: 0,
      STAGE_REJECTED: 0,
      ASSIGNMENT_BLOCKED: 0,
      ASSIGNMENT_UNBLOCKED: 0,
      HANDOFF_REQUIRED: 0,
      PROJECT_COMPLETED: 0,
      PROJECT_LATE: 0,
      MEMBER_ASSIGNED: 0,
      MEMBER_UNASSIGNED: 0,
      SYSTEM: 0,
    })

    return ok({
      total: this.notifications.length,
      unread: this.notifications.filter(item => !item.read).length,
      bySeverity,
      byCategory,
    })
  }

  async markAsRead(id: string): Promise<ServiceResult<Notification>> {
    const index = this.notifications.findIndex(item => item.id === id)
    if (index < 0) return err(`Notification ${id} not found`)
    this.notifications[index] = { ...this.notifications[index], read: true, readAt: new Date().toISOString() }
    return ok(this.notifications[index])
  }

  async markAllAsRead(): Promise<ServiceResult<void>> {
    const now = new Date().toISOString()
    this.notifications = this.notifications.map(item => ({ ...item, read: true, readAt: now }))
    return ok(undefined)
  }

  async dismiss(id: string): Promise<ServiceResult<Notification>> {
    const index = this.notifications.findIndex(item => item.id === id)
    if (index < 0) return err(`Notification ${id} not found`)
    this.notifications[index] = { ...this.notifications[index], dismissed: true }
    return ok(this.notifications[index])
  }

  async dismissAll(): Promise<ServiceResult<void>> {
    this.notifications = this.notifications.map(item => ({ ...item, dismissed: true }))
    return ok(undefined)
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed' | 'readAt' | 'dataMode'>): Promise<ServiceResult<Notification>> {
    const next: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
      dismissed: false,
      readAt: null,
      dataMode: 'mock',
    }
    this.notifications.unshift(next)
    return ok(next)
  }
}

let providerInstance: Share380Provider | null = null

export function getShare380Provider(): Share380Provider {
  if (!providerInstance) {
    const session = new SimulatedSessionService()

    providerInstance = {
      workspace: new SimulatedWorkspaceService(),
      projectDiscovery: new ProjectDiscoveryServiceImpl(),
      projectDetailsV2: new ProjectDetailsV2ServiceImpl({ session }),
      teamRoster: new TeamRosterServiceImpl(),
      workArea: new WorkAreaServiceImpl(),
      assignmentState: new SimulatedAssignmentStateService(),
      notification: new SimulatedNotificationService(),
      leaderboard: new LeaderboardServiceImpl(),
      session,
    }
  }

  return providerInstance
}

export function resetShare380Provider(): void {
  providerInstance = null
}
