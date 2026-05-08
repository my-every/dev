import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";

export interface TabConfigItem {
  id: string;
  label: string;
  iconKey: string;
  order: number;
  enabled: boolean;
  editable: boolean;
  sectionAnchor: string;
  title: string;
  description: string;
  guidanceTitle: string;
  guidanceDescription: string;
  guidanceItems: Array<{ title: string; description: string }>;
  requiredRole: "viewer" | "engineer" | "admin";
}

const DEFAULT_TAB_CONFIG: TabConfigItem[] = [
  {
    id: "details",
    label: "Details",
    iconKey: "FileText",
    order: 0,
    enabled: true,
    editable: true,
    sectionAnchor: "details",
    title: "Project Details",
    description: "Core scheduling, project identity, revision, and workflow metadata.",
    guidanceTitle: "Details Guidance",
    guidanceDescription:
      "Use this tab to confirm the project identity, due dates, revision, LWC type, and current workflow status.",
    guidanceItems: [
      { title: "Project Name", description: "The display name used across project cards, lists, and dashboards." },
      { title: "PD Number", description: "The stable project identifier. Locked once the project is created." },
      { title: "Revision", description: "The active project revision. Legal uploads may update this value." },
      { title: "Dates", description: "Due, ConLay, ConAssy, and Ship dates help prioritize the project schedule." },
    ],
    requiredRole: "viewer",
  },
  {
    id: "assignments",
    label: "Assignments",
    iconKey: "GitBranch",
    order: 1,
    enabled: true,
    editable: true,
    sectionAnchor: "assignments",
    title: "Assignments",
    description: "Operational sheet assignments from the current project manifest.",
    guidanceTitle: "Assignments Guidance",
    guidanceDescription:
      "Use this tab to review each operational assignment, its stage, status, unit type, SWS mapping, and generated files.",
    guidanceItems: [
      { title: "Stage", description: "The workflow stage the assignment belongs to." },
      { title: "Status", description: "Shows whether the assignment is pending, active, or completed." },
      { title: "SWS", description: "Links the assignment to a standard work sheet type." },
      { title: "Inline Details", description: "Selecting a row opens assignment-specific details in the right panel." },
    ],
    requiredRole: "viewer",
  },
  {
    id: "legals",
    label: "Legals",
    iconKey: "Upload",
    order: 2,
    enabled: true,
    editable: false,
    sectionAnchor: "legals",
    title: "Legals",
    description: "Upload workbook and layout files, then review revision artifact health.",
    guidanceTitle: "Legals Guidance",
    guidanceDescription:
      "Use this tab to upload legal drawing files and verify whether required revision files exist.",
    guidanceItems: [
      { title: "Workbook", description: "The Excel legal drawing workbook used to generate schemas." },
      { title: "Layout PDF", description: "The layout drawing used for visual review and workspace support." },
      { title: "Green Changes", description: "Indicates whether revision-change workbook data is present." },
      { title: "Latest Revision", description: "The newest discovered revision for this project." },
    ],
    requiredRole: "engineer",
  },
  {
    id: "brand-lists",
    label: "Brand Lists",
    iconKey: "FileSpreadsheet",
    order: 3,
    enabled: true,
    editable: false,
    sectionAnchor: "brand-lists",
    title: "Brand Lists",
    description: "Generate, combine, review, and control brand list outputs.",
    guidanceTitle: "Brand List Guidance",
    guidanceDescription:
      "Use this tab to generate brand list exports and control which external locations appear in the output.",
    guidanceItems: [
      { title: "Generate", description: "Creates separate brand list output per assignment." },
      { title: "Generate & Combine", description: "Creates individual outputs and a combined workbook." },
      { title: "Visibility", description: "Controls whether each external location appears in brand list exports." },
    ],
    requiredRole: "engineer",
  },
  {
    id: "wire-lists",
    label: "Wire Lists",
    iconKey: "Layers",
    order: 4,
    enabled: true,
    editable: false,
    sectionAnchor: "wire-lists",
    title: "Wire Lists",
    description: "Generate, review, print, and control wire list PDFs.",
    guidanceTitle: "Wire List Guidance",
    guidanceDescription:
      "Use this tab to generate wire list PDFs and control external location visibility per assignment.",
    guidanceItems: [
      { title: "Generate", description: "Rebuilds wire list PDFs from the current project assignment data." },
      { title: "Visibility", description: "Controls which external locations appear in the wire list output." },
      { title: "Print Preview", description: "Opens the printable wire list view for a selected assignment." },
    ],
    requiredRole: "engineer",
  },
  {
    id: "cross-wire",
    label: "Cross Wire",
    iconKey: "ExternalLink",
    order: 5,
    enabled: true,
    editable: false,
    sectionAnchor: "cross-wire",
    title: "Cross Wire List",
    description: "Preview and print external wiring connections grouped by unit type.",
    guidanceTitle: "Cross Wire Guidance",
    guidanceDescription:
      "Use this tab to open the cross-wire print preview or regenerate the cross-wire schema.",
    guidanceItems: [
      { title: "Cross Wire Preview", description: "Opens the printable external wiring connection report." },
      { title: "Regenerate Schema", description: "Rebuilds the cross-wire schema from assignment brand list schemas." },
    ],
    requiredRole: "engineer",
  },
];

async function resolveTabConfigPath(projectId: string): Promise<string> {
  const shareRoot = await resolveShareDirectory();
  return path.join(shareRoot, "Projects", projectId, "tab-config.json");
}

export async function readTabConfig(projectId: string): Promise<TabConfigItem[]> {
  try {
    const configPath = await resolveTabConfigPath(projectId);
    const raw = await fs.readFile(configPath, "utf-8");
    const stored = JSON.parse(raw) as Partial<TabConfigItem>[];

    // Merge stored overrides onto defaults — stored wins for user-editable keys
    return DEFAULT_TAB_CONFIG.map((def) => {
      const override = stored.find((s) => s.id === def.id);
      if (!override) return def;
      return {
        ...def,
        label: override.label ?? def.label,
        order: override.order ?? def.order,
        enabled: override.enabled ?? def.enabled,
        title: override.title ?? def.title,
        description: override.description ?? def.description,
        guidanceTitle: override.guidanceTitle ?? def.guidanceTitle,
        guidanceDescription: override.guidanceDescription ?? def.guidanceDescription,
        guidanceItems: override.guidanceItems ?? def.guidanceItems,
      };
    }).sort((a, b) => a.order - b.order);
  } catch {
    return [...DEFAULT_TAB_CONFIG].sort((a, b) => a.order - b.order);
  }
}

export async function writeTabConfig(
  projectId: string,
  tabs: TabConfigItem[],
): Promise<void> {
  const configPath = await resolveTabConfigPath(projectId);
  // Persist only the user-override-safe keys
  const storable = tabs.map(({ id, label, order, enabled, title, description, guidanceTitle, guidanceDescription, guidanceItems }) => ({
    id, label, order, enabled, title, description, guidanceTitle, guidanceDescription, guidanceItems,
  }));
  await fs.writeFile(configPath, JSON.stringify(storable, null, 2), "utf-8");
}
