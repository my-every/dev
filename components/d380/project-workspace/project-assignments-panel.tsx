import { ProjectAssignmentListItem } from '@/components/d380/project-workspace/project-assignment-list-item'
import { ProjectMetricCard } from '@/components/d380/project-workspace/project-metric-card'
import type { ProjectWorkspaceAssignmentsViewModel } from '@/types/d380-project-workspace'

export function ProjectAssignmentsPanel({ assignments }: { assignments: ProjectWorkspaceAssignmentsViewModel }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {assignments.summary.map(metric => <ProjectMetricCard key={metric.id} metric={metric} />)}
      </div>
      <div className="space-y-4">
        {assignments.assignments.map(assignment => <ProjectAssignmentListItem key={assignment.id} assignment={assignment} />)}
      </div>
    </section>
  )
}