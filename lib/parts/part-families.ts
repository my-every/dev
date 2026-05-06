import type { PartFamily, PartRecord } from "@/types/parts-library";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";

function normalizeKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseFamilyStem(title: string): { stem: string; variantLabel: string | null } {
    const trimmed = title.trim();
    if (!trimmed) return { stem: "", variantLabel: null };

    const [firstToken, ...restTokens] = trimmed.split(/\s+/);
    const rest = restTokens.join(" ").trim();

    const looksLikeVariantPrefix =
        /^(?:[a-z]*\d+[a-z]*)(?:[-/][a-z0-9]+)+$/i.test(firstToken) ||
        /^[a-z]+\d+[a-z-]*$/i.test(firstToken) ||
        /^\d+[a-z-]+$/i.test(firstToken);

    if (looksLikeVariantPrefix && rest) {
        return { stem: rest, variantLabel: firstToken };
    }

    return { stem: trimmed, variantLabel: null };
}

function getFamilySortTitle(part: PartRecord): string {
    return getPartDisplayTitle(part);
}

export function buildPartFamilies(parts: PartRecord[]): PartFamily[] {
    const grouped = new Map<string, PartRecord[]>();

    for (const part of parts) {
        const title = getPartDisplayTitle(part);
        const { stem } = parseFamilyStem(title);
        const familyName = stem || title || part.partNumber;
        const familyKey = normalizeKey(familyName);
        const id = `${part.category}:${part.type}:${familyKey}`;
        const current = grouped.get(id) ?? [];
        current.push(part);
        grouped.set(id, current);
    }

    return Array.from(grouped.entries())
        .map(([id, familyParts]) => {
            const sortedParts = [...familyParts].sort((a, b) => {
                const titleDelta = getFamilySortTitle(a).localeCompare(getFamilySortTitle(b));
                if (titleDelta !== 0) return titleDelta;
                return a.partNumber.localeCompare(b.partNumber);
            });

            const representative = sortedParts[0];
            const representativeTitle = getPartDisplayTitle(representative);
            const { stem } = parseFamilyStem(representativeTitle);
            const familyName = stem || representativeTitle || representative.partNumber;

            return {
                id,
                category: representative.category,
                type: representative.type,
                familyName,
                familyKey: normalizeKey(familyName),
                representative,
                parts: sortedParts,
                variants: sortedParts.map((part) => {
                    const title = getPartDisplayTitle(part);
                    const { variantLabel } = parseFamilyStem(title);
                    return {
                        partNumber: part.partNumber,
                        label: variantLabel || part.partNumber,
                        title,
                    };
                }),
            } satisfies PartFamily;
        })
        .sort((a, b) => a.familyName.localeCompare(b.familyName));
}

export function findPartFamily(parts: PartRecord[], partNumber: string): PartFamily | null {
    return buildPartFamilies(parts).find((family) => family.parts.some((part) => part.partNumber === partNumber)) ?? null;
}
