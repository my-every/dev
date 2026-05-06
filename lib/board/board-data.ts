import 'server-only'

import { listStoredProjects } from '@/lib/project-state/share-project-state-handlers'
import { readBoardAssignments } from '@/lib/board/board-store'
import { listBoardMemberProfiles } from '@/lib/board/team-members'
import { getAssignmentRoleLabel, mapStageToAssignmentRole } from '@/lib/board/stage-workspaces'
import { estimateMinutesForAssignment } from '@/lib/board/assignment-flow'
import type { ManifestAssignment, ProjectManifest } from '@/types/project-manifest'
import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import type { BoardAssignmentView, BoardDataResponse, BoardMemberView, BoardProjectView } from '@/lib/board/types'
import { normalizeCompetencyProfile } from '@/lib/users/competency'
import { FLOOR_AREAS, type FloorArea } from '@/types/floor-layout'

const manifestStageToBoardStage: Partial<Record<ManifestAssignment['stage'], AssignmentStage>> = {
  READY_TO_LAY: 'KITTED',
  BUILD_UP: 'BUILD_UP',
  READY_TO_WIRE: 'IPV1',
  WIRING: 'WIRING',
  READY_FOR_VISUAL: 'IPV1',
  WIRING_IPV: 'IPV2',
  READY_TO_HANG: 'IPV3',
  BOX_BUILD: 'BOX_BUILD',
  READY_TO_CROSS_WIRE: 'IPV3',
  CROSS_WIRE: 'CROSS_WIRING',
  CROSS_WIRE_IPV: 'IPV4',
  READY_TO_TEST: 'TEST_READY',
  TEST_1ST_PASS: 'TEST',
  POWER_CHECK: 'POWER_CHECK',
  READY_FOR_BIQ: 'BIQ',
  BIQ: 'BIQ',
  FINISHED_BIQ: 'COMPLETE',
}

function mapManifestStage(value: ManifestAssignment['stage']): AssignmentStage {
  return manifestStageToBoardStage[value] ?? 'KITTED'
}

function deriveProjectStatus(project: ProjectManifest) {
  const aggregates = project.aggregates

  if (!aggregates || aggregates.totalAssignments === 0) {
    return 'Ready'
  }

  if (aggregates.completedAssignments >= aggregates.totalAssignments) {
    return 'Complete'
  }

  if (aggregates.blockedAssignments > 0) {
    return 'Blocked'
  }

  if (aggregates.inProgressAssignments > 0) {
    return 'In Progress'
  }

  return 'Not Started'
}

function normalizeFloorArea(value: string | null | undefined): FloorArea | null {
  return value && FLOOR_AREAS.includes(value as FloorArea) ? (value as FloorArea) : null
}

function buildProjectAssignments(project: ProjectManifest): BoardAssignmentView[] {
  const persistedAssignments = readBoardAssignments()

  return Object.values(project.assignments)
    .filter(assignment => assignment.kind === 'operational')
    .map((assignment) => {
      const manifestBoardAssignment = assignment.boardAssignment
      const record = persistedAssignments[manifestBoardAssignment?.assignmentId ?? ''] ?? persistedAssignments[assignment.sheetSlug] ?? persistedAssignments[`${project.id}:${assignment.sheetSlug}`]
      const stage = mapManifestStage(assignment.stage)
      const stageRole = mapStageToAssignmentRole(stage)
      const stageRoleLabel = getAssignmentRoleLabel(stageRole)
      const assignmentView: BoardAssignmentView = {
        assignmentId: record?.assignmentId ?? manifestBoardAssignment?.assignmentId ?? `${project.id}:${assignment.sheetSlug}`,
        projectId: project.id,
        pdNumber: project.pdNumber,
        projectName: project.name,
        sheetSlug: assignment.sheetSlug,
        sheetName: assignment.sheetName,
        stage,
        stageRole,
        stageRoleLabel,
        status: assignment.status,
        partNumbers: assignment.partNumbers ?? [],
        estimatedMinutes: record?.partNumbers?.length || manifestBoardAssignment?.estimatedMinutes
          ? manifestBoardAssignment?.estimatedMinutes ?? estimateMinutesForAssignment({
            stageRole,
            partNumbers: assignment.partNumbers ?? [],
          })
          : estimateMinutesForAssignment({
          stageRole,
          partNumbers: assignment.partNumbers ?? [],
        }),
        assignedBadge: record?.assignedBadge ?? manifestBoardAssignment?.assignedBadge ?? null,
        assignedAt: record?.assignedAt ?? manifestBoardAssignment?.assignedAt ?? null,
        workspaceHref: record?.workspaceHref ?? null,
        workAreaId: record?.workAreaId ?? manifestBoardAssignment?.workAreaId ?? null,
        workAreaLabel: record?.workAreaLabel ?? manifestBoardAssignment?.workAreaLabel ?? null,
        floorArea: record?.floorArea ?? normalizeFloorArea(manifestBoardAssignment?.floorArea ?? null),
        shiftId: record?.shiftId ?? manifestBoardAssignment?.shiftId ?? null,
        scheduledDate: record?.scheduledDate ?? manifestBoardAssignment?.scheduledDate ?? null,
        startTime: record?.startTime ?? manifestBoardAssignment?.startTime ?? null,
        endTime: record?.endTime ?? manifestBoardAssignment?.endTime ?? null,
        queueIndex: record?.queueIndex ?? manifestBoardAssignment?.queueIndex ?? null,
        assignmentGroupId: record?.assignmentGroupId ?? manifestBoardAssignment?.assignmentGroupId ?? null,
        source: record?.source ?? manifestBoardAssignment?.source ?? null,
        operationCode: record?.operationCode ?? manifestBoardAssignment?.operationCode ?? null,
        workflowStatus: record?.workflowStatus ?? manifestBoardAssignment?.workflowStatus ?? ((record?.workAreaId ?? manifestBoardAssignment?.workAreaId) ? 'scheduled' : 'pending'),
        actualStartTime: record?.actualStartTime ?? manifestBoardAssignment?.actualStartTime ?? null,
        actualEndTime: record?.actualEndTime ?? manifestBoardAssignment?.actualEndTime ?? null,
        activeOperationEntryId: record?.activeOperationEntryId ?? manifestBoardAssignment?.activeOperationEntryId ?? null,
      }
      return assignmentView
    })
}

export async function buildBoardData(): Promise<BoardDataResponse> {
  const manifests = await listStoredProjects()
  const members = listBoardMemberProfiles()

  const projects: BoardProjectView[] = manifests.map(project => ({
    id: project.id,
    pdNumber: project.pdNumber,
    name: project.name,
    lwcType: String(project.lwcType ?? ''),
    unitNumber: project.unitNumber,
    status: deriveProjectStatus(project),
    assignments: buildProjectAssignments(project),
  }))

  const toUnknownRecord = (value: unknown) => value as Record<string, unknown>

  const boardMembers: BoardMemberView[] = members.map(member => ({
    badge: member.badge,
    fullName: member.fullName,
    preferredName: member.preferredName,
    initials: member.initials,
    role: member.role,
    shift: member.shift,
    primaryLwc: member.primaryLwc,
    yearsExperience: member.yearsExperience ?? 0,
    skills: member.skills ?? {},
    activeAssignments: (toUnknownRecord(member).activeAssignments as BoardMemberView['activeAssignments'] | undefined) ?? [],
    assignmentCompetency: (toUnknownRecord(member).assignmentCompetency as BoardMemberView['assignmentCompetency'] | undefined) ?? null,
    competencyProfile: normalizeCompetencyProfile(
      (toUnknownRecord(member).competencyProfile as BoardMemberView['competencyProfile'] | undefined) ?? null,
      (toUnknownRecord(member).assignmentCompetency as BoardMemberView['assignmentCompetency'] | undefined) ?? null,
    ),
    availabilityStatus: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.status as BoardMemberView['availabilityStatus'] | undefined) ?? 'OFF_SHIFT',
    availabilityShiftId: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.shiftId as BoardMemberView['availabilityShiftId'] | undefined) ?? null,
    availabilityUpdatedAt: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.updatedAt as string | undefined) ?? null,
    availabilityClockedInAt: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.clockedInAt as string | undefined) ?? null,
    availabilityClockedOutAt: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.clockedOutAt as string | undefined) ?? null,
    activeAssignmentId: ((toUnknownRecord(member).boardAvailability as Record<string, unknown> | undefined)?.activeAssignmentId as string | undefined) ?? null,
  }))

  return {
    projects,
    members: boardMembers,
    summary: {
      projectCount: projects.length,
      assignmentCount: projects.reduce((total, project) => total + project.assignments.length, 0),
      assignedCount: projects.reduce((total, project) => total + project.assignments.filter(assignment => assignment.assignedBadge).length, 0),
      memberCount: boardMembers.length,
    },
  }
}
