export interface D380LeaderboardEntryViewModel {
  id: string
  name: string
  initials: string
  role: string
  shiftLabel: string
  lwcLabel: string
  assignmentCount: number
  activeAssignmentCount: number
  blockedAssignmentCount: number
  continuityMember: boolean
  traineeLeadCount: number
  projectCount: number
  score: number
}

export interface D380LeaderboardViewModel {
  operatingDateLabel: string
  summary: {
    activeAssignments: number
    continuityMembers: number
    staffedProjects: number
  }
  entries: D380LeaderboardEntryViewModel[]
}