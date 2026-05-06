export type PartOverviewData = {
    partNumber: string;
    description: string;
    note: string;
    badges: string[];
    summary: Array<{ label: string; value: string }>;
};

export type PartSpecificationSection = {
    title: string;
    rows: Array<{ label: string; value: string }>;
};

export type PartImageRecord = {
    label: string;
};

export type PartInstructionRecord = {
    type: string;
    stage: string;
    text: string;
};

export type PartUsageRecord = {
    title: string;
    location: string;
    quantity: string;
};

export const PART_PANEL_SUMMARY = {
    eyebrow: "Catalog",
    title: "Part Details",
    subtitle: "Reference data, specifications, and usage context",
    status: "Active",
    headline: "1492-TB3 terminal block",
    subline: "Part 1492-TB3",
    chips: ["Terminal Blocks", "DIN Rail", "24V"],
};

export const PART_SUBHEADER = {
    title: "1492-TB3",
    description: "Feed-through terminal block used in control panel field wiring assemblies.",
    metadata: [
        { label: "Category", value: "Terminal Blocks" },
        { label: "Mount", value: "DIN Rail" },
        { label: "Voltage", value: "24V" },
        { label: "Stock", value: "In Stock" },
    ],
};

export const PART_OVERVIEW: PartOverviewData = {
    partNumber: "1492-TB3",
    description: "Allen-Bradley feed-through block for marshalling and panel interconnect routing.",
    note: "Supports standard cabinet wiring and common field termination layouts.",
    badges: ["RoHS", "UL Listed", "Panel Standard"],
    summary: [
        { label: "Manufacturer", value: "Allen-Bradley" },
        { label: "Mount Type", value: "DIN Rail" },
        { label: "Stock", value: "124 on hand" },
    ],
};

export const PART_ELECTRICAL_PROPERTIES = [
    { label: "Rated Voltage", value: "600V" },
    { label: "Rated Current", value: "30A" },
    { label: "Wire Range", value: "22-10 AWG" },
    { label: "Strip Length", value: "9 mm" },
    { label: "Torque", value: "7 in-lb" },
];

export const PART_INSTRUCTIONS: PartInstructionRecord[] = [
    { type: "DO", stage: "Assembly", text: "Verify jumper orientation before tightening adjacent blocks." },
    { type: "WARNING", stage: "Inspection", text: "Do not mix ferrule gauges across the same block run." },
    { type: "TIP", stage: "Build Up", text: "Stage end clamps and markers before snapping onto rail." },
    { type: "INFO", stage: "Service", text: "Use updated marker legend when revision notes call out terminal remaps." },
];

export const PART_ALTERNATES = [
    { label: "1492-TB3J", value: "Jumper compatible" },
    { label: "1492-TB4", value: "Higher density" },
    { label: "1492-TB3G", value: "Ground variant" },
];

export const PART_SPECIFICATION_SECTIONS: PartSpecificationSection[] = [
    {
        title: "Mechanical",
        rows: [
            { label: "Housing", value: "Polyamide" },
            { label: "Color", value: "Gray" },
            { label: "Width", value: "6.2 mm" },
            { label: "Height", value: "42 mm" },
            { label: "Mount", value: "DIN Rail" },
            { label: "Weight", value: "14 g" },
        ],
    },
    {
        title: "Electrical",
        rows: [
            { label: "Voltage", value: "600V" },
            { label: "Current", value: "30A" },
            { label: "Wire Range", value: "22-10 AWG" },
            { label: "Torque", value: "7 in-lb" },
            { label: "Connection", value: "Screw clamp" },
            { label: "Rating Class", value: "IEC/UL" },
        ],
    },
    {
        title: "Environmental",
        rows: [
            { label: "Temp Range", value: "-25 to 85C" },
            { label: "Ingress", value: "Indoor" },
            { label: "Humidity", value: "95% non-condensing" },
            { label: "Vibration", value: "Standard cabinet" },
            { label: "Storage", value: "Dry" },
            { label: "Material Class", value: "UL94 V-0" },
        ],
    },
    {
        title: "Compliance",
        rows: [
            { label: "UL", value: "Listed" },
            { label: "CE", value: "Yes" },
            { label: "RoHS", value: "Compliant" },
            { label: "CSA", value: "Approved" },
            { label: "Panel Std", value: "D380 Core" },
            { label: "Lifecycle", value: "Active" },
        ],
    },
];

export const PART_IMAGES: PartImageRecord[] = [
    { label: "Front" },
    { label: "Installed" },
    { label: "Side" },
    { label: "Top" },
    { label: "Rail mount" },
    { label: "Marker view" },
];

export const PART_NOTES: PartInstructionRecord[] = [
    { type: "DO", stage: "Build Up", text: "Maintain continuous terminal numbering across junction strips." },
    { type: "CAUTION", stage: "Wiring", text: "Re-torque after first article review when using stranded wire." },
    { type: "INFO", stage: "Quality", text: "Inspection checklist references updated marker card revision." },
    { type: "TIP", stage: "Material", text: "Bundle end clamps and markers with each rail kit to reduce travel." },
    { type: "WARNING", stage: "Service", text: "Do not substitute alternate clips without accessory review." },
];

export const PART_USAGE: PartUsageRecord[] = [
    { title: "Main marshalling strip", location: "Project PD-2417 / Unit 03", quantity: "x18" },
    { title: "PLC field I/O interface", location: "Project PD-2417 / Unit 07", quantity: "x12" },
    { title: "Door terminal junction", location: "Project PD-1988 / Unit 01", quantity: "x8" },
    { title: "Spare terminal bank", location: "Project PD-2210 / Unit 02", quantity: "x10" },
    { title: "Safety relay marshalling", location: "Project PD-1755 / Unit 04", quantity: "x6" },
    { title: "Customer IO landing", location: "Project PD-1755 / Unit 06", quantity: "x14" },
];

export const PART_KEY_SPECS = [
    { label: "Part Family", value: "1492 Series" },
    { label: "Pitch", value: "6.2 mm" },
    { label: "Circuits", value: "Single level" },
    { label: "Terminal Style", value: "Feed-through" },
    { label: "Lifecycle", value: "Active" },
];

export const PART_TOOLS = [
    { title: "Torque driver", subtitle: "7 in-lb preset" },
    { title: "Marker applicator", subtitle: "Terminal marker card" },
];