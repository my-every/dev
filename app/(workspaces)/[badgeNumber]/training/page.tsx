"use client";

import { use, useEffect, useMemo, useState } from "react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";

import {
    TrainingCoverageSummary,
    TrainingMetricGrid,
    TrainingModuleCollection,
    TrainingPreviewAside,
    TrainingSidePanelNav,
    TrainingSubheader,
    type WorkspaceTrainingCategory,
    type WorkspaceTrainingRecord,
} from "./_components";
import {
    TrainingModuleConfigurator,
    CreateTrainingCTACard,
    CategoryCardsGrid,
} from "@/components/training";
import type { TrainingModuleV2, TrainingCategory } from "@/types/training";

type TrainingWorkspacePageProps = {
    params: Promise<{
        badgeNumber: string;
    }>;
};

type LoadState = "loading" | "ready";

type InstallLinksResponse = {
    total?: number;
};

export default function TrainingWorkspacePage({ params: paramsPromise }: TrainingWorkspacePageProps) {
    const params = use(paramsPromise);
    const [modules, setModules] = useState<WorkspaceTrainingRecord[]>([]);
    const [categories, setCategories] = useState<WorkspaceTrainingCategory[]>([]);
    const [selectedModule, setSelectedModule] = useState<WorkspaceTrainingRecord | null>(null);
    const [state, setState] = useState<LoadState>("loading");
    const [linkedPartCoverage, setLinkedPartCoverage] = useState<Record<string, number>>({});
    
    // Configurator modal state
    const [configuratorOpen, setConfiguratorOpen] = useState(false);
    const [configuratorDraft, setConfiguratorDraft] = useState<Partial<TrainingModuleV2> | null>(null);

    useEffect(() => {
        let mounted = true;

        async function loadTraining() {
            setState("loading");

            const [trainingResponse, categoryResponse] = await Promise.all([
                fetch("/api/training", { cache: "no-store" }),
                fetch("/api/training/categories", { cache: "no-store" }),
            ]);

            const [trainingPayload, categoryPayload] = await Promise.all([
                trainingResponse.ok ? trainingResponse.json() : Promise.resolve({ trainings: [] }),
                categoryResponse.ok ? categoryResponse.json() : Promise.resolve({ categories: [] }),
            ]);

            if (!mounted) {
                return;
            }

            const nextModules = ((trainingPayload as { trainings?: WorkspaceTrainingRecord[] }).trainings ?? []).sort((left, right) =>
                left.name.localeCompare(right.name)
            );
            const nextCategories = (categoryPayload as { categories?: WorkspaceTrainingCategory[] }).categories ?? [];
            setModules(nextModules);
            setCategories(nextCategories);
            setSelectedModule((current) => nextModules.find((module) => module.id === current?.id) ?? nextModules[0] ?? null);
            setState("ready");

            const uniqueParts = Array.from(new Set(nextModules.flatMap((module) => module.partNumbers))).filter(Boolean);
            const coverageEntries = await Promise.all(
                uniqueParts.map(async (partNumber) => {
                    const response = await fetch(`/api/training/install-links?partNumber=${encodeURIComponent(partNumber)}&badgeNumber=${encodeURIComponent(params.badgeNumber)}`, {
                        cache: "no-store",
                    });
                    if (!response.ok) {
                        return [partNumber, 0] as const;
                    }
                    const payload = (await response.json()) as InstallLinksResponse;
                    return [partNumber, payload.total ?? 0] as const;
                })
            );
            if (mounted) {
                setLinkedPartCoverage(Object.fromEntries(coverageEntries));
            }
        }

        void loadTraining();

        return () => {
            mounted = false;
        };
    }, [params.badgeNumber]);

    const mode = state === "loading" ? "skeleton" : "dynamic";
    const commandSearchGroups = useMemo<CommandSearchGroup[]>(
        () => [
            {
                heading: "Workspace",
                items: [
                    {
                        id: "workspace-home",
                        label: "Workspace Home",
                        href: `/${params.badgeNumber}`,
                        keywords: ["workspace", "home"],
                    },
                    {
                        id: "training-root",
                        label: "Training",
                        href: `/${params.badgeNumber}/training`,
                        keywords: ["training", "modules", "install"],
                    },
                ],
            },
            {
                heading: "Training",
                items: modules.slice(0, 20).map((module) => ({
                    id: `training-${module.id}`,
                    label: module.name,
                    description: `${module.id} • ${module.category ?? "uncategorized"}`,
                    href: `/${params.badgeNumber}/training/${module.id}`,
                    keywords: [module.id, module.name, module.category ?? "", ...module.tags],
                })),
            },
        ],
        [modules, params.badgeNumber]
    );

    const metrics = useMemo(() => {
        const linkedParts = new Set(modules.flatMap((module) => module.partNumbers)).size;
        return {
            totalModules: modules.length,
            totalCategories: categories.length,
            publishedModules: modules.filter((module) => module.status === "published").length,
            linkedPartNumbers: linkedParts,
        };
    }, [categories.length, modules]);

    const categorySummary = useMemo(
        () =>
            categories.map((category) => {
                const count = modules.filter((module) => module.category === category.id).length;
                return {
                    label: category.label,
                    value: `${count}`,
                    description: category.description,
                };
            }),
        [categories, modules]
    );

    const installCoverage = useMemo(
        () =>
            Object.entries(linkedPartCoverage)
                .sort((left, right) => right[1] - left[1])
                .slice(0, 5)
                .map(([label, value]) => ({ label, value: `${value}` })),
        [linkedPartCoverage]
    );

    const coverageSummary = useMemo(() => {
        const totalStages = modules.reduce((count, module) => count + module.enabledStages.length, 0);
        const totalTags = modules.reduce((count, module) => count + module.tags.length, 0);
        const linkedOperations = modules.reduce((count, module) => count + (module.swsTemplateIds?.length ?? 0), 0);

        return [
            { label: "Total stages", value: `${totalStages}` },
            { label: "Total tags", value: `${totalTags}` },
            { label: "Linked operations", value: `${linkedOperations}` },
            { label: "Restricted modules", value: `${modules.filter((module) => module.visibility === "restricted").length}` },
        ];
    }, [modules]);

    // Convert workspace categories to TrainingCategory format for configurator
    const trainingCategories = useMemo<TrainingCategory[]>(
        () =>
            categories.map((cat) => ({
                id: cat.id,
                label: cat.label,
                description: cat.description,
            })),
        [categories]
    );

    // Handler for opening configurator with optional category pre-selected
    const handleOpenConfigurator = (categoryId?: string) => {
        if (categoryId) {
            setConfiguratorDraft({ category: categoryId });
        } else {
            setConfiguratorDraft(null);
        }
        setConfiguratorOpen(true);
    };

    // Handler for saving a new training module
    const handleSaveModule = async (module: TrainingModuleV2) => {
        try {
            const response = await fetch("/api/training", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(module),
            });

            if (response.ok) {
                // Refresh the modules list
                const trainingResponse = await fetch("/api/training", { cache: "no-store" });
                const trainingPayload = await trainingResponse.json();
                const nextModules = ((trainingPayload as { trainings?: WorkspaceTrainingRecord[] }).trainings ?? []).sort((left, right) =>
                    left.name.localeCompare(right.name)
                );
                setModules(nextModules);
                setConfiguratorOpen(false);
                setConfiguratorDraft(null);
            }
        } catch (error) {
            console.error("Failed to save training module:", error);
        }
    };

    // Category cards data with click handler
    const categoryCardsData = useMemo(
        () =>
            categories.map((cat) => ({
                id: cat.id,
                label: cat.label,
                description: cat.description,
                count: modules.filter((m) => m.category === cat.id).length,
            })),
        [categories, modules]
    );

    return (
        <PageContent
            title="Training"
            subtitle="Training modules"
            variant="wide"
            showPanel={true}
            showAside={true}
            showBreadcrumbs={true}
            showHeader={true}
            showHeading={false}
            showSubHeader={true}
            commandSearchGroups={commandSearchGroups}
            commandSearchPlaceholder="Search training modules, categories, tags, or part numbers"
            sidePanel={
                <TrainingSidePanelNav
                    mode={mode}
                    data={{
                        modules,
                        categories,
                        selectedTrainingId: selectedModule?.id ?? null,
                        onSelectTraining: setSelectedModule,
                    }}
                />
            }
            subHeader={
                <TrainingSubheader
                    mode={mode}
                    data={{
                        headline: "Training Workspace",
                        subline: "Live training modules backed by categories and install-link APIs.",
                        totalModules: metrics.totalModules,
                        categorySummary: `${categories.length} categories`,
                    }}
                />
            }
            asideOpen={Boolean(selectedModule)}
            onAsideOpenChange={(open) => {
                if (!open) {
                    setSelectedModule(null);
                } else if (!selectedModule && modules.length > 0) {
                    setSelectedModule(modules[0]);
                }
            }}
            asideTitle={selectedModule?.name ?? "Training Preview"}
            asideHeader={selectedModule ? <div className="text-xs text-muted-foreground">{selectedModule.id}</div> : null}
            aside={<TrainingPreviewAside badgeNumber={params.badgeNumber} module={selectedModule} categories={categories} />}
        >
            <div className="space-y-6 p-3 sm:p-4 lg:p-6 flex flex-1">
                {/* Metrics Grid */}
                <TrainingMetricGrid mode={mode} data={metrics} />

                {/* Prominent CTA Card for Creating New Modules */}
                <CreateTrainingCTACard
                    variant="prominent"
                    onClick={() => handleOpenConfigurator()}
                />

                {/* Module Collection */}
                <TrainingModuleCollection
                    modules={modules}
                    categories={categories}
                    mode={mode}
                    selectedTrainingId={selectedModule?.id ?? null}
                    onSelectTraining={setSelectedModule}
                />

                {/* Interactive Category Cards Grid */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Training Categories</h3>
                        <p className="text-sm text-muted-foreground">Select a category to create a new training module</p>
                    </div>
                    <CategoryCardsGrid
                        categories={categoryCardsData}
                        onCategoryClick={(categoryId) => handleOpenConfigurator(categoryId)}
                    />
                </div>

                {/* Coverage Summary */}
                <div className="grid gap-4 md:grid-cols-2">
                    <TrainingCoverageSummary mode={mode} data={coverageSummary} />
                </div>
            </div>

            {/* Training Module Configurator Modal */}
            <TrainingModuleConfigurator
                open={configuratorOpen}
                onOpenChange={setConfiguratorOpen}
                existingDraft={configuratorDraft}
                categories={trainingCategories}
                onSave={handleSaveModule}
            />
        </PageContent>
    );
}
