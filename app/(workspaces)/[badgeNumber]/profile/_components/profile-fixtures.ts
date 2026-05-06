export type ProfileStatItem = {
    label: string;
    value: string;
    note: string;
};

export type ProfileAssignmentItem = {
    title: string;
    location: string;
    status: string;
};

export type ProfileTrainingItem = {
    title: string;
    completion: string;
    width: string;
    status: string;
};

export type ProfileActivityItem = {
    title: string;
    detail: string;
    timestamp: string;
};

export type ProfilePermissionItem = {
    label: string;
    value: string;
};

export const PROFILE_PANEL_SUMMARY = {
    eyebrow: "Profile",
    title: "Profile Details",
    subtitle: "Identity, assignments, training, and access",
    status: "Active",
    headline: "Billy Truong",
    subline: "Badge 380017",
    chips: ["Assembler", "1st Shift", "D380"],
};

export const PROFILE_SUBHEADER = {
    name: "Billy Truong",
    badge: "380017",
    role: "Assembler",
    shift: "1st Shift",
    department: "D380 Ops",
    status: "Available",
};

export const PROFILE_STATS: ProfileStatItem[] = [
    { label: "Assignments", value: "12", note: "3 active today" },
    { label: "Training", value: "86%", note: "2 modules pending" },
    { label: "QA Score", value: "98", note: "Last 30 days" },
];

export const PROFILE_SKILLS = [
    { label: "Panel Build", value: "92%", width: "92%" },
    { label: "Wiring", value: "84%", width: "84%" },
    { label: "Validation", value: "68%", width: "68%" },
    { label: "Documentation", value: "76%", width: "76%" },
    { label: "Leadership", value: "58%", width: "58%" },
];

export const PROFILE_PERSONAL_INFO = [
    { label: "Email", value: "b.truong@example.local" },
    { label: "Location", value: "Plant 3" },
    { label: "Title", value: "Lead Assembler" },
    { label: "Department", value: "D380 Control Panels" },
    { label: "Joined", value: "Jan 12, 2023" },
];

export const PROFILE_CURRENT_ASSIGNMENT = {
    title: "Unit 03 harness prep",
    detail: "PD-2417 • Conlay staging and marker verification",
    width: "60%",
};

export const PROFILE_PERFORMANCE = [
    { label: "Daily throughput", value: "+12%" },
    { label: "On-time completion", value: "94%" },
    { label: "Rework rate", value: "1.2%" },
    { label: "Checklists complete", value: "88%" },
];

export const PROFILE_ASSIGNMENTS: ProfileAssignmentItem[] = [
    { title: "Harness prep", location: "PD-2417 / Unit 03", status: "In Progress" },
    { title: "Conlay review", location: "PD-2417 / Unit 01", status: "Queued" },
    { title: "Door hardware install", location: "PD-1755 / Unit 04", status: "Assigned" },
    { title: "Grounding audit", location: "PD-2210 / Unit 07", status: "Needs Review" },
    { title: "Label print batch", location: "PD-1988 / Unit 05", status: "Assigned" },
    { title: "Spare parts check", location: "PD-1755 / Unit 02", status: "Done" },
];

export const PROFILE_TRAINING: ProfileTrainingItem[] = [
    { title: "Advanced panel build", completion: "92%", width: "92%", status: "Current" },
    { title: "Validation workflow", completion: "74%", width: "74%", status: "In Progress" },
    { title: "Revision control", completion: "61%", width: "61%", status: "Scheduled" },
    { title: "Quality checklist review", completion: "88%", width: "88%", status: "Current" },
    { title: "Material traceability", completion: "53%", width: "53%", status: "Pending" },
];

export const PROFILE_ACTIVITY: ProfileActivityItem[] = [
    { title: "Completed Unit 03 checklist", detail: "Marked final validation items complete and submitted for QA.", timestamp: "8 minutes ago" },
    { title: "Updated assignment notes", detail: "Added rework comment for terminal strip labeling mismatch.", timestamp: "27 minutes ago" },
    { title: "Started training module", detail: "Opened revision-control refresher for current project rollout.", timestamp: "1 hour ago" },
    { title: "Accepted schedule change", detail: "Confirmed reassignment to PD-2417 for first shift coverage.", timestamp: "Today" },
    { title: "Reviewed material shortage", detail: "Acknowledged low stock notice for terminal block accessory kit.", timestamp: "Yesterday" },
];

export const PROFILE_PERMISSIONS: ProfilePermissionItem[] = [
    { label: "Edit assignments", value: "Allowed" },
    { label: "Approve rework", value: "Supervisor only" },
    { label: "Export workbook", value: "Allowed" },
    { label: "Override validation", value: "Restricted" },
    { label: "Update training records", value: "Allowed" },
];

export const PROFILE_PERMISSION_GROUPS = [
    { label: "Revision access", value: "Project scoped" },
    { label: "Workbook export", value: "Enabled" },
    { label: "QA acknowledgment", value: "Allowed" },
];

export const PROFILE_SKILL_CHIPS = ["Panel Build", "Wiring", "Validation", "Labeling", "QA Prep", "Training Lead"];