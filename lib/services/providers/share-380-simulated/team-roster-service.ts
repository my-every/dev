import type {
  ITeamRosterService,
  MemberStatus,
  TeamMember,
  TeamMemberWithAssignments,
  TeamRosterFilter,
} from '@/lib/services/contracts/team-roster-service'
import type { ServiceResult, ShiftId } from '@/lib/services/contracts'

function ok<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    source: 'mock',
    timestamp: new Date().toISOString(),
  }
}

function makeMember(): TeamMember {
  return {
    badge: '1001',
    fullName: 'Demo User',
    firstName: 'Demo',
    lastName: 'User',
    initials: 'DU',
    shift: '1st',
    primaryRole: 'WIRING',
    secondaryRoles: ['BUILDUP'],
    status: 'active',
    lwcAffinities: ['ONSKID'],
    experiencedStages: [],
    traineeEligibleStages: [],
    workstationKinds: [],
    currentWorkAreaId: null,
    avatarPath: null,
    lastActivityAt: null,
    dataMode: 'mock',
  }
}

export class TeamRosterServiceImpl implements ITeamRosterService {
  private members: TeamMember[] = [makeMember()]

  async getMembers(): Promise<ServiceResult<TeamMember[]>> {
    return ok(this.members)
  }

  async getMembersWithAssignments(): Promise<ServiceResult<TeamMemberWithAssignments[]>> {
    return ok(this.members.map(member => ({
      ...member,
      currentProjectIds: [],
      currentSheetNames: [],
      priorCompletionProjectIds: [],
    })))
  }

  async getFilteredMembers(filter: TeamRosterFilter): Promise<ServiceResult<TeamMember[]>> {
    let filtered = [...this.members]
    if (filter.shift) filtered = filtered.filter(member => member.shift === filter.shift)
    if (filter.search) {
      const query = filter.search.toLowerCase()
      filtered = filtered.filter(
        member => member.badge.includes(query) || member.fullName.toLowerCase().includes(query)
      )
    }
    return ok(filtered)
  }

  async getMembersByShift(shift: ShiftId): Promise<ServiceResult<TeamMember[]>> {
    return ok(this.members.filter(member => member.shift === shift))
  }

  async getMemberByBadge(badge: string): Promise<ServiceResult<TeamMember | null>> {
    return ok(this.members.find(member => member.badge === badge) ?? null)
  }

  async getEligibleMembersForAssignment(
    _assignmentId: string,
    _workAreaId: string
  ): Promise<ServiceResult<TeamMemberWithAssignments[]>> {
    const members = await this.getMembersWithAssignments()
    return ok(members.data ?? [])
  }

  async updateMemberStatus(badge: string, status: MemberStatus): Promise<ServiceResult<TeamMember>> {
    const index = this.members.findIndex(member => member.badge === badge)
    if (index < 0) {
      return {
        data: null,
        error: `Member ${badge} not found`,
        source: 'mock',
        timestamp: new Date().toISOString(),
      }
    }

    this.members[index] = { ...this.members[index], status }
    return ok(this.members[index])
  }

  async assignMemberToWorkArea(badge: string, workAreaId: string): Promise<ServiceResult<TeamMember>> {
    const index = this.members.findIndex(member => member.badge === badge)
    if (index < 0) {
      return {
        data: null,
        error: `Member ${badge} not found`,
        source: 'mock',
        timestamp: new Date().toISOString(),
      }
    }

    this.members[index] = { ...this.members[index], currentWorkAreaId: workAreaId }
    return ok(this.members[index])
  }

  async clearMemberWorkArea(badge: string): Promise<ServiceResult<TeamMember>> {
    const index = this.members.findIndex(member => member.badge === badge)
    if (index < 0) {
      return {
        data: null,
        error: `Member ${badge} not found`,
        source: 'mock',
        timestamp: new Date().toISOString(),
      }
    }

    this.members[index] = { ...this.members[index], currentWorkAreaId: null }
    return ok(this.members[index])
  }

  async refreshRoster(): Promise<ServiceResult<void>> {
    return ok(undefined)
  }
}
