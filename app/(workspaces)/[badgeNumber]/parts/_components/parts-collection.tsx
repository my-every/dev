"use client";

import {
    WorkspaceCollectionView,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionItem,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import type { WorkspacePartRecord } from "./parts-types";
import { normalizePartLabel } from "./parts-types";

type PartsCollectionProps = {
    parts: WorkspacePartRecord[];
    mode?: ViewMode;
    selectedPartNumber?: string | null;
    onSelectPart?: (part: WorkspacePartRecord) => void;
};

export function PartsCollection({
    parts,
    mode = "default",
    selectedPartNumber,
    onSelectPart,
}: PartsCollectionProps) {
    const filters = buildFilters(parts);

    const items: WorkspaceCollectionItem[] = parts.map((entry, idx) => ({
        // Use a composite id so the key stays unique even if the API returns
        // duplicate partNumbers before the dedup layer has a chance to filter.
        id: `${entry.part.partNumber}__${idx}`,
        title: entry.title,
        subtitle: `${entry.part.partNumber} · ${normalizePartLabel(entry.part.type)}`,
        description: entry.part.description,
  
        thumbnail: entry.primaryImageUrl ? (
            <img
                src={entry.primaryImageUrl}
                alt={entry.title}
                className="h-10 w-10 rounded-xl border border-border object-cover"
            />
        ) : undefined,
        metadata: [
            { label: "Category", value: normalizePartLabel(entry.part.category) },
            { label: "Type", value: normalizePartLabel(entry.part.type) },
        ],
        searchText: [
            entry.part.partNumber,
            entry.title,
            entry.part.description,
            entry.part.category,
            entry.part.type,
            entry.part.tags?.join(" "),
        ]
            .filter(Boolean)
            .join(" "),
        filterValues: {
            category: entry.part.category,
            type: entry.part.type,
        },
    }));

    return (
        <WorkspaceCollectionView
            items={items}
            mode={mode}
            filters={filters}
            searchPlaceholder="Search by part number, title, manufacturer, or type…"
            // selectedItemId must match the composite id format used above
            selectedItemId={
                selectedPartNumber != null
                    ? items.find((i) => i.id.startsWith(`${selectedPartNumber}__`))?.id ?? null
                    : null
            }
            onSelect={(item) => {
                // Strip the composite suffix to recover the original part number
                const partNumber = item.id.replace(/__\d+$/, "");
                const match = parts.find((part) => part.part.partNumber === partNumber);
                if (match) onSelectPart?.(match);
            }}
        />
    );
}

/** Only expose the two most actionable filters — Category and Type. */
function buildFilters(parts: WorkspacePartRecord[]): WorkspaceCollectionFilterDefinition[] {
    const categories = new Set<string>();
    const types = new Set<string>();

    for (const entry of parts) {
        categories.add(entry.part.category);
        types.add(entry.part.type);
    }

    return [
        {
            id: "category",
            label: "Category",
            options: Array.from(categories)
                .sort()
                .map((value) => ({ value, label: normalizePartLabel(value) })),
        },
        {
            id: "type",
            label: "Type",
            options: Array.from(types)
                .sort()
                .map((value) => ({ value, label: normalizePartLabel(value) })),
        },
    ];
}
