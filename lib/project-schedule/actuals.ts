export function cleanProjectScheduleToken(value: string | undefined): string {
  return (value ?? "").trim();
}

export function buildProjectScheduleActualsKey(input: {
  key?: string;
  projectId?: string;
  pdNumber?: string;
  unit?: string;
  projectName?: string;
}): string {
  const explicit = cleanProjectScheduleToken(input.key);
  if (explicit) {
    return explicit;
  }

  const projectId = cleanProjectScheduleToken(input.projectId);
  if (projectId) {
    return `project:${projectId}`;
  }

  const pdNumber = cleanProjectScheduleToken(input.pdNumber).toUpperCase();
  const unit = cleanProjectScheduleToken(input.unit).toUpperCase() || "NO-UNIT";
  const projectName = cleanProjectScheduleToken(input.projectName)
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (!pdNumber) {
    return "";
  }

  return [pdNumber, unit, projectName || "NO-NAME"]
    .join("::")
    .replace(/[^A-Z0-9:._ -]/g, "")
    .trim();
}

export function parseProjectScheduleDate(value: string | undefined): Date | null {
  const text = cleanProjectScheduleToken(value);
  if (!text) {
    return null;
  }

  const isoLike = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const date = new Date(Date.UTC(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const usLike = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (usLike) {
    const year = usLike[3].length === 2 ? 2000 + Number(usLike[3]) : Number(usLike[3]);
    const date = new Date(Date.UTC(year, Number(usLike[1]) - 1, Number(usLike[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function diffProjectScheduleDays(from: string | undefined, to: string | undefined): number | null {
  const fromDate = parseProjectScheduleDate(from);
  const toDate = parseProjectScheduleDate(to);
  if (!fromDate || !toDate) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay);
}
