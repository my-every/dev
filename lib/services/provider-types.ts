import type { IAssignmentStateService } from '@/lib/services/contracts/assignment-state-service'
import type { ILeaderboardService } from '@/lib/services/contracts/leaderboard-service'
import type { INotificationService } from '@/lib/services/contracts/notification-service'
import type { IProjectDetailsV2Service } from '@/lib/services/contracts/project-details-v2-service'
import type { IProjectDiscoveryService } from '@/lib/services/contracts/project-discovery-service'
import type { ISessionService } from '@/lib/services/contracts/session-service'
import type { ITeamRosterService } from '@/lib/services/contracts/team-roster-service'
import type { IWorkAreaService } from '@/lib/services/contracts/work-area-service'
import type { IWorkspaceService } from '@/lib/services/contracts/workspace-service'

export interface Share380Provider {
  workspace: IWorkspaceService
  projectDiscovery: IProjectDiscoveryService
  projectDetailsV2: IProjectDetailsV2Service
  teamRoster: ITeamRosterService
  workArea: IWorkAreaService
  assignmentState: IAssignmentStateService
  notification: INotificationService
  leaderboard: ILeaderboardService
  session: ISessionService
}

export type AppProviderId = 'share-380-simulated'
