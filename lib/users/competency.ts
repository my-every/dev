import type { AssignmentStageRole } from "@/lib/board/stage-workspaces";
import type { UserAssignmentCompetencyLedger } from "@/lib/board/skill-ledger";

export type CompetencyConfidence = "1x" | "2x" | "3x" | "4x" | "5+";
export type CompetencyQualification = "trainee" | "qualified" | "trainer";
export type CompetencyReadiness = "needs-training" | "trainee" | "qualified";

export interface UserStageCompetencyExperience {
  assignmentCount: number;
  lastWorkedAt?: string;
  qualification: CompetencyQualification;
}

export interface UserDeviceCompetencyEntry {
  count: number;
  confidence?: CompetencyConfidence;
  lastWorkedAt?: string;
  notes?: string;
}

export interface UserTrainingCompetencyProgress {
  assignedModuleIds: string[];
  completedModuleIds: string[];
  inProgressModuleIds: string[];
  requiredModuleIds: string[];
  lastUpdatedAt?: string;
}

export interface UserCompetencyIntakeResponse {
  partNumber: string;
  confidence: CompetencyConfidence;
  notes?: string;
}

export interface UserCompetencyIntakeSubmission {
  submittedAt: string;
  stageRole: AssignmentStageRole;
  responses: UserCompetencyIntakeResponse[];
}

export interface UserCompetencyProfile {
  version: 1;
  stageExperience: Partial<Record<AssignmentStageRole, UserStageCompetencyExperience>>;
  deviceExperience: Partial<Record<AssignmentStageRole, Record<string, UserDeviceCompetencyEntry>>>;
  training: Partial<Record<AssignmentStageRole, UserTrainingCompetencyProgress>>;
  intakeResponses: Record<string, UserCompetencyIntakeSubmission>;
  updatedAt: string;
}

export interface UserCompetencyReadinessPreview {
  stageRole: AssignmentStageRole;
  qualification: CompetencyQualification;
  readiness: CompetencyReadiness;
  stageAssignmentCount: number;
  matchedPartExperienceCount: number;
  maxPartConfidence: CompetencyConfidence | null;
  assignedTrainingCount: number;
  completedTrainingCount: number;
  requiredTrainingCount: number;
  incompleteRequiredTrainingCount: number;
  reasons: string[];
}

const STAGE_ROLES: AssignmentStageRole[] = [
  "KITTING",
  "BRANDING",
  "BUILD_UP",
  "WIRING",
  "BOX_BUILD",
  "CROSS_WIRING",
  "TEST",
  "BIQ",
];

const CONFIDENCE_SCORE: Record<CompetencyConfidence, number> = {
  "1x": 1,
  "2x": 2,
  "3x": 3,
  "4x": 4,
  "5+": 5,
};

function normalizePartNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeQualification(
  value?: string | null,
  assignmentCount = 0,
): CompetencyQualification {
  if (value === "trainer" || value === "qualified" || value === "trainee") {
    return value;
  }
  if (assignmentCount >= 10) return "trainer";
  if (assignmentCount >= 3) return "qualified";
  return "trainee";
}

function normalizeConfidence(value?: string | null): CompetencyConfidence | undefined {
  switch (value) {
    case "1x":
    case "2x":
    case "3x":
    case "4x":
    case "5+":
      return value;
    default:
      return undefined;
  }
}

function sortAndDeduplicate(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort();
}

export function createDefaultCompetencyProfile(): UserCompetencyProfile {
  return {
    version: 1,
    stageExperience: {},
    deviceExperience: {},
    training: {},
    intakeResponses: {},
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCompetencyProfile(
  input: unknown,
  assignmentCompetency?: UserAssignmentCompetencyLedger | null,
): UserCompetencyProfile {
  const base = createDefaultCompetencyProfile();
  const parsed = input && typeof input === "object" ? (input as Partial<UserCompetencyProfile>) : {};

  const stageExperience: UserCompetencyProfile["stageExperience"] = {};
  const deviceExperience: UserCompetencyProfile["deviceExperience"] = {};
  const training: UserCompetencyProfile["training"] = {};

  for (const stageRole of STAGE_ROLES) {
    const stageCount = Number(
      parsed.stageExperience?.[stageRole]?.assignmentCount ??
      assignmentCompetency?.stageCounts?.[stageRole] ??
      0,
    );
    const storedStage = parsed.stageExperience?.[stageRole];
    if (stageCount > 0 || storedStage) {
      stageExperience[stageRole] = {
        assignmentCount: stageCount,
        lastWorkedAt: storedStage?.lastWorkedAt,
        qualification: normalizeQualification(storedStage?.qualification, stageCount),
      };
    }

    const storedDevices = parsed.deviceExperience?.[stageRole] ?? {};
    const ledgerDevices = assignmentCompetency?.stagePartNumberCounts?.[stageRole] ?? {};
    const deviceEntries: Record<string, UserDeviceCompetencyEntry> = {};
    for (const [partNumber, count] of Object.entries(ledgerDevices)) {
      const normalizedPart = normalizePartNumber(partNumber);
      deviceEntries[normalizedPart] = {
        count: Math.max(0, Number(count) || 0),
      };
    }
    for (const [partNumber, entry] of Object.entries(storedDevices)) {
      const normalizedPart = normalizePartNumber(partNumber);
      deviceEntries[normalizedPart] = {
        count: Math.max(deviceEntries[normalizedPart]?.count ?? 0, Math.max(0, Number(entry?.count) || 0)),
        confidence: normalizeConfidence(entry?.confidence) ?? deviceEntries[normalizedPart]?.confidence,
        lastWorkedAt: entry?.lastWorkedAt ?? deviceEntries[normalizedPart]?.lastWorkedAt,
        notes: entry?.notes?.trim() || deviceEntries[normalizedPart]?.notes,
      };
    }
    if (Object.keys(deviceEntries).length > 0) {
      deviceExperience[stageRole] = deviceEntries;
    }

    const storedTraining = parsed.training?.[stageRole];
    if (storedTraining) {
      training[stageRole] = {
        assignedModuleIds: sortAndDeduplicate(storedTraining.assignedModuleIds),
        completedModuleIds: sortAndDeduplicate(storedTraining.completedModuleIds),
        inProgressModuleIds: sortAndDeduplicate(storedTraining.inProgressModuleIds),
        requiredModuleIds: sortAndDeduplicate(storedTraining.requiredModuleIds),
        lastUpdatedAt: storedTraining.lastUpdatedAt,
      };
    }
  }

  const intakeResponses = Object.fromEntries(
    Object.entries(parsed.intakeResponses ?? {}).map(([templateId, submission]) => [
      templateId,
      {
        submittedAt: submission.submittedAt || new Date().toISOString(),
        stageRole: submission.stageRole,
        responses: Array.isArray(submission.responses)
          ? submission.responses
              .map((response) => ({
                partNumber: normalizePartNumber(response.partNumber),
                confidence: normalizeConfidence(response.confidence) ?? "1x",
                notes: response.notes?.trim() || undefined,
              }))
              .filter((response) => response.partNumber)
          : [],
      },
    ]),
  );

  return {
    ...base,
    ...parsed,
    stageExperience,
    deviceExperience,
    training,
    intakeResponses,
    updatedAt: parsed.updatedAt || assignmentCompetency?.updatedAt || base.updatedAt,
  };
}

export function mergeCompetencyProfilePatch(
  current: UserCompetencyProfile,
  patch: Partial<UserCompetencyProfile>,
): UserCompetencyProfile {
  return normalizeCompetencyProfile({
    ...current,
    ...patch,
    stageExperience: {
      ...current.stageExperience,
      ...(patch.stageExperience ?? {}),
    },
    deviceExperience: {
      ...current.deviceExperience,
      ...(patch.deviceExperience ?? {}),
    },
    training: {
      ...current.training,
      ...(patch.training ?? {}),
    },
    intakeResponses: {
      ...current.intakeResponses,
      ...(patch.intakeResponses ?? {}),
    },
    updatedAt: new Date().toISOString(),
  });
}

export function buildCompetencyReadinessPreview(params: {
  competencyProfile?: UserCompetencyProfile | null;
  assignmentCompetency?: UserAssignmentCompetencyLedger | null;
  stageRole: AssignmentStageRole;
  partNumbers: string[];
}): UserCompetencyReadinessPreview {
  const competency = normalizeCompetencyProfile(
    params.competencyProfile,
    params.assignmentCompetency,
  );
  const stageExperience = competency.stageExperience[params.stageRole];
  const deviceExperience = competency.deviceExperience[params.stageRole] ?? {};
  const training = competency.training[params.stageRole];
  const normalizedPartNumbers = Array.from(
    new Set(params.partNumbers.map(normalizePartNumber).filter(Boolean)),
  );

  let matchedPartExperienceCount = 0;
  let maxConfidenceScore = 0;

  for (const partNumber of normalizedPartNumbers) {
    const entry = deviceExperience[partNumber];
    if (!entry) continue;
    matchedPartExperienceCount += entry.count;
    maxConfidenceScore = Math.max(
      maxConfidenceScore,
      entry.confidence ? CONFIDENCE_SCORE[entry.confidence] : 0,
    );
  }

  const qualification = normalizeQualification(
    stageExperience?.qualification,
    stageExperience?.assignmentCount ?? 0,
  );
  const assignedTrainingCount = training?.assignedModuleIds.length ?? 0;
  const completedTrainingCount = training?.completedModuleIds.length ?? 0;
  const requiredTrainingCount = training?.requiredModuleIds.length ?? 0;
  const incompleteRequiredTrainingCount = Math.max(
    0,
    requiredTrainingCount - completedTrainingCount,
  );

  const reasons: string[] = [];
  let readiness: CompetencyReadiness = "needs-training";

  if (incompleteRequiredTrainingCount > 0) {
    reasons.push(`${incompleteRequiredTrainingCount} required training modules incomplete`);
  }
  if ((stageExperience?.assignmentCount ?? 0) > 0) {
    reasons.push(`${stageExperience?.assignmentCount ?? 0} prior stage assignments`);
  }
  if (matchedPartExperienceCount > 0) {
    reasons.push(`${matchedPartExperienceCount} matched device experiences`);
  }
  if (maxConfidenceScore > 0) {
    reasons.push(`intake confidence ${maxConfidenceScore}x`);
  }

  if (
    incompleteRequiredTrainingCount === 0 &&
    (
      qualification === "trainer" ||
      qualification === "qualified" ||
      (stageExperience?.assignmentCount ?? 0) >= 3 ||
      matchedPartExperienceCount >= 3 ||
      maxConfidenceScore >= 4
    )
  ) {
    readiness = "qualified";
  } else if (
    assignedTrainingCount > 0 ||
    completedTrainingCount > 0 ||
    (stageExperience?.assignmentCount ?? 0) > 0 ||
    matchedPartExperienceCount > 0 ||
    maxConfidenceScore > 0
  ) {
    readiness = "trainee";
  }

  return {
    stageRole: params.stageRole,
    qualification,
    readiness,
    stageAssignmentCount: stageExperience?.assignmentCount ?? 0,
    matchedPartExperienceCount,
    maxPartConfidence: (Object.entries(CONFIDENCE_SCORE).find(([, score]) => score === maxConfidenceScore)?.[0] as CompetencyConfidence | undefined) ?? null,
    assignedTrainingCount,
    completedTrainingCount,
    requiredTrainingCount,
    incompleteRequiredTrainingCount,
    reasons,
  };
}
