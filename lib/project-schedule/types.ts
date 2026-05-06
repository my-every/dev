export type ProjectScheduleCellValue = string | number;

export interface ProjectScheduleColumn {
    key: string;
    label: string;
    filterable?: boolean;
}

export interface ProjectScheduleRow {
    id: string;
    [key: string]: ProjectScheduleCellValue;
}

export interface ProjectScheduleGroup {
    id: string;
    projectLabel: string;
    rows: ProjectScheduleRow[];
}

export interface ProjectScheduleDocument {
    columns: ProjectScheduleColumn[];
    groups: ProjectScheduleGroup[];
    importedAt: string;
    sourceFile?: string;
}

export interface ScheduleProject {
    id: string;
    name: string;
    customer: string;
    unit: string;
    pd: string;
    legals: string;
    sw: string;
    wo: string;
    proj: string;
    conlay: string;
    conasy: string;
    test: string;
    concus: string;
    pwrchk: string;
    d380Final: string;
    dept380: string;
    daysLate: number;
    commit: string;
    biqComp: string;
    hide: string;
    comments: string;
}

export interface Schedule {
    importedAt: string;
    sourceFile: string;
    projects: Record<string, ScheduleProject>;
}

export type ProjectScheduleActualMilestoneKey =
    | "actualLegalsAt"
    | "actualProjKittedAt"
    | "actualConlayAt"
    | "actualConassyAt"
    | "actualTestFirstPassAt"
    | "actualPwrchkAt"
    | "actualD380FinalAt"
    | "actualDept380CompletedAt";

export interface ProjectScheduleActualMilestones {
    actualLegalsAt?: string;
    actualProjKittedAt?: string;
    actualConlayAt?: string;
    actualConassyAt?: string;
    actualTestFirstPassAt?: string;
    actualPwrchkAt?: string;
    actualD380FinalAt?: string;
    actualDept380CompletedAt?: string;
}

export interface ProjectScheduleActualsRecord {
    key: string;
    projectId?: string;
    pdNumber: string;
    unit: string;
    projectName: string;
    assignedTeamLeadBadge?: string;
    priorityMemberBadge?: string;
    notes?: string;
    milestoneActuals: ProjectScheduleActualMilestones;
    updatedAt: string;
    updatedBy?: string;
}

export interface ProjectScheduleActualsDocument {
    records: Record<string, ProjectScheduleActualsRecord>;
    updatedAt: string;
    sourceFile?: string;
}

export interface ProjectScheduleActualsPatchRequest {
    key?: string;
    projectId?: string;
    pdNumber?: string;
    unit?: string;
    projectName?: string;
    assignedTeamLeadBadge?: string | null;
    priorityMemberBadge?: string | null;
    notes?: string | null;
    milestoneActuals?: Partial<ProjectScheduleActualMilestones>;
    updatedBy?: string;
}

export interface ProjectScheduleComparisonRow {
    key: string;
    projectId?: string;
    pdNumber: string;
    unit: string;
    projectName: string;
    sourceValues: Record<string, string>;
    plannedLegals?: string;
    plannedProjKitted?: string;
    plannedConlay?: string;
    plannedConassy?: string;
    plannedTestFirstPass?: string;
    plannedPwrchk?: string;
    plannedD380Final?: string;
    plannedDept380Target?: string;
    plannedCommit?: string;
    plannedDaysLate?: number;
    actuals?: ProjectScheduleActualsRecord;
    varianceDaysToTarget?: number | null;
    completedOnTime?: boolean | null;
}

export interface ProjectScheduleComparisonDocument {
    rows: ProjectScheduleComparisonRow[];
    importedAt: string;
    actualsUpdatedAt: string;
    sourceFile?: string;
}
