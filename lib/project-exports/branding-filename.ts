/**
 * Branded filename builder for branding CSV/Excel exports.
 *
 * Format: "{PD_#} {PROJECT_NAME} BRANDLIST {REVISION} #{UNIT}.csv"
 * All segments are uppercased and sanitized for filesystem safety.
 */

function sanitizeSegment(value: string): string {
    return value
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "")
        .replace(/\s+/g, " ");
}

export function buildBrandingFilename(info: {
    pdNumber?: string;
    projectName?: string;
    revision?: string;
    unitNumber?: string;
    sheetName?: string;
    extension?: string;
}): string {
    const ext = info.extension ?? "csv";
    const parts: string[] = [];

    if (info.pdNumber?.trim()) {
        parts.push(sanitizeSegment(info.pdNumber));
    }
    if (info.projectName?.trim()) {
        parts.push(sanitizeSegment(info.projectName));
    }
    parts.push("BRANDLIST");
    if (info.revision?.trim()) {
        parts.push(sanitizeSegment(info.revision));
    }
    if (info.unitNumber?.trim()) {
        parts.push(`#${sanitizeSegment(info.unitNumber)}`);
    }
    if (info.sheetName?.trim()) {
        parts.push(sanitizeSegment(info.sheetName));
    }

    const filename = parts.join(" ").toUpperCase();
    return `${filename}.${ext}`;
}
