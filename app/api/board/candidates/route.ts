import { NextResponse } from 'next/server'

import { buildBoardData } from '@/lib/board/board-data'
import { getFollowingShiftId, getMemberRolePartCount, getMemberStageSkill } from '@/lib/board/assignment-flow'
import type { AssignmentStageRole } from '@/lib/board/stage-workspaces'
import type { BoardAssignmentView, BoardCandidateView } from '@/lib/board/types'
import type { ShiftId } from '@/types/shifts'
import { buildCompetencyReadinessPreview } from '@/lib/users/competency'

function normalizePartNumber(value: string) {
  return value.trim().toUpperCase()
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      assignmentIds?: string[]
      shiftId?: ShiftId | null
    }

    const assignmentIds = Array.from(new Set((body.assignmentIds ?? []).map(value => value.trim()).filter(Boolean)))
    if (assignmentIds.length === 0) {
      return NextResponse.json({ error: 'No assignment IDs were provided.' }, { status: 400 })
    }

    const data = await buildBoardData()
    const assignments = data.projects
      .flatMap(project => project.assignments)
      .filter(assignment => assignmentIds.includes(assignment.assignmentId))

    if (assignments.length === 0) {
      return NextResponse.json({ error: 'No assignments were found for candidate lookup.' }, { status: 404 })
    }

    const recommendedShiftId = body.shiftId ?? getFollowingShiftId()
    const stageRoles = Array.from(new Set(assignments.map(assignment => assignment.stageRole))) as AssignmentStageRole[]
    const selectedPartNumbers = Array.from(new Set(assignments.flatMap(assignment => assignment.partNumbers).map(normalizePartNumber)))
    const dominantLwcType = assignments[0]?.projectId
      ? data.projects.find(project => project.id === assignments[0]?.projectId)?.lwcType ?? null
      : null

    const candidates = data.members
      .map((member): BoardCandidateView => {
        const isShiftMatch = member.shift.startsWith(recommendedShiftId === '1st' ? '1' : '2')
        const isAvailableForShift = member.availabilityStatus === 'AVAILABLE' && member.availabilityShiftId === recommendedShiftId
        const stageSkillSummary = stageRoles.map(role => `${role} ${getMemberStageSkill(member, role)}`)
        const stageSkillScore = stageRoles.reduce((total, role) => total + getMemberStageSkill(member, role), 0)
        const matchedPartNumbers = selectedPartNumbers.filter((partNumber) =>
          stageRoles.some(role => getMemberRolePartCount(member, role, partNumber) > 0),
        )
        const partNumberMatchCount = matchedPartNumbers.length
        const activeAssignmentsCount = member.activeAssignments.length
        const lwcMatches = dominantLwcType ? member.primaryLwc === dominantLwcType : false
        const readinessPreview = buildCompetencyReadinessPreview({
          competencyProfile: member.competencyProfile,
          assignmentCompetency: member.assignmentCompetency,
          stageRole: stageRoles[0] ?? 'BUILD_UP',
          partNumbers: selectedPartNumbers,
        })
        const score =
          stageSkillScore * 18
          + partNumberMatchCount * 12
          + readinessPreview.matchedPartExperienceCount * 2
          + readinessPreview.completedTrainingCount * 3
          + (readinessPreview.readiness === 'qualified' ? 20 : readinessPreview.readiness === 'trainee' ? 8 : 0)
          + (isShiftMatch ? 20 : 0)
          + (isAvailableForShift ? 14 : 0)
          + (lwcMatches ? 6 : 0)
          - activeAssignmentsCount * 4

        return {
          badge: member.badge,
          fullName: member.fullName,
          preferredName: member.preferredName,
          initials: member.initials,
          role: member.role,
          shift: member.shift,
          primaryLwc: member.primaryLwc,
          availabilityStatus: member.availabilityStatus,
          availabilityShiftId: member.availabilityShiftId,
          yearsExperience: member.yearsExperience,
          stageSkillScore,
          stageSkillSummary,
          partNumberMatchCount,
          matchedPartNumbers,
          readiness: readinessPreview.readiness,
          readinessReasons: readinessPreview.reasons,
          qualification: readinessPreview.qualification,
          stageAssignmentCount: readinessPreview.stageAssignmentCount,
          matchedPartExperienceCount: readinessPreview.matchedPartExperienceCount,
          maxPartConfidence: readinessPreview.maxPartConfidence,
          assignedTrainingCount: readinessPreview.assignedTrainingCount,
          completedTrainingCount: readinessPreview.completedTrainingCount,
          requiredTrainingCount: readinessPreview.requiredTrainingCount,
          incompleteRequiredTrainingCount: readinessPreview.incompleteRequiredTrainingCount,
          activeAssignmentsCount,
          activeAssignments: member.activeAssignments,
          score,
          isRecommended: false,
        }
      })
      .sort((left, right) => {
        const leftAvailable = left.availabilityStatus === 'AVAILABLE' && left.availabilityShiftId === recommendedShiftId
        const rightAvailable = right.availabilityStatus === 'AVAILABLE' && right.availabilityShiftId === recommendedShiftId
        const leftShiftMatch = left.shift.startsWith(recommendedShiftId === '1st' ? '1' : '2')
        const rightShiftMatch = right.shift.startsWith(recommendedShiftId === '1st' ? '1' : '2')
        return Number(rightAvailable) - Number(leftAvailable)
          || Number(rightShiftMatch) - Number(leftShiftMatch)
          || right.score - left.score
          || left.fullName.localeCompare(right.fullName)
      })
      .map((candidate, index) => ({
        ...candidate,
        isRecommended: index < 3,
      }))

    return NextResponse.json({
      shiftId: recommendedShiftId,
      assignments: assignments.map((assignment: BoardAssignmentView) => ({
        assignmentId: assignment.assignmentId,
        sheetName: assignment.sheetName,
        stageRole: assignment.stageRole,
        partNumbers: assignment.partNumbers,
      })),
      candidates,
    })
  } catch (error) {
    console.error('[board/candidates] POST failed', error)
    return NextResponse.json({ error: 'Failed to resolve board candidates.' }, { status: 500 })
  }
}
