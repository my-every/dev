import { readProfileFromShare, writeProfileToShare, type ShareUserProfile } from '@/lib/profile/share-profile-store'
import type { AssignmentStage } from '@/lib/services/contracts/assignment-state-service'
import { getAssignmentRoleLabel, mapStageToAssignmentRole, type AssignmentStageRole } from '@/lib/board/stage-workspaces'

export interface UserStageCompetencySnapshot {
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetName: string
  sheetSlug: string
  stage: AssignmentStage
  stageRole: AssignmentStageRole
  workspaceHref: string
  partNumbers: string[]
  assignedAt: string
  assignedByBadge: string
}

export interface UserAssignmentCompetencyLedger {
  version: 1
  stageCounts: Partial<Record<AssignmentStageRole, number>>
  stagePartNumberCounts: Partial<Record<AssignmentStageRole, Record<string, number>>>
  latestAssignments: UserStageCompetencySnapshot[]
  updatedAt: string
}

const DEFAULT_SKILL_KEYS = {
  brandList: 0,
  branding: 0,
  buildUp: 0,
  wiring: 0,
  wiringIpv: 0,
  boxBuild: 0,
  crossWire: 0,
  test: 0,
  pwrCheck: 0,
  biq: 0,
  greenChange: 0,
  kitting: 0,
} as const

function normalizePartNumber(value: string) {
  return value.trim().toUpperCase()
}

function toSkillKey(role: AssignmentStageRole): keyof typeof DEFAULT_SKILL_KEYS {
  switch (role) {
    case 'KITTING':
      return 'kitting'
    case 'BRANDING':
      return 'branding'
    case 'BUILD_UP':
      return 'buildUp'
    case 'WIRING':
      return 'wiring'
    case 'BOX_BUILD':
      return 'boxBuild'
    case 'CROSS_WIRING':
      return 'crossWire'
    case 'TEST':
      return 'test'
    case 'BIQ':
      return 'biq'
  }
}

function deriveCompetencyLevel(partCounts: Record<string, number> | undefined) {
  if (!partCounts) {
    return 0
  }

  const maxCount = Object.values(partCounts).reduce((highest, value) => Math.max(highest, value), 0)
  return Math.max(0, Math.min(5, maxCount))
}

function readLedger(profile: ShareUserProfile): UserAssignmentCompetencyLedger {
  const existing = (profile as ShareUserProfile & {
    assignmentCompetency?: UserAssignmentCompetencyLedger
  }).assignmentCompetency

  if (existing?.version === 1) {
    return existing
  }

  return {
    version: 1,
    stageCounts: {},
    stagePartNumberCounts: {},
    latestAssignments: [],
    updatedAt: new Date().toISOString(),
  }
}

export async function recordAssignmentCompetency(params: {
  badge: string
  assignmentId: string
  projectId: string
  projectName: string
  pdNumber: string
  sheetName: string
  sheetSlug: string
  stage: AssignmentStage
  partNumbers: string[]
  assignedAt: string
  assignedByBadge: string
  workspaceHref: string
}) {
  const profile = await readProfileFromShare(params.badge)
  if (!profile) {
    return null
  }

  const stageRole = mapStageToAssignmentRole(params.stage)
  const ledger = readLedger(profile)
  const nextStageCounts = { ...ledger.stageCounts }
  const nextStagePartNumberCounts = { ...ledger.stagePartNumberCounts }
  const rolePartCounts = { ...(nextStagePartNumberCounts[stageRole] ?? {}) }
  const uniquePartNumbers = Array.from(new Set(params.partNumbers.map(normalizePartNumber).filter(Boolean)))

  nextStageCounts[stageRole] = (nextStageCounts[stageRole] ?? 0) + 1

  for (const partNumber of uniquePartNumbers) {
    rolePartCounts[partNumber] = (rolePartCounts[partNumber] ?? 0) + 1
  }

  nextStagePartNumberCounts[stageRole] = rolePartCounts

  const latestAssignments = [
    {
      assignmentId: params.assignmentId,
      projectId: params.projectId,
      projectName: params.projectName,
      pdNumber: params.pdNumber,
      sheetName: params.sheetName,
      sheetSlug: params.sheetSlug,
      stage: params.stage,
      stageRole,
      workspaceHref: params.workspaceHref,
      partNumbers: uniquePartNumbers,
      assignedAt: params.assignedAt,
      assignedByBadge: params.assignedByBadge,
    },
    ...ledger.latestAssignments.filter(entry => entry.assignmentId !== params.assignmentId),
  ].slice(0, 20)

  const nextLedger: UserAssignmentCompetencyLedger = {
    version: 1,
    stageCounts: nextStageCounts,
    stagePartNumberCounts: nextStagePartNumberCounts,
    latestAssignments,
    updatedAt: new Date().toISOString(),
  }

  const nextSkills = {
    ...DEFAULT_SKILL_KEYS,
    ...(profile.skills ?? {}),
  }

  for (const role of Object.keys(nextStagePartNumberCounts) as AssignmentStageRole[]) {
    const skillKey = toSkillKey(role)
    nextSkills[skillKey] = deriveCompetencyLevel(nextStagePartNumberCounts[role])
  }

  return writeProfileToShare(params.badge, {
    skills: nextSkills,
    assignmentCompetency: nextLedger,
    activeAssignments: latestAssignments.map(entry => ({
      assignmentId: entry.assignmentId,
      projectId: entry.projectId,
      projectName: entry.projectName,
      pdNumber: entry.pdNumber,
      sheetName: entry.sheetName,
      sheetSlug: entry.sheetSlug,
      stage: entry.stage,
      stageRole: entry.stageRole,
      stageRoleLabel: getAssignmentRoleLabel(entry.stageRole),
      workspaceHref: entry.workspaceHref,
      partNumbers: entry.partNumbers,
      assignedAt: entry.assignedAt,
      assignedByBadge: entry.assignedByBadge,
      actualStartTime: null,
      actualEndTime: null,
    })),
  } as Partial<ShareUserProfile> & Record<string, unknown>)
}

export async function removeActiveAssignmentFromProfile(badge: string, assignmentId: string) {
  const profile = await readProfileFromShare(badge)
  if (!profile) {
    return null
  }

  const activeAssignments = (((profile as Record<string, unknown>).activeAssignments as Array<Record<string, unknown>> | undefined) ?? [])
    .filter(entry => String(entry.assignmentId ?? '') !== assignmentId)

  return writeProfileToShare(badge, {
    activeAssignments,
  } as Partial<ShareUserProfile> & Record<string, unknown>)
}
