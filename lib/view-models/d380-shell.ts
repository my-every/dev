import type { D380ShellCommandActionViewModel, D380ShellNavItem, D380ShellViewModel } from '@/types/d380-shell'

const navItems: D380ShellNavItem[] = [
  { id: 'projects', label: 'Projects', href: '/380?to=projects' },
  { id: 'schedule', label: 'Schedule', href: '/380?to=schedule' },
  { id: 'parts', label: 'Parts', href: '/380?to=parts' },
]

export function getD380ShellNavItems() {
  return navItems
}

export function buildD380ShellViewModel(): D380ShellViewModel {
  // Build shell view model with minimal data - no mock dependencies
  const routeActions: D380ShellCommandActionViewModel[] = [
    ...navItems.map(item => ({
      id: `route-${item.id}`,
      label: item.label,
      description: `Open ${item.label.toLowerCase()} workspace`,
      href: item.href,
      group: 'Routes' as const,
      kind: 'route' as const,
      shortcut: item.id === 'tools' ? 'G T' : undefined,
    })),
  ]

  return {
    navItems,
    commandActions: routeActions,
    projectCards: [],
    assignmentGroups: [],
    summary: {
      operatingDateLabel: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalProjects: 0,
      totalAssignments: 0,
      unreadNotifications: 0,
    },
  }
}
