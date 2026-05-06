import type { ProjectTaskTeam } from "@/types/project-task-team";

const TASK_TEAMS: ProjectTaskTeam[] = [
  {
    id: "team-build-up",
    name: "Build Up",
    stage: "BUILD_UP",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["BUILDUP"],
  },
  {
    id: "team-wire",
    name: "Wire",
    stage: "WIRE",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["WIRING"],
  },
  {
    id: "team-box-build",
    name: "Box Build",
    stage: "BOX_BUILD",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["WIRING", "BUILDUP"],
  },
  {
    id: "team-cross-wire",
    name: "Cross Wire",
    stage: "CROSS_WIRE",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["WIRING"],
  },
  {
    id: "team-test",
    name: "Test",
    stage: "TEST",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["TEST"],
  },
  {
    id: "team-biq",
    name: "BIQ",
    stage: "BIQ",
    assignmentStrategy: "default-user",
    defaultAssigneeBadge: null,
    memberBadges: [],
    skillTags: ["TEST"],
  },
];

export function listProjectTaskTeams(): ProjectTaskTeam[] {
  return TASK_TEAMS;
}

export function getProjectTaskTeamById(teamId?: string | null): ProjectTaskTeam | null {
  if (!teamId) return null;
  return TASK_TEAMS.find((team) => team.id === teamId) ?? null;
}
