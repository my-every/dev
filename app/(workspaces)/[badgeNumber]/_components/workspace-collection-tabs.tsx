"use client";

import { Tabs, TabsList, TabItem } from "@/components/ui/tabs";

export type WorkspaceCollectionTab = {
    id: string;
    label: string;
    count?: number;
};

type WorkspaceCollectionTabsProps = {
    tabs: WorkspaceCollectionTab[];
    activeTabId: string;
    onTabChange: (tabId: string) => void;
    className?: string;
};

export function WorkspaceCollectionTabs({
    tabs,
    activeTabId,
    onTabChange,
    className,
}: WorkspaceCollectionTabsProps) {
    if (tabs.length === 0) {
        return null;
    }

    return (
        <Tabs
            value={activeTabId}
            onValueChange={onTabChange}
        >
            <TabsList className={className}>
                {tabs.map((tab) => (
                    <TabItem
                        key={tab.id}
                        value={tab.id}
                        label={tab.label}
                    />
                ))}
            </TabsList>
        </Tabs>
    );
}
