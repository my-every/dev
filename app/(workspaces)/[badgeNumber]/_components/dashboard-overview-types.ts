export type PriorityBucket = "urgent" | "high" | "normal" | "scheduled";

export type ProjectLoadBarPoint = {
  projectId: string;
  projectName: string;
  pdNumber: string;
  lwc: string;
  lwcColor: string;
  assignmentCount: number;
  dueDate?: string | null;
  daysLate?: number | null;
  priorityBucket: PriorityBucket;
  priorityScore: number;
  color?: string | null;
  revision?: string | null;
};
