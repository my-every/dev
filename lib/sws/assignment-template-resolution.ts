import type { ManifestAssignment } from "@/types/project-manifest";
import type { AssignmentStageId } from "@/types/d380-assignment-stages";
import { detectSwsType, type SwsDetectionContext } from "@/lib/sws/sws-auto-detect";

function resolveTemplateFromSwsType(swsType: string, stage?: string): string | null {
    const normalized = `${swsType}`.trim().toUpperCase();

    if (!normalized || normalized === "UNDECIDED" || normalized === "UNKNOWN" || normalized === "-") {
        return null;
    }

    if (stage === "CROSS_WIRE") {
        if (normalized.includes("CONSOLE")) return "CONSOLE_CROSS_WIRE";
        if (normalized.includes("BOX")) return "BOX_CROSS_WIRE";
    }

    if (normalized.includes("BASIC") || normalized.includes("BLANK")) {
        return "BASIC_BLANK_PANEL";
    }

    if (normalized.includes("CONSOLE")) {
        return "CONSOLE_BUILD_UP_PANEL_HANG";
    }

    if (normalized.includes("BOX")) {
        return stage === "CROSS_WIRE" ? "BOX_CROSS_WIRE" : "BOX_BUILD_UP";
    }

    // RAIL and PANEL families currently map to the panel worksheet template.
    if (normalized.includes("RAIL") || normalized.includes("PANEL")) {
        return "PANEL_BUILD_WIRE";
    }

    if (normalized.includes("BLANK")) {
        return "BASIC_BLANK_PANEL";
    }

    return null;
}

function resolveTemplateFromAssignmentShape(assignment: ManifestAssignment, stage?: string): string | null {
    if (stage === "BOX_BUILD") {
        return "BOX_BUILD_UP";
    }

    if (stage === "CROSS_WIRE") {
        const swsType = `${assignment.swsType}`.toUpperCase();
        return swsType.includes("CONSOLE") ? "CONSOLE_CROSS_WIRE" : "BOX_CROSS_WIRE";
    }

    if (stage === "PANEL_HANG") {
        return "CONSOLE_BUILD_UP_PANEL_HANG";
    }

    const hasPanelNumber = Boolean(assignment.panelNumber ?? assignment.layout?.primaryPage?.panelNumber);
    const hasBoxNumber = Boolean(assignment.boxNumber ?? assignment.layout?.primaryPage?.boxNumber);

    if (hasPanelNumber) {
        return "PANEL_BUILD_WIRE";
    }

    if (hasBoxNumber) {
        return "BOX_BUILD_UP";
    }

    return null;
}

export function buildSwsDetectionContextForAssignment(assignment: ManifestAssignment): SwsDetectionContext {
    const stage = mapAssignmentStageToDetectionStage(assignment.stage);
    const swsType = `${assignment.swsType}`.toUpperCase();
    return {
        drawingTitle: assignment.sheetName,
        panelName: swsType.includes("PANEL") || swsType.includes("RAIL") ? assignment.sheetName : undefined,
        boxName: swsType.includes("BOX") ? assignment.sheetName : undefined,
        consoleName: swsType.includes("CONSOLE") ? assignment.sheetName : undefined,
        enclosureType: swsType.includes("BOX")
            ? "BOX"
            : swsType.includes("CONSOLE")
              ? "CONSOLE"
              : swsType.includes("SKID")
                ? "SKID"
                : undefined,
        stage: stage as SwsDetectionContext["stage"],
        keywords: [assignment.sheetSlug, assignment.unitType ?? "", `${assignment.swsType}`],
    };
}

export function resolveSwsTemplateIdForAssignment(assignment: ManifestAssignment, configuredTemplateId?: string | null): string {
    if (configuredTemplateId) {
        return configuredTemplateId;
    }

    const swsType = `${assignment.swsType}`.toUpperCase();
    const stage = mapAssignmentStageToDetectionStage(assignment.stage);

    const mappedFromSwsType = resolveTemplateFromSwsType(swsType, stage);
    if (mappedFromSwsType) {
        return mappedFromSwsType;
    }

    const mappedFromShape = resolveTemplateFromAssignmentShape(assignment, stage);
    if (mappedFromShape) {
        return mappedFromShape;
    }

    if (stage === "BOX_BUILD") {
        return "BOX_BUILD_UP";
    }

    if (stage === "CROSS_WIRE") {
        return swsType.includes("CONSOLE") ? "CONSOLE_CROSS_WIRE" : "BOX_CROSS_WIRE";
    }

    if (stage === "PANEL_HANG") {
        return "CONSOLE_BUILD_UP_PANEL_HANG";
    }

    if (swsType.includes("BLANK")) {
        return "BASIC_BLANK_PANEL";
    }

    const detection = detectSwsType(buildSwsDetectionContextForAssignment(assignment));
    return detection.detectedType;
}

export function mapAssignmentStageToDetectionStage(stage: AssignmentStageId | string | null | undefined): string | undefined {
    switch (stage) {
        case "BUILD_UP":
            return "BUILD_UP";
        case "WIRING":
        case "WIRING_IPV":
            return "WIRING";
        case "BOX_BUILD":
            return "BOX_BUILD";
        case "CROSS_WIRE":
        case "CROSS_WIRE_IPV":
        case "READY_TO_CROSS_WIRE":
            return "CROSS_WIRE";
        case "READY_TO_HANG":
            return "PANEL_HANG";
        default:
            return undefined;
    }
}
