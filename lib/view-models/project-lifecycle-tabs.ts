import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import { getStageOrderIndex, getStagesForSwsType, getStageProgressionSummary } from "@/lib/assignment/stage-lifecycle";
import { normalizeLegacyBoardStageForLifecycle } from "@/lib/board/stage-workspaces";
import type { AssignmentDependencyGraph } from "@/types/d380-dependency-graph";
import { getStageDefinition, type AssignmentStageId, type ProjectLifecycleGateId, type ProjectLifecycleGateStatus, type SwsTypeId } from "@/types/d380-assignment-stages";
import type { ProjectManifest } from "@/types/project-manifest";

export type ProjectLifecycleTabId =
  | "LEGALS_READY"
  | "PROJECT_UPLOAD"
  | "BRANDLIST_COMPLETE"
  | "BRANDING_READY"
  | "READY_TO_LAY"
  | "BUILD_UP"
  | "READY_TO_WIRE"
  | "WIRING"
  | "WIRING_IPV"
  | "READY_TO_HANG"
  | "BOX_BUILD"
  | "READY_TO_CROSS_WIRE"
  | "CROSS_WIRE"
  | "CROSS_WIRE_IPV"
  | "READY_TO_TEST"
  | "TEST_1ST_PASS"
  | "POWER_CHECK"
  | "BIQ";

export type ProjectLifecycleCardState =
  | "locked"
  | "ready"
  | "current"
  | "blocked"
  | "completed"
  | "not_applicable";

export interface ProjectLifecycleAssignmentCardViewModel {
  assignmentSlug: string;
  sheetName: string;
  rowCount: number;
  swsType: string;
  currentStageId: AssignmentStageId;
  currentStageLabel: string;
  selectedStatus: MappedAssignment["selectedStatus"];
  state: ProjectLifecycleCardState;
  stateLabel: string;
  applicable: boolean;
  blockedReasons: string[];
  summary: string;
  progressPercent: number;
  href: string;
}

export interface ProjectLifecycleTabViewModel {
  id: ProjectLifecycleTabId;
  label: string;
  description: string;
  chipLabel?: string;
  kind: "milestone" | "work";
  isUnlocked: boolean;
  lockedReason?: string;
  assignmentCount: number;
  readyCount: number;
  blockedCount: number;
  completedCount: number;
  cards: ProjectLifecycleAssignmentCardViewModel[];
}

export interface ProjectLifecycleTabsViewModel {
  tabs: ProjectLifecycleTabViewModel[];
  recommendedTabId: ProjectLifecycleTabId;
}

const TAB_DEFINITIONS: Array<{
  id: ProjectLifecycleTabId;
  label: string;
  description: string;
  chipLabel?: string;
  kind: "milestone" | "work";
}> = [
  { id: "LEGALS_READY", label: "Legals", description: "Legals must be validated before project files can move into upload and downstream preparation.", chipLabel: "Gate", kind: "milestone" },
  { id: "PROJECT_UPLOAD", label: "Project Upload", description: "Workbook and layout artifacts must be uploaded before brand and floor execution can continue.", chipLabel: "Gate", kind: "milestone" },
  { id: "BRANDLIST_COMPLETE", label: "Brand List", description: "Brand list export and review must finish before branding can be released.", chipLabel: "Gate", kind: "milestone" },
  { id: "BRANDING_READY", label: "Branding", description: "Branding output must be complete before assignments can move into ready-to-lay release.", chipLabel: "Gate", kind: "milestone" },
  { id: "READY_TO_LAY", label: "Ready To Lay", description: "Assignments released after project-level gates are complete.", chipLabel: "Milestone", kind: "milestone" },
  { id: "BUILD_UP", label: "Build Up", description: "Mechanical assembly and pre-wire build execution.", kind: "work" },
  { id: "READY_TO_WIRE", label: "Build Up Review", description: "Build-up verification gate before assignments can move into wiring.", chipLabel: "Review", kind: "milestone" },
  { id: "WIRING", label: "Wire", description: "Internal wiring and device termination execution.", kind: "work" },
  { id: "WIRING_IPV", label: "Wire Review", description: "Wiring verification gate before panel hang and box work.", chipLabel: "Review", kind: "milestone" },
  { id: "READY_TO_HANG", label: "Ready for Box Build", description: "Assignments released from wiring and staged for enclosure work.", chipLabel: "Milestone", kind: "milestone" },
  { id: "BOX_BUILD", label: "Box Build", description: "Panel hang, box integration, and enclosure work.", kind: "work" },
  { id: "READY_TO_CROSS_WIRE", label: "Box Build Review", description: "Box build milestone before cross-wiring is released.", chipLabel: "Review", kind: "milestone" },
  { id: "CROSS_WIRE", label: "Cross Wire", description: "Cross-wire assignments unlock when project dependencies are satisfied.", kind: "work" },
  { id: "CROSS_WIRE_IPV", label: "Cross Wire Review", description: "Cross-wire verification gate before test release.", chipLabel: "Review", kind: "milestone" },
  { id: "READY_TO_TEST", label: "Test Ready", description: "Assignments staged and ready for test stations.", chipLabel: "Milestone", kind: "milestone" },
  { id: "TEST_1ST_PASS", label: "Test", description: "Assignments ready for electrical test and troubleshooting.", kind: "work" },
  { id: "POWER_CHECK", label: "Power Check", description: "Final powered validation before BIQ.", kind: "work" },
  { id: "BIQ", label: "BIQ", description: "Final built-in quality review and closeout.", kind: "work" },
];

const CARD_STATE_ORDER: Record<ProjectLifecycleCardState, number> = {
  ready: 0,
  current: 1,
  blocked: 2,
  completed: 3,
  locked: 4,
  not_applicable: 5,
};

function normalizeStage(stage: string | undefined): AssignmentStageId {
  return normalizeLegacyBoardStageForLifecycle(stage) ?? "READY_TO_LAY";
}

function getGateStatus(project: ProjectManifest, gateId: ProjectLifecycleGateId): ProjectLifecycleGateStatus | null {
  return project.lifecycleGates?.find((gate) => gate.gateId === gateId)?.status ?? null;
}

function isProjectGateComplete(project: ProjectManifest, gateId: ProjectLifecycleGateId) {
  const status = getGateStatus(project, gateId);
  return status === "COMPLETE";
}

function hasUploadedProjectFiles(project: ProjectManifest) {
  const hasWorkbook = Boolean(project.activeWorkbookRevisionId) || (project.sheets?.length ?? 0) > 0;
  const hasLayout = Boolean(project.activeLayoutRevisionId);
  return hasWorkbook && hasLayout;
}

function getStageGateReason(project: ProjectManifest, tabId: ProjectLifecycleTabId) {
  if (tabId === "LEGALS_READY") {
    const status = getGateStatus(project, "LEGALS_READY");
    return status === "LOCKED" ? "Legals must be uploaded and validated before this project can progress." : null;
  }

  if (tabId === "PROJECT_UPLOAD") {
    return null;
  }

  if (tabId === "BRANDLIST_COMPLETE") {
    if (!hasUploadedProjectFiles(project)) {
      return "Project upload must complete before the brand list can be reviewed and exported.";
    }

    return !isProjectGateComplete(project, "BRANDLIST_COMPLETE")
      ? "Brand list export and review are still pending."
      : null;
  }

  if (tabId === "BRANDING_READY") {
    if (!isProjectGateComplete(project, "BRANDLIST_COMPLETE")) {
      return "Brand list must be complete before branding can be released.";
    }

    return !isProjectGateComplete(project, "BRANDING_READY")
      ? "Branding is still pending."
      : null;
  }

  if (tabId !== "READY_TO_LAY") {
    return null;
  }

  if (!isProjectGateComplete(project, "BRANDING_READY")) {
    return "Branding must be complete before assignments can be released to the floor.";
  }

  if (project.lifecycleGates && !isProjectGateComplete(project, "KITTING_READY")) {
    return "Project kitting gate must be completed before assignments can be released.";
  }

  return null;
}

function getCardStateLabel(state: ProjectLifecycleCardState) {
  switch (state) {
    case "ready":
      return "Ready";
    case "current":
      return "Current";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Completed";
    case "not_applicable":
      return "Not Applicable";
    default:
      return "Locked";
  }
}

function buildCardSummary(
  assignment: MappedAssignment,
  state: ProjectLifecycleCardState,
  blockedReasons: string[],
) {
  if (state === "not_applicable") {
    return "This assignment does not participate in this stage.";
  }

  if (state === "completed") {
    return "This assignment has already passed this stage.";
  }

  if (state === "blocked") {
    return blockedReasons[0] ?? "Dependency or workflow blockers are preventing progress.";
  }

  if (state === "ready") {
    return "Dependencies are satisfied and this assignment can enter the stage.";
  }

  if (state === "current") {
    return "This is the assignment’s current active lifecycle position.";
  }

  return "Complete upstream dependency stages to unlock this assignment.";
}

function normalizeLifecycleSwsType(swsType: string | undefined): SwsTypeId {
  switch (String(swsType ?? "UNDECIDED")) {
    case "BOX":
      return "BOX_BUILD";
    case "RAIL":
      return "RAIL_BUILD";
    case "BLANK":
      return "BLANK_PANEL";
    case "COMPONENT":
      return "COMPONENT_BUILD";
    default:
      return String(swsType ?? "UNDECIDED") as SwsTypeId;
  }
}

export function buildProjectLifecycleTabs({
  project,
  assignments,
  graph,
}: {
  project: ProjectManifest;
  assignments: MappedAssignment[];
  graph: AssignmentDependencyGraph | null;
}): ProjectLifecycleTabsViewModel {
  const tabs = TAB_DEFINITIONS.map((tabDefinition): ProjectLifecycleTabViewModel => {
    const stageGateReason = getStageGateReason(project, tabDefinition.id);

    const gateCards =
      tabDefinition.id === "LEGALS_READY" ||
      tabDefinition.id === "PROJECT_UPLOAD" ||
      tabDefinition.id === "BRANDLIST_COMPLETE" ||
      tabDefinition.id === "BRANDING_READY";

    if (gateCards) {
      const cards = assignments
        .map<ProjectLifecycleAssignmentCardViewModel>((assignment) => {
          const currentStageId = normalizeStage(assignment.selectedStage);
          const progress = getStageProgressionSummary(
            currentStageId,
            normalizeLifecycleSwsType(assignment.selectedSwsType),
            assignment.requiresCrossWireSws,
          );

          let state: ProjectLifecycleCardState = "locked";

          if (tabDefinition.id === "LEGALS_READY") {
            const gateStatus = getGateStatus(project, "LEGALS_READY");
            state = gateStatus === "COMPLETE" ? "completed" : gateStatus === "LOCKED" ? "locked" : "current";
          } else if (tabDefinition.id === "PROJECT_UPLOAD") {
            state = hasUploadedProjectFiles(project)
              ? "completed"
              : "current";
          } else if (tabDefinition.id === "BRANDLIST_COMPLETE") {
            const gateStatus = getGateStatus(project, "BRANDLIST_COMPLETE");
            state = gateStatus === "COMPLETE"
              ? "completed"
              : hasUploadedProjectFiles(project)
                ? "current"
                : "locked";
          } else if (tabDefinition.id === "BRANDING_READY") {
            const gateStatus = getGateStatus(project, "BRANDING_READY");
            state = gateStatus === "COMPLETE"
              ? "completed"
              : isProjectGateComplete(project, "BRANDLIST_COMPLETE")
                ? "current"
                : "locked";
          }

          return {
            assignmentSlug: assignment.sheetSlug,
            sheetName: assignment.sheetName,
            rowCount: assignment.rowCount,
            swsType: assignment.selectedSwsType,
            currentStageId,
            currentStageLabel: tabDefinition.label,
            selectedStatus: assignment.selectedStatus,
            state,
            stateLabel: getCardStateLabel(state),
            applicable: true,
            blockedReasons: stageGateReason ? [stageGateReason] : [],
            summary:
              state === "completed"
                ? `${tabDefinition.label} is complete for this project.`
                : stageGateReason ?? `${tabDefinition.label} is still controlling downstream release for this assignment.`,
            progressPercent: progress.percentComplete,
            href: `/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(assignment.sheetSlug)}`,
          };
        })
        .sort((left, right) => left.sheetName.localeCompare(right.sheetName));

      const unlocked = cards.some((card) => card.state === "current" || card.state === "completed");

      return {
        id: tabDefinition.id,
        label: tabDefinition.label,
        description: tabDefinition.description,
        chipLabel: tabDefinition.chipLabel,
        kind: tabDefinition.kind,
        isUnlocked: unlocked,
        lockedReason: unlocked ? undefined : stageGateReason ?? `${tabDefinition.label} has not been released yet.`,
        assignmentCount: cards.length,
        readyCount: cards.filter((card) => card.state === "ready").length,
        blockedCount: cards.filter((card) => card.state === "blocked").length,
        completedCount: cards.filter((card) => card.state === "completed").length,
        cards,
      };
    }

    const cards = assignments
      .map<ProjectLifecycleAssignmentCardViewModel>((assignment) => {
        const currentStageId = normalizeStage(assignment.selectedStage);
        const targetStageId = tabDefinition.id as AssignmentStageId;
        const stageList = getStagesForSwsType(
          normalizeLifecycleSwsType(assignment.selectedSwsType),
          assignment.requiresCrossWireSws,
        );
        const applicable = stageList.includes(targetStageId);
        const currentStageIndex = getStageOrderIndex(currentStageId);
        const targetStageIndex = getStageOrderIndex(targetStageId);
        const node = graph?.nodeIndex.get(assignment.sheetSlug);
        const blockedReasons = node?.isBlocked ? node.readinessReasons : [];

        let state: ProjectLifecycleCardState = "locked";
        if (!applicable) {
          state = "not_applicable";
        } else if (currentStageIndex > targetStageIndex) {
          state = "completed";
        } else if (currentStageIndex === targetStageIndex) {
          if (assignment.selectedStatus === "COMPLETE") {
            state = "completed";
          } else if (assignment.selectedStatus === "IN_PROGRESS") {
            state = "current";
          } else if (node?.isBlocked || assignment.selectedStatus === "INCOMPLETE") {
            state = "blocked";
          } else {
            state = "current";
          }
        } else if (stageGateReason) {
          state = "locked";
        } else if (node?.isReady && node.nextSuggestedStage === tabDefinition.id) {
          state = "ready";
        } else {
          state = "locked";
        }

        const progress = getStageProgressionSummary(
          currentStageId,
          normalizeLifecycleSwsType(assignment.selectedSwsType),
          assignment.requiresCrossWireSws,
        );

        return {
          assignmentSlug: assignment.sheetSlug,
          sheetName: assignment.sheetName,
          rowCount: assignment.rowCount,
          swsType: assignment.selectedSwsType,
          currentStageId,
          currentStageLabel: getStageDefinition(currentStageId)?.label ?? currentStageId,
          selectedStatus: assignment.selectedStatus,
          state,
          stateLabel: getCardStateLabel(state),
          applicable,
          blockedReasons,
          summary: buildCardSummary(assignment, state, blockedReasons),
          progressPercent: progress.percentComplete,
          href: `/projects/${encodeURIComponent(project.id)}/assignments/${encodeURIComponent(assignment.sheetSlug)}`,
        };
      })
      .sort((left, right) => {
        const stateDelta = CARD_STATE_ORDER[left.state] - CARD_STATE_ORDER[right.state];
        if (stateDelta !== 0) {
          return stateDelta;
        }

        return left.sheetName.localeCompare(right.sheetName);
      });

    const actionableCards = cards.filter((card) => card.applicable);
    const unlocked = actionableCards.some((card) =>
      card.state === "ready" ||
      card.state === "current" ||
      card.state === "blocked" ||
      card.state === "completed",
    ) || (tabDefinition.id === "READY_TO_LAY" && !stageGateReason && actionableCards.length > 0);

    return {
      id: tabDefinition.id,
      label: tabDefinition.label,
      description: tabDefinition.description,
      chipLabel: tabDefinition.chipLabel,
      kind: tabDefinition.kind,
      isUnlocked: unlocked,
      lockedReason: unlocked ? undefined : stageGateReason ?? actionableCards.find((card) => card.state === "locked")?.summary,
      assignmentCount: actionableCards.length,
      readyCount: actionableCards.filter((card) => card.state === "ready").length,
      blockedCount: actionableCards.filter((card) => card.state === "blocked").length,
      completedCount: actionableCards.filter((card) => card.state === "completed").length,
      cards,
    };
  });

  const recommendedTabId =
    tabs.find((tab) => tab.cards.some((card) => card.state === "current"))?.id ??
    tabs.find((tab) => tab.cards.some((card) => card.state === "ready"))?.id ??
    tabs.find((tab) => tab.isUnlocked)?.id ??
    tabs[0]?.id ??
    "READY_TO_LAY";

  return {
    tabs,
    recommendedTabId,
  };
}
