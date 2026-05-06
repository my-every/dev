import type { UserRole } from "@/types/d380-user-session";

export function normalizeUserLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getUserResponsibilityLabel(value?: string | null) {
  return normalizeUserLabel(value || "Unassigned");
}

export function getUserDefaultTitleForRole(role?: string | null) {
  switch ((role || "").trim().toUpperCase() as UserRole | "") {
    case "DEVELOPER":
      return "Developer";
    case "MANAGER":
      return "Manager";
    case "SUPERVISOR":
      return "Supervisor";
    default:
      return "Electronic Electrical Assembler";
  }
}

export function getUserTitleLabel(user: { title?: string | null; role?: string | null }) {
  if (user.title?.trim()) {
    return user.title.trim();
  }

  return getUserDefaultTitleForRole(user.role);
}
