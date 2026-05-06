import { Badge } from "@/components/ui/badge";

import {
    WorkspaceCollectionView,
    type WorkspaceCollectionFilterDefinition,
    type WorkspaceCollectionItem,
    type WorkspaceCollectionTab,
    type ViewMode,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { TRAINING_STAGE_INFO, type TrainingStage } from "@/types/training";

import type { WorkspaceTrainingCategory, WorkspaceTrainingRecord } from "./training-types";

type TrainingModuleCollectionProps = {
    modules: WorkspaceTrainingRecord[];
    categories: WorkspaceTrainingCategory[];
    mode?: ViewMode;
    selectedTrainingId?: string | null;
    onSelectTraining?: (module: WorkspaceTrainingRecord) => void;
};

export function TrainingModuleCollection({
    modules,
    categories,
    mode = "default",
    selectedTrainingId,
    onSelectTraining,
}: TrainingModuleCollectionProps) {
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const tabs = buildTabs(modules, categories);
    const filters = buildFilters(modules, categories);

    const items: WorkspaceCollectionItem[] = modules.map((module) => {
        const category = categoryMap.get(module.category || "");
        return {
            id: module.id,
            title: module.name,
            subtitle: `${category?.label ?? "Uncategorized"} • ${module.enabledStages.length} stage${module.enabledStages.length === 1 ? "" : "s"}`,
            description: module.description || undefined,
            badge: normalizeLabel(module.status),
            metadata: [
                { label: "Difficulty", value: normalizeLabel(module.difficulty) },
                { label: "Category", value: category?.label ?? "—" },
                { label: "Parts", value: `${module.partNumbers.length}` },
                { label: "Tags", value: `${module.tags.length}` },
            ],
            searchText: [
                module.name,
                module.description,
                module.category,
                module.type,
                module.tags.join(" "),
                module.partNumbers.join(" "),
                module.enabledStages.join(" "),
            ]
                .filter(Boolean)
                .join(" "),
            filterValues: {
                tab: module.category || "uncategorized",
                category: module.category || "uncategorized",
                status: module.status,
                type: module.type || "general",
                role: module.visibleRoles?.[0] || "everyone",
            },
            icon: (
                <div className="flex items-center gap-1">
                    {module.enabledStages.slice(0, 2).map((stage) => (
                        <Badge key={`${module.id}-${stage}`} variant="outline" className="px-1.5 py-0 text-[10px]">
                            {TRAINING_STAGE_INFO[stage as TrainingStage].label.slice(0, 2)}
                        </Badge>
                    ))}
                </div>
            ),
        };
    });

    return (
        <WorkspaceCollectionView
            items={items}
            mode={mode}
            tabs={tabs}
            defaultTabId={tabs[0]?.id ?? "all"}
            filters={filters}
            searchPlaceholder="Search by title, category, skill, role, tag, or requirement..."
            selectedItemId={selectedTrainingId}
            onSelect={(item) => {
                const match = modules.find((module) => module.id === item.id);
                if (match) {
                    onSelectTraining?.(match);
                }
            }}
        />
    );
}

function buildTabs(modules: WorkspaceTrainingRecord[], categories: WorkspaceTrainingCategory[]): WorkspaceCollectionTab[] {
    const counts = new Map<string, number>();
    modules.forEach((module) => {
        const category = module.category || "uncategorized";
        counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    return [
        { id: "all", label: "All", count: modules.length },
        ...Array.from(counts.entries()).map(([categoryId, count]) => ({
            id: categoryId,
            label: categories.find((category) => category.id === categoryId)?.label ?? normalizeLabel(categoryId),
            count,
        })),
    ];
}

function buildFilters(modules: WorkspaceTrainingRecord[], categories: WorkspaceTrainingCategory[]): WorkspaceCollectionFilterDefinition[] {
    const categoryMap = new Map(categories.map((category) => [category.id, category.label]));
    const statuses = new Set<string>();
    const types = new Set<string>();
    const roles = new Set<string>();

    modules.forEach((module) => {
        statuses.add(module.status);
        types.add(module.type || "general");
        (module.visibleRoles ?? ["everyone"]).forEach((role) => roles.add(role));
    });

    return [
        {
            id: "category",
            label: "Category",
            options: categories.map((category) => ({ value: category.id, label: category.label })),
        },
        {
            id: "status",
            label: "Status",
            options: Array.from(statuses).sort().map((status) => ({ value: status, label: normalizeLabel(status) })),
        },
        {
            id: "type",
            label: "Type",
            options: Array.from(types).sort().map((type) => ({ value: type, label: normalizeLabel(type) })),
        },
        {
            id: "role",
            label: "Role",
            options: Array.from(roles).sort().map((role) => ({ value: role, label: normalizeLabel(role) })),
        },
    ].map((filter) =>
        filter.id === "category"
            ? {
                  ...filter,
                  options: filter.options.map((option) => ({
                      value: option.value,
                      label: categoryMap.get(option.value) ?? option.label,
                  })),
              }
            : filter
    );
}

function normalizeLabel(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
