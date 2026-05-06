export function normalizeWireListWireNo(wireNo: string | null | undefined): string {
  const normalized = String(wireNo ?? "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("-")) {
    return normalized;
  }

  return /^\d/.test(normalized) ? `-${normalized}` : normalized;
}
