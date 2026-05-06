import type { ProfileWidgetConfig, UserRole, ProfileStat } from '@/types/profile'

// ============================================================================
// WIDGET REGISTRY - Defines all available widgets and their role visibility
// ============================================================================

export const PROFILE_WIDGET_REGISTRY: ProfileWidgetConfig[] = [
  // Manager Widgets
  {
    id: 'team-overview',
    title: 'Team Overview',
    roleVisibility: ['developer', 'manager', 'supervisor'],
    type: 'team_overview',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'project-health',
    title: 'Project Health',
    roleVisibility: ['developer', 'manager', 'supervisor', 'team_lead'],
    type: 'project_health',
    size: 'md',
  },
  {
    id: 'productivity-metrics',
    title: 'Productivity Metrics',
    roleVisibility: ['developer', 'manager'],
    type: 'performance',
    size: 'md',
  },
  {
    id: 'blockers-summary',
    title: 'Blockers Summary',
    roleVisibility: ['developer', 'manager', 'supervisor', 'team_lead'],
    type: 'list',
    size: 'md',
  },
  
  // Supervisor Widgets
  {
    id: 'shift-summary',
    title: 'Shift Summary',
    roleVisibility: ['developer', 'supervisor', 'team_lead'],
    type: 'shift_summary',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'active-assignments',
    title: 'Active Assignments',
    roleVisibility: ['developer', 'supervisor', 'team_lead', 'assembler'],
    type: 'assignments',
    size: 'md',
  },
  {
    id: 'workforce-distribution',
    title: 'Workforce Distribution',
    roleVisibility: ['developer', 'supervisor', 'manager'],
    type: 'stats',
    size: 'md',
  },
  {
    id: 'issue-alerts',
    title: 'Issue Alerts',
    roleVisibility: ['developer', 'supervisor', 'manager', 'qa'],
    type: 'list',
    size: 'sm',
  },
  
  // Team Lead Widgets
  {
    id: 'assigned-projects',
    title: 'Assigned Projects',
    roleVisibility: ['developer', 'team_lead'],
    type: 'list',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'workstation-occupancy',
    title: 'Workstation Occupancy',
    roleVisibility: ['developer', 'team_lead', 'supervisor'],
    type: 'stats',
    size: 'md',
  },
  {
    id: 'upcoming-assignments',
    title: 'Upcoming Assignments',
    roleVisibility: ['developer', 'team_lead', 'assembler'],
    type: 'timeline',
    size: 'md',
  },
  {
    id: 'stage-readiness',
    title: 'Stage Readiness',
    roleVisibility: ['developer', 'team_lead', 'qa'],
    type: 'status',
    size: 'md',
  },
  
  // QA Widgets
  {
    id: 'validation-queue',
    title: 'Validation Queue',
    roleVisibility: ['developer', 'qa'],
    type: 'validation_queue',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'discrepancy-counts',
    title: 'Discrepancy Counts',
    roleVisibility: ['developer', 'qa'],
    type: 'stats',
    size: 'md',
  },
  {
    id: 'recent-ipv-actions',
    title: 'Recent IPV Actions',
    roleVisibility: ['developer', 'qa'],
    type: 'timeline',
    size: 'md',
  },
  {
    id: 'audit-metrics',
    title: 'Audit Metrics',
    roleVisibility: ['developer', 'qa', 'manager'],
    type: 'performance',
    size: 'md',
  },
  
  // Brander Widgets
  {
    id: 'label-tasks',
    title: 'Label Tasks',
    roleVisibility: ['developer', 'brander'],
    type: 'label_tasks',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'pending-branding',
    title: 'Pending Branding',
    roleVisibility: ['developer', 'brander'],
    type: 'list',
    size: 'md',
  },
  {
    id: 'completed-branding',
    title: 'Completed Branding',
    roleVisibility: ['developer', 'brander'],
    type: 'stats',
    size: 'md',
  },
  {
    id: 'upcoming-queue',
    title: 'Upcoming Queue',
    roleVisibility: ['developer', 'brander'],
    type: 'timeline',
    size: 'md',
  },
  
  // Assembler Widgets
  {
    id: 'current-assignment',
    title: 'Current Assignment',
    roleVisibility: ['developer', 'assembler'],
    type: 'current_assignment',
    size: 'lg',
    colSpan: 2,
  },
  {
    id: 'assignment-history',
    title: 'Assignment History',
    roleVisibility: ['developer', 'assembler'],
    type: 'timeline',
    size: 'md',
  },
  {
    id: 'task-timer',
    title: 'Task Timer',
    roleVisibility: ['developer', 'assembler'],
    type: 'status',
    size: 'sm',
  },
  {
    id: 'completed-work',
    title: 'Completed Work',
    roleVisibility: ['developer', 'assembler'],
    type: 'stats',
    size: 'md',
  },
]

// ============================================================================
// GET WIDGETS BY ROLE - Filters the registry for a specific role
// ============================================================================

export function getWidgetsByRole(role: UserRole): ProfileWidgetConfig[] {
  return PROFILE_WIDGET_REGISTRY.filter((widget) =>
    widget.roleVisibility.includes(role)
  )
}

// ============================================================================
// ROLE-BASED STATS - Default stats shown for each role
// ============================================================================

export const ROLE_DEFAULT_STATS: Record<UserRole, ProfileStat[]> = {
  developer: [
    { id: 'total-routes', label: 'Total Routes', value: 14, icon: 'code' },
    { id: 'active-features', label: 'Active Features', value: 6, icon: 'git-branch' },
    { id: 'system-health', label: 'System Health', value: '100%', color: 'success', icon: 'shield' },
    { id: 'role-switches', label: 'Role Switches', value: 0, icon: 'repeat' },
  ],
  manager: [
    { id: 'team-size', label: 'Team Size', value: 24, icon: 'users' },
    { id: 'active-projects', label: 'Active Projects', value: 8, icon: 'folder' },
    { id: 'completion-rate', label: 'Completion Rate', value: '94%', color: 'success', icon: 'check' },
    { id: 'avg-cycle-time', label: 'Avg Cycle Time', value: '4.2d', icon: 'clock' },
  ],
  supervisor: [
    { id: 'shift-members', label: 'Shift Members', value: 12, icon: 'users' },
    { id: 'assignments-today', label: 'Assignments Today', value: 18, icon: 'clipboard' },
    { id: 'on-track', label: 'On Track', value: '89%', color: 'success', icon: 'trending-up' },
    { id: 'blockers', label: 'Blockers', value: 2, color: 'warning', icon: 'alert' },
  ],
  team_lead: [
    { id: 'team-members', label: 'Team Members', value: 6, icon: 'users' },
    { id: 'projects-assigned', label: 'Projects Assigned', value: 4, icon: 'folder' },
    { id: 'stage-progress', label: 'Stage Progress', value: '72%', color: 'info', icon: 'bar-chart' },
    { id: 'quality-score', label: 'Quality Score', value: '98%', color: 'success', icon: 'star' },
  ],
  qa: [
    { id: 'pending-validation', label: 'Pending Validation', value: 7, icon: 'clipboard' },
    { id: 'validated-today', label: 'Validated Today', value: 12, icon: 'check-circle' },
    { id: 'discrepancy-rate', label: 'Discrepancy Rate', value: '2.3%', color: 'success', icon: 'alert-triangle' },
    { id: 'audit-score', label: 'Audit Score', value: '99%', color: 'success', icon: 'shield' },
  ],
  brander: [
    { id: 'labels-pending', label: 'Labels Pending', value: 15, icon: 'tag' },
    { id: 'completed-today', label: 'Completed Today', value: 23, icon: 'check' },
    { id: 'accuracy-rate', label: 'Accuracy Rate', value: '99.5%', color: 'success', icon: 'target' },
    { id: 'avg-time', label: 'Avg Time/Label', value: '45s', icon: 'clock' },
  ],
  assembler: [
    { id: 'active-assignment', label: 'Active Assignment', value: 1, icon: 'wrench' },
    { id: 'completed-this-week', label: 'Completed This Week', value: 8, icon: 'check-circle' },
    { id: 'quality-score', label: 'Quality Score', value: '97%', color: 'success', icon: 'star' },
    { id: 'streak', label: 'Streak', value: '5 days', color: 'info', icon: 'zap' },
  ],
}
