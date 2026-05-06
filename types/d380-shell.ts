import type { ProjectWorkspaceAssignmentItemViewModel } from '@/types/d380-project-workspace'
import type { ProjectsBoardProjectCardViewModel } from '@/types/d380-projects-board'

export interface D380ShellNavItem {
  id: 'home' | 'projects' | 'schedule' | 'parts' | 'board' | 'leader-board' | 'tools'
  label: string
  href: string
}

export interface D380ShellCommandActionViewModel {
  id: string
  label: string
  description: string
  href: string
  group: 'Routes' | 'Projects' | 'Assignments'
  kind: 'route' | 'project' | 'assignment'
  shortcut?: string
}

export interface D380ShellAssignmentGroupViewModel {
  id: string
  pdNumber: string
  projectName: string
  member: string
  href: string
  assignments: ProjectWorkspaceAssignmentItemViewModel[]
}

export interface D380ShellViewModel {
  navItems: D380ShellNavItem[]
  commandActions: D380ShellCommandActionViewModel[]
  projectCards: ProjectsBoardProjectCardViewModel[]
  assignmentGroups: D380ShellAssignmentGroupViewModel[]
  summary: {
    operatingDateLabel: string
    totalProjects: number
    totalAssignments: number
    unreadNotifications: number
  }
}
