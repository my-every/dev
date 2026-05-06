import type {
  IProjectDiscoveryService,
  ProjectDetail,
  ProjectFilter,
  ProjectSheet,
  ProjectSummary,
} from '@/lib/services/contracts/project-discovery-service'
import type { PaginatedResult, ServiceResult } from '@/lib/services/contracts'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function applyFilter(items: ProjectSummary[], filter?: ProjectFilter): ProjectSummary[] {
  if (!filter) return items

  let next = [...items]
  if (filter.search) {
    const q = filter.search.toLowerCase()
    next = next.filter(item => item.projectName.toLowerCase().includes(q) || item.pdNumber.toLowerCase().includes(q))
  }

  return next
}

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize
  const slice = items.slice(start, start + pageSize)
  return {
    items: slice,
    total: items.length,
    page,
    pageSize,
    hasMore: start + slice.length < items.length,
  }
}

export class ProjectDiscoveryServiceImpl implements IProjectDiscoveryService {
  private projects: ProjectSummary[] = []

  async discoverProjects(): Promise<ServiceResult<ProjectSummary[]>> {
    return ok(this.projects)
  }

  async getProjects(
    filter?: ProjectFilter,
    page = 1,
    pageSize = 25
  ): Promise<ServiceResult<PaginatedResult<ProjectSummary>>> {
    return ok(paginate(applyFilter(this.projects, filter), page, pageSize))
  }

  async getProjectById(_projectId: string): Promise<ServiceResult<ProjectDetail | null>> {
    return ok(null)
  }

  async getProjectByPdNumber(_pdNumber: string): Promise<ServiceResult<ProjectDetail | null>> {
    return ok(null)
  }

  async getProjectSheets(_projectId: string): Promise<ServiceResult<ProjectSheet[]>> {
    return ok([])
  }

  async getUpcomingProjects(limit = 10): Promise<ServiceResult<ProjectSummary[]>> {
    return ok(this.projects.filter(project => project.stage === 'upcoming').slice(0, limit))
  }

  async getLateProjects(limit = 10): Promise<ServiceResult<ProjectSummary[]>> {
    return ok(this.projects.filter(project => project.risk === 'late').slice(0, limit))
  }

  async getRecentlyUpdatedProjects(limit = 10): Promise<ServiceResult<ProjectSummary[]>> {
    const sorted = [...this.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return ok(sorted.slice(0, limit))
  }

  async refreshCache(): Promise<ServiceResult<void>> {
    return ok(undefined)
  }
}
