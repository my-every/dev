import type { LegalRevisionRecord } from "@/types/legal-drawings";

export type ProjectStatus = "active" | "pending" | "complete";

export type ScheduleProjectItem = {
  id: string;
  pdNumber: string;
  name: string;
  unitNumber?: string | null;
  revision?: string | null;
  dueDate?: string | null;
  planConlayDate?: string | null;
  planConassyDate?: string | null;
  shipDate?: string | null;
  lwcType?: string | null;
  color?: string | null;
  daysLate?: number | null;
  priorityLabel?: string | null;
  status: ProjectStatus;
  href?: string | null;
  hasWorkbook: boolean;
  hasLayout: boolean;
  hasProjectInstance: boolean;
  projectId?: string | null;
  revisions: LegalRevisionRecord[];
  createdAt?: string | null;
};
