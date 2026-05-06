export type SWSMetricItem = {
    label: string;
    value: string;
    note: string;
};

export type SWSChecklistItem = {
    title: string;
    note: string;
    status?: string;
};

export type SWSChecklistGroupItem = {
    id: string;
    title: string;
    note: string;
    count: string;
    items: SWSChecklistItem[];
};

export type SWSTaskItem = {
    title: string;
    detail: string;
    status?: string;
};

export type SWSRelationItem = {
    title: string;
    detail: string;
    kind: string;
};

export type SWSExecutionLogItem = {
    title: string;
    detail: string;
    timestamp: string;
};

export const SWS_PANEL_SUMMARY = {
    eyebrow: "Workflow",
    title: "SWS Details",
    subtitle: "Sections, operations, execution history, and review state",
    status: "Draft",
    headline: "SWS-IPV_D380_ASY-2417",
    subline: "Interior panel validation workflow",
    chips: ["Assembly", "v3.2", "6 groups"],
};

export const SWS_SUBHEADER = {
    id: "SWS-IPV_D380_ASY-2417",
    title: "Interior panel validation workflow",
    status: "Draft",
    kind: "Assembly",
    version: "v3.2",
    groupCount: "6 groups",
    taskCount: "24 tasks",
};

export const SWS_METRICS: SWSMetricItem[] = [
    { label: "Groups", value: "6", note: "Checklist groups" },
    { label: "Tasks", value: "24", note: "Across all groups" },
    { label: "Operations", value: "14", note: "Linked records" },
    { label: "Linked Parts", value: "8", note: "Part references" },
];

export const SWS_DESCRIPTION = [
    "Validates interior panel assembly steps before release to downstream review.",
    "Bundles checklist groups, task sequencing, and operation references into one execution surface.",
    "Used by D380 assembly teams for repeatable first-pass verification.",
];

export const SWS_ACCESSORY_HINTS = [
    "Confirm accessory kit is staged before starting group 02.",
    "Use the updated terminal marker reference for the current revision.",
    "Verify locking hardware quantities match the conlay packet.",
    "Escalate shortages before executing final validation tasks.",
];

export const SWS_REVIEW_REQUIREMENTS = [
    "Member approval is required before publishing a new execution revision.",
    "Checklist groups with linked operations must be reviewed weekly.",
    "Execution output must be retained for QA audits.",
];

export const SWS_BLOCKERS = [
    "Missing accessory hardware blocks execution for group 03.",
    "Unresolved operation mismatch prevents final approval export.",
];

export const SWS_CHECKLIST_GROUPS: SWSChecklistGroupItem[] = [
    {
        id: "grp-01",
        title: "Preparation",
        note: "Staging, packet checks, and material readiness",
        count: "3 steps",
        items: [
            { title: "Confirm packet revision", note: "Match latest workbook revision", status: "Required" },
            { title: "Stage accessory kit", note: "Ensure accessory bag is present" },
            { title: "Validate labels", note: "Print batch must match unit range" },
        ],
    },
    {
        id: "grp-02",
        title: "Assembly",
        note: "Core build and marker placement",
        count: "4 steps",
        items: [
            { title: "Install terminal strip", note: "Use current spacing guide", status: "Critical" },
            { title: "Route harness", note: "Follow panel-side routing reference" },
            { title: "Apply marker set", note: "Confirm sequence before lock-in" },
        ],
    },
    {
        id: "grp-03",
        title: "Verification",
        note: "Review and validation before handoff",
        count: "5 steps",
        items: [
            { title: "Run continuity check", note: "Capture output in execution log" },
            { title: "Inspect fasteners", note: "Torque verify critical mounts" },
            { title: "QA signoff prep", note: "Attach validation packet" },
        ],
    },
    {
        id: "grp-04",
        title: "Release",
        note: "Final readiness and downstream sync",
        count: "2 steps",
        items: [
            { title: "Publish execution record", note: "Lock revision and export summary" },
            { title: "Notify downstream member", note: "Send release note to next station" },
        ],
    },
];

export const SWS_TASKS: SWSTaskItem[] = [
    { title: "Confirm packet revision", detail: "Preparation group • Latest workbook revision", status: "Required" },
    { title: "Stage accessory kit", detail: "Preparation group • Material check" },
    { title: "Validate labels", detail: "Preparation group • Marker batch verification" },
    { title: "Install terminal strip", detail: "Assembly group • Critical build step", status: "Critical" },
    { title: "Route harness", detail: "Assembly group • Routing reference" },
    { title: "Apply marker set", detail: "Assembly group • Sequence verification" },
    { title: "Run continuity check", detail: "Verification group • Save execution output", status: "Gate" },
    { title: "Inspect fasteners", detail: "Verification group • Torque check" },
    { title: "Publish execution record", detail: "Release group • Export summary" },
    { title: "Notify downstream member", detail: "Release group • Handoff sync" },
];

export const SWS_RELATIONS: SWSRelationItem[] = [
    { title: "PD-2417 / Unit 03", detail: "Project operation", kind: "Project" },
    { title: "PN-380-4412", detail: "Primary linked part", kind: "Part" },
    { title: "Validation refresher", detail: "Assigned training module", kind: "Training" },
    { title: "Assembly stack A", detail: "Execution target stack", kind: "Stack" },
    { title: "REV-2417-C", detail: "Current revision dependency", kind: "Revision" },
    { title: "QA packet export", detail: "Required output document", kind: "Document" },
];

export const SWS_EXECUTION_LOG: SWSExecutionLogItem[] = [
    { title: "Execution run completed", detail: "Validation output saved successfully for unit 03.", timestamp: "14 minutes ago" },
    { title: "Checklist group updated", detail: "Assembly group sequencing changed in revision v3.2.", timestamp: "1 hour ago" },
    { title: "Relation linked", detail: "Added revision dependency REV-2417-C.", timestamp: "Today" },
    { title: "Review cadence confirmed", detail: "Member approved weekly operation audit requirement.", timestamp: "Yesterday" },
    { title: "Execution exported", detail: "Published QA-ready summary packet for release.", timestamp: "2 days ago" },
    { title: "Workflow duplicated", detail: "Seeded from prior interior panel validation template.", timestamp: "Last week" },
];

export const SWS_EXECUTION_CONFIG = [
    { label: "Mode", value: "Guided" },
    { label: "Format", value: "Checklist" },
    { label: "Revision", value: "v3.2" },
    { label: "Member", value: "D380 Ops" },
];

export const SWS_REVIEW_INFO = [
    { label: "Approved by", value: "M. Carter" },
    { label: "Approved at", value: "Apr 25, 2026" },
    { label: "Review cadence", value: "Weekly" },
    { label: "Member", value: "Assembly QA" },
];

export const SWS_PREREQUISITES = [
    "Current workbook revision must be published.",
    "Accessory hardware staging must be complete.",
    "Relation dependencies must be linked before execution.",
];

export const SWS_TAGS = ["interior", "validation", "assembly", "qa", "checklist"];

export const SWS_LINKED_ITEMS = [
    { label: "Parts", value: "8" },
    { label: "Projects", value: "3" },
    { label: "Training", value: "2" },
];