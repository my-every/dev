/**
 * Priority List types for project scheduling/tracking.
 */

/** Stage keys matching the collapsible section groupings */
export type PriorityStage =
    | "upcoming"
    | "kitting"
    | "conlay"
    | "conassy"
    | "test"
    | "pwr-check"
    | "biq"
    | "completed";

/** A single row (unit) in the priority list */
export interface PriorityEntry {
    id: string;
    cmNumber: string;
    customer: string;
    unit: string;
    pd: string;
    lwc: string;
    planConlay: string;
    conassy: string;
    target: string;
    concus: string;
    productionPlanner: string;
    unitLocation: string;
    status: string;
    shortagesNotes: string;
    /** Computed stage based on CSV section + status analysis */
    stage: PriorityStage;
    /** Original CSV section header the row was found under */
    csvSection: string;
}

/** Stage metadata for rendering */
export interface PriorityStageConfig {
    id: PriorityStage;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

/** Full priority list state */
export interface PriorityListData {
    entries: PriorityEntry[];
    importedAt: string;
    filename: string;
}

/** Stage configuration registry */
export const PRIORITY_STAGE_CONFIG: Record<PriorityStage, PriorityStageConfig> = {
    upcoming: {
        id: "upcoming",
        label: "Upcoming Projects",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
    },
    kitting: {
        id: "kitting",
        label: "Kitting",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        borderColor: "border-purple-200 dark:border-purple-800",
    },
    conlay: {
        id: "conlay",
        label: "Conlay",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
        borderColor: "border-indigo-200 dark:border-indigo-800",
    },
    conassy: {
        id: "conassy",
        label: "Conassy",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800",
    },
    test: {
        id: "test",
        label: "Test",
        color: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
        borderColor: "border-cyan-200 dark:border-cyan-800",
    },
    "pwr-check": {
        id: "pwr-check",
        label: "PWR Check",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        borderColor: "border-orange-200 dark:border-orange-800",
    },
    biq: {
        id: "biq",
        label: "BIQ",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        borderColor: "border-emerald-200 dark:border-emerald-800",
    },
    completed: {
        id: "completed",
        label: "Completed",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
    },
};

/** Ordered list of stages for rendering sections */
export const PRIORITY_STAGE_ORDER: PriorityStage[] = [
    "upcoming",
    "kitting",
    "conlay",
    "conassy",
    "test",
    "pwr-check",
    "biq",
    "completed",
];
