import type { WorkspaceUserRecord } from "./users-types";
export {
  getUserResponsibilityLabel,
  getUserTitleLabel,
  normalizeUserLabel,
} from "@/lib/users/display";

export type UsersDisplayRecord = Pick<WorkspaceUserRecord, "title" | "role">;
