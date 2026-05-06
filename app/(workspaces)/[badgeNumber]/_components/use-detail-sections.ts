"use client";

import { useMemo } from "react";

import type { DetailSectionConfig } from "./workspace-view-mode";

export function useDetailSections(sections: DetailSectionConfig[]) {
    const normalizedSections = useMemo(
        () => sections
            .filter((section) => Boolean(section?.id && section?.label))
            .map((section) => ({
                ...section,
                navLabel: section.navLabel ?? section.label,
            })),
        [sections],
    );

    const defaultActiveSectionId = normalizedSections[0]?.id;

    return {
        sections: normalizedSections,
        defaultActiveSectionId,
    };
}