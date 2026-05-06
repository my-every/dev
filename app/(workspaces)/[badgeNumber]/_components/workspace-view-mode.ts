import type { ReactNode } from "react";

export type ViewMode = "skeleton" | "default" | "dynamic";

export type BaseStatefulProps<T = unknown> = {
    mode?: ViewMode;
    data?: T;
    className?: string;
};

export type DetailSectionConfig = {
    id: string;
    label: string;
    navLabel?: string;
    renderNav: (mode: ViewMode) => ReactNode;
    renderPanel: (mode: ViewMode) => ReactNode;
};