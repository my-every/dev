export type ProjectTaskTeamStage =
  | "BUILD_UP"
  | "WIRE"
  | "BOX_BUILD"
  | "CROSS_WIRE"
  | "TEST"
  | "BIQ";

export type ProjectTaskTeamAssignmentStrategy =
  | "default-user"
  | "round-robin"
  | "least-open-tasks";

export interface ProjectTaskTeam {
  id: string;
  name: string;
  stage: ProjectTaskTeamStage;
  assignmentStrategy: ProjectTaskTeamAssignmentStrategy;
  defaultAssigneeBadge?: string | null;
  memberBadges: string[];
  /** Compatibility tags for existing member competency/role fields. */
  skillTags: string[];
}
