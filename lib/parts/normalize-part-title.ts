import type { PartRecord } from "@/types/parts-library";

const LOWERCASE_WORDS = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
]);

function normalizeToken(token: string, isFirst: boolean): string {
    if (!token) return token;

    if (/\d/.test(token)) {
        return token.toUpperCase();
    }

    const lowered = token.toLowerCase();
    if (!isFirst && LOWERCASE_WORDS.has(lowered)) {
        return lowered;
    }

    return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

export function normalizePartDisplayTitle(input: string): string {
    const cleaned = input
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .trim();

    if (!cleaned) return "";

    return cleaned
        .split(" ")
        .map((word, index) => normalizeToken(word, index === 0))
        .join(" ")
        .replace(/\s+,/g, ",")
        .trim();
}

export function getPartDisplayTitle(part: Pick<PartRecord, "displayTitle" | "description" | "partNumber">): string {
    return part.displayTitle?.trim() || normalizePartDisplayTitle(part.description || part.partNumber);
}
