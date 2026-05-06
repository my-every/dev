import { Camera, ClipboardList, FileUp, LayoutTemplate, Route, Settings2, Upload } from "lucide-react";

import type { ProjectQuickActionItem } from "@/components/projects/project-quick-actions";
import type { ProjectTabId } from "@/components/projects/tabs/project-tab-types";

export type ProjectLegalsQuickActionId = "layout-workspace" | "new-revision";

export const PROJECT_ACTIVITY_QUICK_ACTIONS: Array<ProjectQuickActionItem<ProjectTabId>> = [
  { id: "legals", label: "Legals", icon: FileUp },
  { id: "sws", label: "SWS", icon: Route },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "biq", label: "BIQ Photos", icon: Camera },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export const PROJECT_LEGALS_QUICK_ACTIONS: Array<ProjectQuickActionItem<ProjectLegalsQuickActionId>> = [
  { id: "layout-workspace", label: "Layout Workspace", icon: LayoutTemplate },
  { id: "new-revision", label: "New Revision", icon: Upload },
];