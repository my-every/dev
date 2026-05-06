export type ProjectMetric = {
    label: string;
    value: string;
    note: string;
};

export type ProjectAssignment = {
    title: string;
    unit: string;
    member: string;
    status: string;
};

export type ProjectStage = {
    title: string;
    subtitle: string;
    status: string;
    stats: Array<{ label: string; value: string }>;
};

export type ProjectTeamMember = {
    name: string;
    role: string;
    shift: string;
    availability: string;
};

export type ProjectCoverage = {
    label: string;
    value: string;
    width: string;
};

export type ProjectSetting = {
    title: string;
    description: string;
    enabled: boolean;
};

export const PROJECT_SUBHEADER = {
    title: "PD-2417 • Unit 03",
    description: "North enclosure build with staged revision rollout and validation checkpoints.",
    metadata: [
        { label: "Status", value: "Active" },
        { label: "Due Date", value: "Apr 30" },
        { label: "Units", value: "12 total" },
        { label: "Rows", value: "248 mapped" },
    ],
};

export const PROJECT_PANEL_SUMMARY = {
    eyebrow: "Project",
    title: "PD-2417 Project Details",
    subtitle: "Revision-aware wiring and assembly planning",
    status: "Active",
    name: "North enclosure build",
    unit: "Unit 03",
    chips: ["Green Change", "Validation", "Rev B.2"],
};

export const PROJECT_METRICS: ProjectMetric[] = [
    { label: "Active Units", value: "12", note: "3 releasing today" },
    { label: "Assignments", value: "48", note: "9 pending review" },
    { label: "Open Findings", value: "07", note: "2 blockers" },
    { label: "Feature Flags", value: "14", note: "11 enabled" },
];

export const PROJECT_ASSIGNMENTS: ProjectAssignment[] = [
    { title: "Harness prep for Unit 03", unit: "Unit 03", member: "B. Truong", status: "In Progress" },
    { title: "Conlay inspection", unit: "Unit 01", member: "J. Patel", status: "Queued" },
    { title: "Label verification pass", unit: "Unit 07", member: "A. Kim", status: "Needs Review" },
    { title: "Console fit-up", unit: "Unit 02", member: "M. Diaz", status: "Assigned" },
    { title: "Grounding audit", unit: "Unit 05", member: "S. White", status: "Assigned" },
    { title: "Door hardware install", unit: "Unit 08", member: "T. Nguyen", status: "Queued" },
    { title: "Final punchlist", unit: "Unit 11", member: "L. Brown", status: "Blocked" },
];

export const PROJECT_STAGES: ProjectStage[] = [
    {
        title: "Build Up",
        subtitle: "Mechanical prep and layout staging",
        status: "Healthy",
        stats: [
            { label: "WIP", value: "06" },
            { label: "Blocked", value: "01" },
            { label: "Throughput", value: "82%" },
        ],
    },
    {
        title: "Wiring",
        subtitle: "Primary and secondary wire execution",
        status: "Busy",
        stats: [
            { label: "WIP", value: "09" },
            { label: "Blocked", value: "02" },
            { label: "Throughput", value: "71%" },
        ],
    },
    {
        title: "Validation",
        subtitle: "Checklist and rework verification",
        status: "Review",
        stats: [
            { label: "WIP", value: "04" },
            { label: "Blocked", value: "00" },
            { label: "Throughput", value: "91%" },
        ],
    },
    {
        title: "Packout",
        subtitle: "Documentation and release prep",
        status: "Queued",
        stats: [
            { label: "WIP", value: "03" },
            { label: "Blocked", value: "00" },
            { label: "Throughput", value: "64%" },
        ],
    },
    {
        title: "Ship Hold",
        subtitle: "Outstanding approvals before release",
        status: "Monitor",
        stats: [
            { label: "WIP", value: "02" },
            { label: "Blocked", value: "01" },
            { label: "Throughput", value: "48%" },
        ],
    },
];

export const PROJECT_TEAM: ProjectTeamMember[] = [
    { name: "B. Truong", role: "Lead Assembler", shift: "1st Shift", availability: "Available" },
    { name: "J. Patel", role: "QA Review", shift: "1st Shift", availability: "Reviewing" },
    { name: "A. Kim", role: "Wire Tech", shift: "2nd Shift", availability: "Busy" },
    { name: "M. Diaz", role: "Panel Build", shift: "1st Shift", availability: "Available" },
    { name: "S. White", role: "Validation", shift: "1st Shift", availability: "Queued" },
    { name: "T. Nguyen", role: "Material Flow", shift: "2nd Shift", availability: "Available" },
];

export const PROJECT_COVERAGE: ProjectCoverage[] = [
    { label: "Assembly Coverage", value: "84%", width: "84%" },
    { label: "QA Coverage", value: "61%", width: "61%" },
    { label: "Material Ready", value: "73%", width: "73%" },
    { label: "Validation Throughput", value: "68%", width: "68%" },
];

export const PROJECT_SETTINGS: ProjectSetting[] = [
    { title: "Green change enabled", description: "Allow revision delta workflows and acknowledgment rules.", enabled: true },
    { title: "Auto-map assignments", description: "Suggest mappings during workbook refresh and reseed.", enabled: true },
    { title: "Require QA hold", description: "Gate release until validation blockers are resolved.", enabled: true },
    { title: "Allow manual overrides", description: "Permit supervisors to bypass non-blocking validation rules.", enabled: false },
    { title: "Track feature audit log", description: "Record changes to project feature access and approvals.", enabled: true },
    { title: "Sync latest workbook rows", description: "Pull workbook deltas into planning view on refresh.", enabled: false },
];

export const PROJECT_AUDIT_ITEMS = [
    { title: "Feature access updated", detail: "Supervisor role granted revision export access." },
    { title: "Revision set changed", detail: "Layout revision advanced from B.1 to B.2." },
    { title: "Validation rule acknowledged", detail: "Info-level mismatch accepted for Unit 03." },
    { title: "Assignment mapping refreshed", detail: "Workbook sync updated 14 assignment links." },
];

export const PROJECT_OVERVIEW_ACTIONS = [
    "Review blockers and pending approvals",
    "Open revision comparison workspace",
    "Generate unit staging checklist",
    "Export project summary packet",
];

export const PROJECT_FEATURE_ACCESS = [
    { label: "Revision export", value: "Enabled" },
    { label: "Manual stage override", value: "Supervisor" },
    { label: "Delta compare", value: "Enabled" },
    { label: "Validation bypass", value: "Restricted" },
    { label: "Audit trail", value: "Required" },
];