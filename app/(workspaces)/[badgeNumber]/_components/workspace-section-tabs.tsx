"use client";

import { Tabs, TabItem, TabPanel, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { useDetailSections } from "./use-detail-sections";
import type { DetailSectionConfig, ViewMode } from "./workspace-view-mode";

type WorkspaceSectionTabsProps = {
    sections: DetailSectionConfig[];
    mode?: ViewMode;
    className?: string;
};

export function WorkspaceSectionTabs({
    sections,
    mode = "default",
    className,
}: WorkspaceSectionTabsProps) {
    const { sections: normalizedSections, defaultActiveSectionId } = useDetailSections(sections);

    if (!defaultActiveSectionId || normalizedSections.length === 0) {
        return null;
    }

    return (
        <Tabs defaultValue={defaultActiveSectionId} className={cn("flex flex-col gap-4", className)}>
            <div className="pb-1">
                <TabsList className="min-w-max" >
                    {normalizedSections.map((section) => (
                        <TabItem key={section.id} value={section.id} label={section.label} className="min-w-0 items-center text-center px-4" />
                    ))}
                </TabsList>
            </div>

            {normalizedSections.map((section) => (
                <TabPanel key={section.id} value={section.id}>
                    {section.renderPanel(mode)}
                </TabPanel>
            ))}
        </Tabs>
    );
}