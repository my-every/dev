import type { D380LeaderboardEntryViewModel, D380LeaderboardViewModel } from '@/types/d380-leaderboard'
import type { D380ProjectWorkspaceDataSet } from '@/types/d380-project-workspace'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function getShiftLabel(shift: '1st' | '2nd') {
  return shift === '1st' ? '1st Shift' : '2nd Shift'
}

const MOCK_LEADERBOARD_ENTRIES: D380LeaderboardEntryViewModel[] = [
  { id: 'u1', name: 'Carlos Rivera', initials: 'CR', role: 'Builder', shiftLabel: '1st Shift', lwcLabel: 'ONSKID', assignmentCount: 12, activeAssignmentCount: 3, blockedAssignmentCount: 0, continuityMember: true, traineeLeadCount: 2, projectCount: 3, score: 186 },
  { id: 'u2', name: 'Maria Santos', initials: 'MS', role: 'Wirer', shiftLabel: '1st Shift', lwcLabel: 'OFFSKID', assignmentCount: 10, activeAssignmentCount: 2, blockedAssignmentCount: 0, continuityMember: true, traineeLeadCount: 1, projectCount: 2, score: 152 },
  { id: 'u3', name: 'James Chen', initials: 'JC', role: 'Builder', shiftLabel: '2nd Shift', lwcLabel: 'ONSKID', assignmentCount: 9, activeAssignmentCount: 2, blockedAssignmentCount: 1, continuityMember: false, traineeLeadCount: 0, projectCount: 2, score: 115 },
  { id: 'u4', name: 'Phi Dinh', initials: 'PD', role: 'Developer', shiftLabel: '1st Shift', lwcLabel: 'NEW/FLEX', assignmentCount: 8, activeAssignmentCount: 1, blockedAssignmentCount: 0, continuityMember: true, traineeLeadCount: 1, projectCount: 4, score: 110 },
  { id: 'u5', name: 'Aisha Patel', initials: 'AP', role: 'Tester', shiftLabel: '1st Shift', lwcLabel: 'ONSKID', assignmentCount: 7, activeAssignmentCount: 2, blockedAssignmentCount: 0, continuityMember: false, traineeLeadCount: 0, projectCount: 2, score: 98 },
  { id: 'u6', name: 'Derek Johnson', initials: 'DJ', role: 'Wirer', shiftLabel: '2nd Shift', lwcLabel: 'OFFSKID', assignmentCount: 6, activeAssignmentCount: 1, blockedAssignmentCount: 0, continuityMember: false, traineeLeadCount: 1, projectCount: 2, score: 80 },
  { id: 'u7', name: 'Tran Nguyen', initials: 'TN', role: 'Builder', shiftLabel: '1st Shift', lwcLabel: 'ONSKID', assignmentCount: 5, activeAssignmentCount: 1, blockedAssignmentCount: 0, continuityMember: false, traineeLeadCount: 0, projectCount: 1, score: 64 },
  { id: 'u8', name: 'Sarah Kim', initials: 'SK', role: 'Trainee', shiftLabel: '2nd Shift', lwcLabel: 'ONSKID', assignmentCount: 3, activeAssignmentCount: 1, blockedAssignmentCount: 0, continuityMember: false, traineeLeadCount: 0, projectCount: 1, score: 44 },
]

export function buildD380LeaderboardViewModel(dataSet?: D380ProjectWorkspaceDataSet): D380LeaderboardViewModel {
  // Return mock leaderboard if no data provided
  if (!dataSet || dataSet.projects.length === 0) {
    return {
      operatingDateLabel: dateFormatter.format(new Date()),
      summary: {
        activeAssignments: 14,
        continuityMembers: 3,
        staffedProjects: 4,
      },
      entries: MOCK_LEADERBOARD_ENTRIES,
    }
  }

  const entryMap = new Map<string, D380LeaderboardEntryViewModel>()

  for (const project of dataSet.projects) {
    for (const member of project.members) {
      const existing = entryMap.get(member.id)
      const activeAssignmentCount = project.assignments.filter(assignment => assignment.status === 'active' && assignment.assignedMemberIds.includes(member.id)).length
      const blockedAssignmentCount = project.assignments.filter(assignment => assignment.status === 'blocked' && assignment.assignedMemberIds.includes(member.id)).length
      const traineeLeadCount = project.traineePairings.filter(pairing => pairing.leadMemberId === member.id).length

      if (existing) {
        existing.assignmentCount += member.assignmentIds.length
        existing.activeAssignmentCount += activeAssignmentCount
        existing.blockedAssignmentCount += blockedAssignmentCount
        existing.traineeLeadCount += traineeLeadCount
        existing.projectCount += 1
        existing.score += member.assignmentIds.length * 10 + activeAssignmentCount * 14 + traineeLeadCount * 6 + (member.continuityMember ? 12 : 0) - blockedAssignmentCount * 3
        continue
      }

      entryMap.set(member.id, {
        id: member.id,
        name: member.name,
        initials: member.initials,
        role: member.role,
        shiftLabel: getShiftLabel(member.shift),
        lwcLabel: member.lwc,
        assignmentCount: member.assignmentIds.length,
        activeAssignmentCount,
        blockedAssignmentCount,
        continuityMember: member.continuityMember,
        traineeLeadCount,
        projectCount: 1,
        score: member.assignmentIds.length * 10 + activeAssignmentCount * 14 + traineeLeadCount * 6 + (member.continuityMember ? 12 : 0) - blockedAssignmentCount * 3,
      })
    }
  }

  const entries = [...entryMap.values()].sort((left, right) => right.score - left.score)

  return {
    operatingDateLabel: dateFormatter.format(new Date(`${dataSet.operatingDate}T00:00:00`)),
    summary: {
      activeAssignments: dataSet.projects.reduce((total, project) => total + project.assignments.filter(assignment => assignment.status === 'active').length, 0),
      continuityMembers: entries.filter(entry => entry.continuityMember).length,
      staffedProjects: dataSet.projects.length,
    },
    entries,
  }
}
