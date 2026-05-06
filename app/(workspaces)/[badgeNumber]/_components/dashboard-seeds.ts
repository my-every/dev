import type { PrioritizedProjectCardVM, TeamMemberCardVM } from "./dashboard-side-panel-nav";
import type { ProjectLoadBarPoint } from "./dashboard-overview-types";

export type DashboardSeedBundle = {
  team: TeamMemberCardVM[];
  projects: PrioritizedProjectCardVM[];
  chart: ProjectLoadBarPoint[];
};

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function buildDashboardSeedBundle(): DashboardSeedBundle {
  const projects: PrioritizedProjectCardVM[] = [
    {
      id: "seed-prj-1",
      projectId: "seed-prj-1",
      pdNumber: "4M511",
      name: "ENI-K",
      revision: "B.1",
      dueDate: isoDaysFromNow(-2),
      daysLate: 2,
      priorityLabel: "urgent",
      lwc: "ONSKID",
      color: "#FACC15",
      assignmentCount: 24,
    },
    {
      id: "seed-prj-2",
      projectId: "seed-prj-2",
      pdNumber: "4K761",
      name: "DTE-CAL",
      revision: "B.1",
      dueDate: isoDaysFromNow(2),
      daysLate: 0,
      priorityLabel: "high",
      lwc: "OFFSKID",
      color: "#F59E0B",
      assignmentCount: 17,
    },
    {
      id: "seed-prj-3",
      projectId: "seed-prj-3",
      pdNumber: "4M082",
      name: "SR-COLE",
      revision: "C.1_M.2",
      dueDate: isoDaysFromNow(7),
      daysLate: 0,
      priorityLabel: "normal",
      lwc: "NEW_FLEX",
      color: "#10B981",
      assignmentCount: 12,
    },
    {
      id: "seed-prj-4",
      projectId: "seed-prj-4",
      pdNumber: "4L341",
      name: "PROP-81",
      revision: "0.6",
      dueDate: isoDaysFromNow(19),
      daysLate: 0,
      priorityLabel: "scheduled",
      lwc: "ONSKID",
      color: "#3B82F6",
      assignmentCount: 6,
    },
  ];

  const team: TeamMemberCardVM[] = [
    { badge: "75788", name: "Alejandra", role: "assembler", shift: "1st", lwc: "NEW_FLEX", availability: "AVAILABLE", activeAssignmentCount: 1 },
    { badge: "41052", name: "Alfonso", role: "assembler", shift: "1st", lwc: "ONSKID", availability: "OFF_SHIFT", activeAssignmentCount: 0 },
    { badge: "71050", name: "Alvin", role: "assembler", shift: "2nd", lwc: "OFFSKID", availability: "ON_ASSIGNMENT", activeAssignmentCount: 2 },
    { badge: "62531", name: "Martha", role: "team_lead", shift: "1st", lwc: "ONSKID", availability: "AVAILABLE", activeAssignmentCount: 1 },
  ];

  const chart: ProjectLoadBarPoint[] = projects.map((project, index) => ({
    projectId: project.projectId,
    projectName: project.name,
    pdNumber: project.pdNumber,
    lwc: project.lwc,
    lwcColor: project.lwc.toLowerCase().includes("off")
      ? "#F59E0B"
      : project.lwc.toLowerCase().includes("flex")
        ? "#10B981"
        : "#3B82F6",
    assignmentCount: project.assignmentCount,
    dueDate: project.dueDate,
    daysLate: project.daysLate,
    priorityBucket: (project.priorityLabel?.toLowerCase() as ProjectLoadBarPoint["priorityBucket"]) || "normal",
    priorityScore: 100 - index * 15,
    color: project.color,
    revision: project.revision,
  }));

  return { team, projects, chart };
}
