/**
 * Drawing Metadata Extraction
 *
 * Extracts structured metadata from layout PDF pages:
 * - Drawing title (spatial + regex strategies)
 * - Panel / box part numbers
 * - Door labels detection
 * - DIN rail groups with mounted devices
 *
 * All functions operate on either raw text or positioned text items
 * obtained from pdf.js `getTextContent()`.
 */

import type { DeviceCluster, RailGroup, RailDevice, PanductInfo } from "./types";

// ============================================================================
// Positioned Text Item
// ============================================================================

/**
 * A single text fragment from pdf.js with its page-space coordinates.
 */
export interface PositionedTextItem {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

function normalizeEntityLabel(value: string): string {
    return value.trim().replace(/\s+/g, " ").toUpperCase();
}

// ============================================================================
// Drawing Title Patterns
// ============================================================================

/**
 * Valid Drawing Title patterns for Solar Turbines layouts.
 * These patterns identify panel/sheet names in the DRAWING TITLE field.
 */
const DRAWING_TITLE_PATTERNS: RegExp[] = [
    // Panel naming with optional suffix (e.g., "PNL A,SMT130", "PNL B,SMT130")
    /^(PNL\s*[A-Z](?:[,\s]+\w+)*)$/i,
    /^(PANEL\s*[A-Z](?:[,\s]+\w+)*)$/i,

    // Control panels (e.g., "CONTROL,JB70", "CONTROL A,JB70", "BOP CTRL,JB74")
    /^((?:BOP\s+)?CTRL?(?:OL)?[,\s]*[A-Z]?[,\s]*(?:JB\d+)?)$/i,
    /^(CONTROL[,\s]*[A-Z]?[,\s]*(?:\d+-BAY|JB\d+|SMT\d+|TT\d+)?)$/i,
    /^(BOP\s+CTRL[,\s]*(?:JB\d+)?)$/i,

    // Rail patterns (e.g., "RAIL,RIGHT,JB70", "RAIL,LEFT,JB73")
    /^(RAIL[,\s]+(?:RIGHT|LEFT|TOP|BOTTOM)[,\s]*(?:JB\d+)?)$/i,
    /^(RAIL[,\s]*JB\d+)$/i,
    /^((?:RIGHT|LEFT)\s+SIDE\s+RAIL[,\s]*(?:JB\d+)?)$/i,
    /^(JB\d+[,\s]*(?:RIGHT|LEFT)?\s*(?:SIDE)?\s*RAIL)$/i,

    // F&G / Fire & Gas patterns
    /^(F&G[,\s]*(?:EDIO|PWR|CTRL)?[,\s]*(?:ONSK)?[,\s]*(?:JB\d+)?)$/i,
    /^(FG&E[,\s]*(?:CTRL)?[,\s]*(?:SMT\d+|JB\d+)?)$/i,

    // FO CONV / VFD patterns
    /^(FO\s+CONV[,\s]*(?:VFD)?[,\s]*(?:JB\d+)?)$/i,
    /^(VFD[,\s]*(?:JB\d+)?)$/i,
    /^(CONV[,\s]*(?:VFD)?[,\s]*(?:JB\d+)?)$/i,

    // HMI patterns
    /^(HMI[,\s\-]*[A-Z]?\s*(?:PWR)?[,\s]*(?:JB\d+)?)$/i,

    // HPC patterns
    /^(HPC[,\s]*(?:CTRL)?[,\s]*(?:JB\d+)?)$/i,

    // TCP - Thermocouple Panel
    /^(TCP[,\s]*(?:SMT\d+|JB\d+)?)$/i,

    // Power Distribution
    /^(PWR\s*DST[,\s]*(?:DR[,\s]*)?(?:SMT\d+)?)$/i,

    // PLC Panel
    /^(PLC[,\s]*(?:PANEL|JB\d+)?)$/i,

    // Generator patterns
    /^(GEN\s+(?:CMPNT|CTRL|CONTROL|VIB|PWR|PANEL)[,\s]*(?:JB\d+|SMT\d+)?)$/i,

    // Beckwith Relay
    /^(BECKWITH[,\s]*(?:RELAY)?[,\s]*(?:SMT\d+)?)$/i,

    // Door panels
    /^(PNL[,\s]+DOOR[,\s]*(?:\d+-BAY)?)$/i,
    /^(DOOR[,\s]+\d+-BAY)$/i,
    /^((?:CONSOLE\s+)?DOOR[,\s]*(?:PNL|PANEL)[,\s]*(?:\d+-BAY)?)$/i,

    // MCC Panel
    /^(MCC[,\s]*(?:PNL)?[,\s]*(?:SMT\d+)?)$/i,

    // Proximity/Vibration panels
    /^(PROX[,\s]*(?:TURB)?[,\s]*(?:SMT\d+)?)$/i,
    /^(VIB[,\s]*(?:PANEL)?[,\s]*(?:SMT\d+)?)$/i,

    // Generic: keywords + JB number
    /^([A-Z0-9&\-]+(?:[,\s]+[A-Z0-9&\-]+)*[,\s]*JB\d+)$/i,

    // TT suffix patterns
    /^([A-Z0-9&\-]+(?:[,\s]+[A-Z0-9&\-]+)*[,;\s]*TT\d+)$/i,

    // Assembly / ASSY patterns
    /^(ASSY[,\s]+(?:[A-Z0-9]+[,\s]*)+)$/i,
    /^(ASSEMBLY[,\s]+[A-Z0-9,\s\-]+)$/i,

    // Console patterns
    /^(CONSOLE[,\s]+[A-Z0-9,\s\-]+)$/i,

    // Remote I/O Box patterns
    /^(REMOTE\s+I\/?O\s+BOX[\s#]*\d*)$/i,

    // Directional + PANEL patterns
    /^((?:BACK|LEFT|RIGHT|FRONT)\s+(?:SIDE\s+)?PANEL[,\s]*.*)$/i,

    // SCS Panel
    /^(SCS\s+PANEL[,\s]*.*)$/i,
];

/**
 * Lines to skip when scanning for a drawing title.
 */
const SKIP_PATTERNS: RegExp[] = [
    /^DRAWING TITLE$/i,
    /^DWG NO\.?$/i,
    /^SHEETOF$/i,
    /^REV$/i,
    /^DATE$/i,
    /^CAGE NO/i,
    /^P\.?O\.? B/i,
    /^San Diego/i,
    /^\d+$/,
    /^\d+\.\d+$/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^CATERPILLAR/i,
    /^THIS PRINT/i,
    /^THIS COPYRIGHT/i,
    /^CONFIDENTIAL/i,
    /^Solar Turbines/i,
    /^DESCRIPTION/i,
    /^REVISION/i,
    /^RELEASE/i,
    /^STAMP/i,
    /^MODEL$/i,
    /^LOC$/i,
    /^SIZE$/i,
    /^DATA$/i,
    /^CONTROL$/i,
    /^LEVEL$/i,
    /^PROJECT NAME$/i,
    /^MFG DES ENGINEER$/i,
    /^DESIGN ENGINEER$/i,
    /^PANEL NO\.?$/i,
    /^\d+[A-Z]\d+$/,
    /^T:\\PROJECT/i,
    /^PD-$/i,
    /^\d+(?:\.\d+)?["']\s/i,
    /^\d+(?:\.\d+)?["']$/i,
    /^\d+(?:\.\d+)?\s*(?:IN|INCH|MM|CM)\b/i,
    /^RAIL$/i,
    /^DOOR$/i,
    /^FRAME$/i,
    /^GROUND$/i,
    /^VIEW$/i,
    /^PANELS?$/i,
    /^LAYOUT$/i,
    /^GROUNDING$/i,
    /^INSTALL\b/i,
    /^ADD\s/i,
    /^NOTE/i,
    /^GRN\/YLW/i,
    /^\d+\s*PLACES?$/i,
    /BOX:\s*\d/i,
    /PANEL:\s*\d{5}/i,
    /^SPRING\b/i,
    /^\d{5,}[-]\d/,
    /^NON-PAINTED/i,
    /^SIDE VIEW$/i,
    /^TO\s+/i,
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a line should be skipped when scanning for a drawing title.
 */
function shouldSkipLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) return true;
    if (trimmed.length > 40) return true;
    return SKIP_PATTERNS.some(p => p.test(trimmed));
}

/**
 * Check if a line looks like a valid drawing title based on known patterns.
 */
function isValidDrawingTitle(line: string): boolean {
    const trimmed = line.trim().toUpperCase();
    const hasKeyword =
        /\b(PNL|PANEL|CTRL|CONTROL|TCP|PLC|MCC|PWR|GEN|FG&E|F&G|BECKWITH|VIB|PROX|BOP|HMI|CONV|VFD|FO|EDIO|ONSK|HPC|TT\d|SIDE|ASSY|ASSEMBLY|CONSOLE|REMOTE|DOORS?|BAY|SCS|BOX)\b/i.test(
            trimmed,
        );
    const hasJbPattern = /\bJB\d+\b/i.test(trimmed);
    if (!hasKeyword && !hasJbPattern) return false;
    return DRAWING_TITLE_PATTERNS.some(p => p.test(trimmed));
}

// ============================================================================
// Title Extraction
// ============================================================================

/**
 * Extract the drawing title by spatial proximity to the "DRAWING TITLE" label.
 * The title block layout is consistent: the value is below the label in the
 * same column area.
 */
export function extractTitleByPosition(
    items: PositionedTextItem[],
): string | undefined {
    // Find the "DRAWING TITLE" label (may be one item or two separate items)
    let labelItem: PositionedTextItem | undefined;

    // Try single item first
    labelItem = items.find(i => /^DRAWING\s+TITLE$/i.test(i.str));

    // If not found as one item, look for "DRAWING" near "TITLE"
    if (!labelItem) {
        const drawingItem = items.find(i => /^DRAWING$/i.test(i.str));
        const titleItem = items.find(i => /^TITLE$/i.test(i.str));
        if (drawingItem && titleItem) {
            labelItem = drawingItem.x <= titleItem.x ? drawingItem : titleItem;
            labelItem = {
                ...labelItem,
                width: Math.max(
                    drawingItem.x +
                    (drawingItem.width || 0) -
                    Math.min(drawingItem.x, titleItem.x),
                    titleItem.x +
                    (titleItem.width || 0) -
                    Math.min(drawingItem.x, titleItem.x),
                ),
            };
        }
    }

    if (!labelItem) return undefined;

    const labelX = labelItem.x;
    const labelY = labelItem.y;
    const yTolerance = 70;
    const xTolerance = 120;

    function isNoise(str: string): boolean {
        if (
            /^(DRAWING TITLE|DWG NO\.?|DATE|REV|SIZE|CAGE NO|SHEET|SHT|Solar Turbines|CATERPILLAR|P\.?O\.?\s*BOX|San Diego|PANEL NO\.?|DWG REV|MFG DES|DESIGN ENGINEER|PROJECT NAME|MODEL|LOC|DATA|CONTROL|LEVEL|RELEASE|STAMP|DESCRIPTION|REVISION|A Caterpillar|OF)$/i.test(
                str,
            )
        )
            return true;
        if (/^\d+$/.test(str)) return true;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) return true;
        if (/^T:\\/.test(str)) return true;
        if (/^\d+[A-Z]\d+/.test(str)) return true;
        if (/^PD-/.test(str)) return true;
        if (/^\d{5,}[-]/.test(str)) return true;
        if (/^[A-Z]\d*$/.test(str) && str.length <= 2) return true;
        if (/^\d{4,}$/.test(str)) return true;
        return false;
    }

    const titleItems: PositionedTextItem[] = [];
    for (const item of items) {
        if (item === labelItem) continue;
        const str = item.str.trim();
        if (!str || str.length < 2) continue;
        if (isNoise(str)) continue;
        const dy = labelY - item.y;
        const dx = item.x - labelX;
        if (dy > 0 && dy < yTolerance && Math.abs(dx) < xTolerance) {
            titleItems.push(item);
        }
    }

    if (titleItems.length === 0) return undefined;

    // Sort top-to-bottom (descending Y)
    titleItems.sort((a, b) => b.y - a.y);

    // Combine adjacent lines (multi-line titles like "ASSEMBLY" + "CONSOLE")
    const lines: string[] = [];
    let lastY = titleItems[0].y;
    for (const item of titleItems) {
        const gap = lastY - item.y;
        if (lines.length > 0 && gap > 30) break;
        lines.push(item.str.trim());
        lastY = item.y;
    }

    const combined = lines.join(" ").toUpperCase();
    if (combined.length < 3) return undefined;
    return combined;
}

/**
 * Extract the drawing title using regex strategies on raw text.
 * Used as a fallback when spatial extraction fails.
 */
export function extractTitleByRegex(
    textContent: string,
): string | undefined {
    const lines = textContent
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    // Strategy 1: Known title patterns
    for (const line of lines) {
        const trimmed = line.trim();
        if (shouldSkipLine(trimmed)) continue;
        for (const pattern of DRAWING_TITLE_PATTERNS) {
            const match = trimmed.match(pattern);
            if (match) return match[1].toUpperCase();
        }
    }

    // Strategy 2: Lines after "DRAWING TITLE" marker
    const drawingTitleIndex = lines.findIndex(l =>
        /^DRAWING TITLE$/i.test(l.trim()),
    );
    if (drawingTitleIndex >= 0) {
        for (
            let i = drawingTitleIndex + 1;
            i < Math.min(drawingTitleIndex + 8, lines.length);
            i++
        ) {
            if (shouldSkipLine(lines[i])) continue;
            if (isValidDrawingTitle(lines[i])) return lines[i].trim().toUpperCase();
        }
    }

    // Strategy 3: Lines with JB pattern
    for (const line of lines) {
        const trimmed = line.trim();
        if (shouldSkipLine(trimmed)) continue;
        if (
            /\bJB\d+\b/i.test(trimmed) &&
            trimmed.length >= 5 &&
            trimmed.length <= 40 &&
            /^[A-Z0-9&,\s\-;]+$/i.test(trimmed)
        ) {
            return trimmed.toUpperCase();
        }
    }

    // Strategy 4: Lines before "SHEETOF" marker
    const sheetOfIndex = lines.findIndex(l => /^SHEETOF$/i.test(l.trim()));
    if (sheetOfIndex > 0) {
        for (let i = sheetOfIndex - 1; i >= Math.max(0, sheetOfIndex - 10); i--) {
            if (shouldSkipLine(lines[i])) continue;
            if (isValidDrawingTitle(lines[i])) return lines[i].trim().toUpperCase();
        }
    }

    // Strategy 5: First valid title in first 150 lines
    for (const line of lines.slice(0, 150)) {
        if (shouldSkipLine(line)) continue;
        if (isValidDrawingTitle(line)) return line.trim().toUpperCase();
    }

    return undefined;
}

// ============================================================================
// Panel / Box / Door Extraction
// ============================================================================

/**
 * Extract panel number from page text.
 * Searches line-by-line to avoid cross-line false matches.
 */
export function extractPanelNumber(
    textContent: string,
): string | undefined {
    const lines = textContent.split("\n");
    const panelPatterns = [
        /(?:^|\b)PANEL:\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)PANEL\s+NO\.?\s*:?\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)PANEL\s+#\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)PNL:\s*(\d{5,}[-]?\d*)/i,
    ];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const pattern of panelPatterns) {
            const match = trimmed.match(pattern);
            if (match) return match[1].trim();
        }
    }
    return undefined;
}

/**
 * Extract box number from page text.
 * Searches line-by-line to avoid cross-line false matches.
 */
export function extractBoxNumber(
    textContent: string,
): string | undefined {
    const lines = textContent.split("\n");
    const boxPatterns = [
        /(?:^|\b)BOX:\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)BOX\s+NO\.?\s*:?\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)BOX\s+#\s*(\d{5,}[-]?\d*)/i,
        /(?:^|\b)ENCLOSURE:\s*(\d{5,}[-]?\d*)/i,
    ];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const pattern of boxPatterns) {
            const match = trimmed.match(pattern);
            if (match) return match[1].trim();
        }
    }
    return undefined;
}

/**
 * Detect if layout has door labels (indicates BOX type).
 */
export function hasDoorLabels(textContent: string): boolean {
    const doorPatterns = [
        /right\s*door\s*label/i,
        /left\s*door\s*label/i,
        /door\s*labels?\s*pn/i,
        /left\s*interior\s*view/i,
        /right\s*interior\s*view/i,
        /front\s*view.*interior/i,
    ];
    return doorPatterns.some(p => p.test(textContent));
}

// ============================================================================
// Rail & Device Extraction
// ============================================================================

/** Pattern for single-item rail labels: "RAIL 58.25\"" or "5.75\" Rail" or "17\" Rail (2)" or "14.25\" LOW RAIL" */
const RAIL_SINGLE_PATTERNS = [
    /^RAIL\s+([\d.]+["\u201D]?)\s*(?:\(\d+\))?$/i,
    /^([\d.]+["\u201D]?)\s*RAIL\s*(?:\(\d+\))?$/i,
    /^([\d.]+["\u201D]?)\s*LOW\s+RAIL\s*(?:\(\d+\))?$/i,
    /^LOW\s+RAIL\s+([\d.]+["\u201D]?)\s*(?:\(\d+\))?$/i,
];

/** Device tags: 2 uppercase letters + 4 digits (e.g., AF0041, KA0001) */
const DEVICE_TAG_PATTERN = /^[A-Z]{2}\d{4}$/;

/** Part numbers: 5+ digits with dash suffix (e.g., 2684693-17) */
const PART_NUMBER_PATTERN = /^\d{5,}[-]\d+$/;

/**
 * Extract rail groups with their devices from positioned text items.
 * Uses spatial proximity to assign devices to the nearest rail above them.
 */
export function extractRailGroups(
    items: PositionedTextItem[],
): RailGroup[] {
    // 1. Find all rail labels — single items first, then combine split items
    const rails: { label: string; x: number; y: number; width: number; height: number }[] = [];
    const usedIndices = new Set<number>();

    // Pass 1: Single-item rails
    for (let i = 0; i < items.length; i++) {
        const str = items[i].str.trim();
        for (const pattern of RAIL_SINGLE_PATTERNS) {
            if (pattern.test(str)) {
                rails.push({
                    label: str,
                    x: items[i].x,
                    y: items[i].y,
                    width: items[i].width,
                    height: items[i].height,
                });
                usedIndices.add(i);
                break;
            }
        }
    }

    // Pass 2: Split rail labels ("RAIL" or "LOW RAIL" near a dimension like "14.25\"")
    for (let i = 0; i < items.length; i++) {
        if (usedIndices.has(i)) continue;
        if (!/^(?:LOW\s+)?RAIL$/i.test(items[i].str.trim())) continue;

        for (let j = 0; j < items.length; j++) {
            if (i === j || usedIndices.has(j)) continue;
            const dimStr = items[j].str.trim();
            if (!/^[\d.]+["\u201D]$/.test(dimStr)) continue;

            const dx = Math.abs(items[i].x - items[j].x);
            const dy = Math.abs(items[i].y - items[j].y);
            if (dy < 15 && dx < 200) {
                const leftItem = items[i].x < items[j].x ? items[i] : items[j];
                const rightItem = items[i].x < items[j].x ? items[j] : items[i];
                rails.push({
                    label: `${leftItem.str.trim()} ${rightItem.str.trim()}`,
                    x: Math.min(items[i].x, items[j].x),
                    y: items[i].y,
                    width:
                        Math.abs(rightItem.x - leftItem.x)
                        + Math.max(leftItem.width, 0)
                        + Math.max(rightItem.width, 0),
                    height: Math.max(items[i].height, items[j].height),
                });
                usedIndices.add(i);
                usedIndices.add(j);
                break;
            }
        }
    }

    // 2. Collect device tags, part numbers, and terminal labels
    const deviceItems: { tag: string; x: number; y: number; width: number; height: number }[] = [];
    const partNumberItems: { pn: string; x: number; y: number }[] = [];
    const terminalNumberItems: { num: number; x: number; y: number }[] = [];

    for (const item of items) {
        const str = item.str.trim();
        if (DEVICE_TAG_PATTERN.test(str)) {
            deviceItems.push({ tag: str, x: item.x, y: item.y, width: item.width, height: item.height });
        } else if (PART_NUMBER_PATTERN.test(str)) {
            partNumberItems.push({ pn: str, x: item.x, y: item.y });
        } else if (/^\d{1,2}$/.test(str) && item.width < 15) {
            terminalNumberItems.push({
                num: parseInt(str, 10),
                x: item.x,
                y: item.y,
            });
        }
    }

    // If no devices found at all, nothing to do
    if (deviceItems.length === 0) return [];

    // 3. Assign each device to the nearest rail below it within that rail's
    //    vertical band. This keeps devices from "leaking" down into lower rails
    //    on noisy pages where the nearest-below heuristic alone is too loose.
    const maxVerticalDistance = 420;
    const interRailPadding = 18;

    // Sort rails top-to-bottom (ascending Y because PDF coordinates grow downward)
    rails.sort((a, b) => a.y - b.y);
    const groups = rails.map(rail => ({
        railLabel: rail.label,
        railY: rail.y,
        railX: rail.x,
        railWidth: rail.width,
        devices: [] as RailDevice[],
    }));

    const unassignedDevices: RailDevice[] = [];

    for (const device of deviceItems) {
        let bestRail: (typeof groups)[number] | null = null;
        let bestDist = Infinity;
        let bestDx = Infinity;

        for (let index = 0; index < groups.length; index++) {
            const group = groups[index];
            const dy = group.railY - device.y;
            if (dy <= 0 || dy >= maxVerticalDistance) {
                continue;
            }

            const upperBoundary =
                index === 0
                    ? group.railY - maxVerticalDistance
                    : groups[index - 1].railY + interRailPadding;
            const lowerBoundary = group.railY + interRailPadding;

            if (device.y <= upperBoundary || device.y >= lowerBoundary) {
                continue;
            }

            const dx = Math.abs(group.railX - device.x);
            // Prefer closest vertical; for near-equal vertical distance, prefer closest horizontal.
            if (dy < bestDist || (Math.abs(dy - bestDist) < 5 && dx < bestDx)) {
                bestDist = dy;
                bestDx = dx;
                bestRail = group;
            }
        }

        // Build device record with nearby part numbers and terminals
        const nearbyParts: string[] = [];
        for (const pn of partNumberItems) {
            const dx = Math.abs(pn.x - device.x);
            const dy = device.y - pn.y;
            if (dx < 50 && dy > 0 && dy < 30) nearbyParts.push(pn.pn);
        }

        const nearbyTerminals: number[] = [];
        for (const tn of terminalNumberItems) {
            const dx = Math.abs(tn.x - device.x);
            const dy = Math.abs(tn.y - device.y);
            if (dx < 25 && dy < 20) nearbyTerminals.push(tn.num);
        }
        const terminalCount =
            nearbyTerminals.length > 0
                ? Math.max(...nearbyTerminals)
                : undefined;

        const railDevice: RailDevice = {
            tag: device.tag,
            x: device.x,
            y: device.y,
            width: device.width,
            height: device.height,
            boxLeft: device.x - 18,
            boxRight: device.x + Math.max(device.width, 16) + 18,
            boxTop: device.y - 16,
            boxBottom: device.y + Math.max(device.height, 12) + 16,
            partNumbers: nearbyParts,
            terminalCount,
        };

        if (bestRail) {
            bestRail.devices.push(railDevice);
        } else {
            unassignedDevices.push(railDevice);
        }
    }

    // Sort devices left-to-right within each rail
    for (let index = 0; index < groups.length; index++) {
        const group = groups[index];
        group.devices.sort((a, b) => a.x - b.x);

        const upperBoundary =
            index === 0
                ? group.railY - maxVerticalDistance
                : groups[index - 1].railY + interRailPadding;
        const lowerBoundary = group.railY + interRailPadding;

        const labelStart = group.railX;
        const labelEnd = group.railX + Math.max(group.railWidth || 0, 120);
        const deviceStart =
            group.devices.length > 0
                ? Math.min(...group.devices.map(device => device.x)) - 80
                : labelStart;
        const deviceEnd =
            group.devices.length > 0
                ? Math.max(...group.devices.map(device => device.x)) + 80
                : labelEnd;

        group.spanXStart = Math.max(0, Math.min(labelStart, deviceStart));
        group.spanXEnd = Math.max(group.spanXStart + 80, Math.max(labelEnd, deviceEnd));
        group.corridorTop = upperBoundary;
        group.corridorBottom = lowerBoundary;
        group.deviceClusters = buildDeviceClusters(group.devices, group.corridorTop, group.corridorBottom);
    }

    // Build result: rails with devices (skip unassigned devices)
    const result: RailGroup[] = groups
        .filter(g => g.devices.length > 0)
        .map(({ railX: _rx, railWidth: _rw, ...rest }) => rest);

    return dedupeRailGroups(result);
}

// ============================================================================
// Panduct Extraction
// ============================================================================

/** Patterns for panduct labels in layout drawings.
 *  Panducts are commonly labeled with 3-dimension format: NxNxN (e.g., "2X5X52", "2x4x22")
 *  or with explicit "PANDUCT" / "WIRING DUCT" / "P/D" text. */
/** Labels that mention "panduct" but are NOT actual panducts */
const PANDUCT_EXCLUSIONS = [
    /\bNOTCH\b/i,
    /\bCUT\s*OUT\b/i,
];

const PANDUCT_PATTERNS = [
    // 3-dimension format: WxHxL (e.g., "2X5X52", "2x4x22", "1.5X3X48")
    // This is the most common panduct label format in layout drawings
    /^\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?$/,
    // Explicit panduct keywords
    /\bPANDUCT\b/i,
    /\bPAN\s*DUCT\b/i,
    /\bWIRING\s*DUCT\b/i,
    /\bWIRE\s*DUCT\b/i,
    /\bP\/D\b/i,
    // Dimension + PANDUCT combinations (e.g., "1.5x3 PANDUCT", "PANDUCT 2x4")
    /[\d.]+["\u201D]?\s*[xX×]\s*[\d.]+["\u201D]?\s*(?:PANDUCT|PAN\s*DUCT|P\/D)/i,
    /(?:PANDUCT|PAN\s*DUCT|P\/D)\s*[\d.]+["\u201D]?\s*[xX×]\s*[\d.]+["\u201D]?/i,
    // Dimension + PD (e.g., "1.5x3 PD")
    /[\d.]+["\u201D]?\s*[xX×]\s*[\d.]+["\u201D]?\s*PD\b/i,
    /\bPD\s+[\d.]+["\u201D]?\s*[xX×]\s*[\d.]+["\u201D]?/i,
];

/**
 * Extract panduct (wiring duct) labels and positions from positioned text items.
 *
 * Panducts are most commonly labeled with a 3-dimension format: NxNxN
 * (e.g., "2X5X52", "2x4x22") representing width × height × length.
 * Also matches explicit "PANDUCT", "WIRING DUCT", "P/D" keywords.
 *
 * Split-label detection combines nearby text items that together form
 * a panduct reference (e.g., "PANDUCT" near a dimension string).
 */
export function extractPanducts(
    items: PositionedTextItem[],
): PanductInfo[] {
    const panducts: PanductInfo[] = [];
    const usedIndices = new Set<number>();

    // Pass 1: Single-item panduct labels (including NxNxN dimension format)
    for (let i = 0; i < items.length; i++) {
        const str = items[i].str.trim();
        // Skip false positives (e.g., "NOTCH PANDUCT")
            if (PANDUCT_EXCLUSIONS.some(p => p.test(str))) continue;
        for (const pattern of PANDUCT_PATTERNS) {
            if (pattern.test(str)) {
                panducts.push({
                    label: str,
                    x: items[i].x,
                    y: items[i].y,
                    width: items[i].width,
                    height: items[i].height,
                    corridorLeft: items[i].x - 18,
                    corridorRight: items[i].x + Math.max(items[i].width, 20) + 18,
                    corridorTop: items[i].y - 16,
                    corridorBottom: items[i].y + Math.max(items[i].height, 12) + 16,
                });
                usedIndices.add(i);
                break;
            }
        }
    }

    // Pass 2: Split labels — panduct keyword near a dimension item
    for (let i = 0; i < items.length; i++) {
        if (usedIndices.has(i)) continue;
        if (!/\b(?:PANDUCT|PAN\s*DUCT|WIRING\s*DUCT|WIRE\s*DUCT|P\/D)\b/i.test(items[i].str.trim())) continue;

        // Look for a nearby dimension item (2-dim or 3-dim)
        let foundDim = false;
        for (let j = 0; j < items.length; j++) {
            if (i === j || usedIndices.has(j)) continue;
            const dimStr = items[j].str.trim();
            if (!/[\d.]+\s*[xX×]\s*[\d.]+/.test(dimStr)) continue;

            const dx = Math.abs(items[i].x - items[j].x);
            const dy = Math.abs(items[i].y - items[j].y);
            if (dy < 15 && dx < 200) {
                const label = `${dimStr} PANDUCT`;
                panducts.push({
                    label,
                    x: Math.min(items[i].x, items[j].x),
                    y: Math.min(items[i].y, items[j].y),
                    width: Math.max(items[i].width, items[j].width),
                    height: Math.max(items[i].height, items[j].height),
                    corridorLeft: Math.min(items[i].x, items[j].x) - 18,
                    corridorRight:
                        Math.max(items[i].x + items[i].width, items[j].x + items[j].width) + 18,
                    corridorTop: Math.min(items[i].y, items[j].y) - 16,
                    corridorBottom:
                        Math.max(items[i].y + items[i].height, items[j].y + items[j].height) + 16,
                });
                usedIndices.add(i);
                usedIndices.add(j);
                foundDim = true;
                break;
            }
        }
        if (!foundDim) {
            panducts.push({
                label: items[i].str.trim(),
                x: items[i].x,
                y: items[i].y,
                width: items[i].width,
                height: items[i].height,
                corridorLeft: items[i].x - 18,
                corridorRight: items[i].x + Math.max(items[i].width, 20) + 18,
                corridorTop: items[i].y - 16,
                corridorBottom: items[i].y + Math.max(items[i].height, 12) + 16,
            });
            usedIndices.add(i);
        }
    }

    // Pass 3: Split NxNxN — individual dimension numbers near each other
    // Sometimes pdf.js splits "2X5X52" into separate items like "2", "X", "5", "X", "52"
    // Combine nearby items and check if they form a 3-dim pattern
    for (let i = 0; i < items.length; i++) {
        if (usedIndices.has(i)) continue;
        const str = items[i].str.trim();
        // Look for items starting with a digit that could be part of NxNxN
        if (!/^\d/.test(str)) continue;

        // Gather nearby items within a small horizontal/vertical window
        const cluster: { idx: number; str: string; x: number }[] = [{ idx: i, str, x: items[i].x }];
        for (let j = 0; j < items.length; j++) {
            if (i === j || usedIndices.has(j)) continue;
            const dy = Math.abs(items[i].y - items[j].y);
            const dx = Math.abs(items[i].x - items[j].x);
            if (dy < 8 && dx < 120) {
                cluster.push({ idx: j, str: items[j].str.trim(), x: items[j].x });
            }
        }
        if (cluster.length < 2) continue;

        // Sort by x position and concatenate
        cluster.sort((a, b) => a.x - b.x);
        const combined = cluster.map(c => c.str).join('');
        if (/^\d+(?:\.\d+)?[xX×]\d+(?:\.\d+)?[xX×]\d+(?:\.\d+)?$/.test(combined)) {
            const clusterItems = cluster.map(c => items[c.idx]);
            panducts.push({
                label: combined,
                x: Math.min(...clusterItems.map(item => item.x)),
                y: Math.min(...clusterItems.map(item => item.y)),
                width: Math.max(...clusterItems.map(item => item.width)),
                height: Math.max(...clusterItems.map(item => item.height)),
                corridorLeft: Math.min(...clusterItems.map(item => item.x)) - 18,
                corridorRight: Math.max(...clusterItems.map(item => item.x + item.width)) + 18,
                corridorTop: Math.min(...clusterItems.map(item => item.y)) - 16,
                corridorBottom: Math.max(...clusterItems.map(item => item.y + item.height)) + 16,
            });
            for (const c of cluster) usedIndices.add(c.idx);
        }
    }
    return dedupePanducts(panducts);
}

function dedupePanducts(panducts: PanductInfo[]): PanductInfo[] {
    const sorted = [...panducts].sort(
        (a, b) => a.y - b.y || (a.x ?? 0) - (b.x ?? 0) || a.label.localeCompare(b.label),
    );
    const deduped: PanductInfo[] = [];
    const yTolerance = 10;
    const xTolerance = 28;

    for (const panduct of sorted) {
        const normalizedLabel = normalizeEntityLabel(panduct.label);
        const existing = deduped.find(
            candidate =>
                normalizeEntityLabel(candidate.label) === normalizedLabel
                && Math.abs(candidate.y - panduct.y) <= yTolerance
                && Math.abs((candidate.x ?? 0) - (panduct.x ?? 0)) <= xTolerance,
        );

        if (existing) {
            existing.y = Math.min(existing.y, panduct.y);
            if (typeof panduct.x === "number") {
                existing.x =
                    typeof existing.x === "number"
                        ? Math.min(existing.x, panduct.x)
                        : panduct.x;
            }
            if (typeof panduct.width === "number") {
                existing.width = Math.max(existing.width ?? 0, panduct.width);
            }
            if (typeof panduct.height === "number") {
                existing.height = Math.max(existing.height ?? 0, panduct.height);
            }
            if (typeof panduct.corridorLeft === "number") {
                existing.corridorLeft = Math.min(existing.corridorLeft ?? panduct.corridorLeft, panduct.corridorLeft);
            }
            if (typeof panduct.corridorRight === "number") {
                existing.corridorRight = Math.max(existing.corridorRight ?? panduct.corridorRight, panduct.corridorRight);
            }
            if (typeof panduct.corridorTop === "number") {
                existing.corridorTop = Math.min(existing.corridorTop ?? panduct.corridorTop, panduct.corridorTop);
            }
            if (typeof panduct.corridorBottom === "number") {
                existing.corridorBottom = Math.max(existing.corridorBottom ?? panduct.corridorBottom, panduct.corridorBottom);
            }
            continue;
        }

        deduped.push({ ...panduct, label: panduct.label.trim() });
    }

    return deduped;
}

function dedupeRailGroups(groups: RailGroup[]): RailGroup[] {
    const sorted = [...groups].sort((a, b) => a.railY - b.railY || a.railLabel.localeCompare(b.railLabel));
    const deduped: RailGroup[] = [];
    const yTolerance = 12;

    for (const group of sorted) {
        const normalizedLabel = normalizeEntityLabel(group.railLabel);
        const existing = deduped.find(
            candidate =>
                normalizeEntityLabel(candidate.railLabel) === normalizedLabel
                && Math.abs(candidate.railY - group.railY) <= yTolerance,
        );

        if (!existing) {
            deduped.push({
                railLabel: group.railLabel.trim(),
                railY: group.railY,
                spanXStart: group.spanXStart,
                spanXEnd: group.spanXEnd,
                corridorTop: group.corridorTop,
                corridorBottom: group.corridorBottom,
                deviceClusters: group.deviceClusters,
                devices: [...group.devices].sort((a, b) => a.x - b.x),
            });
            continue;
        }

        const mergedDevices = new Map<string, RailDevice>();
        for (const device of [...existing.devices, ...group.devices]) {
            const key = `${device.tag.toUpperCase()}:${Math.round(device.x)}:${Math.round(device.y)}`;
            if (!mergedDevices.has(key)) {
                mergedDevices.set(key, device);
            }
        }

        existing.devices = Array.from(mergedDevices.values()).sort((a, b) => a.x - b.x);
        existing.railY = Math.min(existing.railY, group.railY);
        const spanStartCandidates = [existing.spanXStart, group.spanXStart].filter(
            (value): value is number => typeof value === "number" && Number.isFinite(value),
        );
        const spanEndCandidates = [existing.spanXEnd, group.spanXEnd].filter(
            (value): value is number => typeof value === "number" && Number.isFinite(value),
        );
        const corridorTopCandidates = [existing.corridorTop, group.corridorTop].filter(
            (value): value is number => typeof value === "number" && Number.isFinite(value),
        );
        const corridorBottomCandidates = [existing.corridorBottom, group.corridorBottom].filter(
            (value): value is number => typeof value === "number" && Number.isFinite(value),
        );

        existing.spanXStart =
            spanStartCandidates.length > 0 ? Math.min(...spanStartCandidates) : existing.spanXStart;
        existing.spanXEnd =
            spanEndCandidates.length > 0 ? Math.max(...spanEndCandidates) : existing.spanXEnd;
        existing.corridorTop =
            corridorTopCandidates.length > 0 ? Math.min(...corridorTopCandidates) : existing.corridorTop;
        existing.corridorBottom =
            corridorBottomCandidates.length > 0
                ? Math.max(...corridorBottomCandidates)
                : existing.corridorBottom;
        existing.deviceClusters = dedupeDeviceClusters([
            ...(existing.deviceClusters ?? []),
            ...(group.deviceClusters ?? []),
        ]);
    }

    return deduped;
}

function buildDeviceClusters(
    devices: RailDevice[],
    corridorTop?: number,
    corridorBottom?: number,
): DeviceCluster[] {
    if (devices.length === 0) {
        return [];
    }

    const sorted = [...devices].sort((a, b) => a.x - b.x);
    const clusters: RailDevice[][] = [];
    let current: RailDevice[] = [sorted[0]];

    for (let index = 1; index < sorted.length; index++) {
        const previous = current[current.length - 1];
        const next = sorted[index];
        const gap = next.x - previous.x;

        if (gap <= 190) {
            current.push(next);
            continue;
        }

        clusters.push(current);
        current = [next];
    }

    clusters.push(current);

    return dedupeDeviceClusters(
        clusters.map((cluster) => {
            const xStart = Math.min(...cluster.map((device) => device.boxLeft ?? (device.x - 18)));
            const xEnd = Math.max(...cluster.map((device) => device.boxRight ?? (device.x + 18)));
            const intrinsicTop = Math.min(...cluster.map((device) => device.boxTop ?? (device.y - 16)));
            const intrinsicBottom = Math.max(...cluster.map((device) => device.boxBottom ?? (device.y + 16)));
            const yTop = typeof corridorTop === "number" ? Math.min(corridorTop, intrinsicTop) : intrinsicTop;
            const yBottom =
                typeof corridorBottom === "number"
                    ? Math.min(corridorBottom, intrinsicBottom + 28)
                    : intrinsicBottom;
            const deviceTags = cluster.map((device) => device.tag);

            return {
                label:
                    cluster.length === 1
                        ? deviceTags[0]
                        : `${deviceTags[0]}-${deviceTags[deviceTags.length - 1]} (${cluster.length})`,
                deviceTags,
                xStart,
                xEnd,
                yTop,
                yBottom,
            };
        }),
    );
}

function dedupeDeviceClusters(clusters: DeviceCluster[]): DeviceCluster[] {
    const sorted = [...clusters].sort((a, b) => a.xStart - b.xStart || a.yTop - b.yTop);
    const deduped: DeviceCluster[] = [];

    for (const cluster of sorted) {
        const existing = deduped.find(
            (candidate) =>
                Math.abs(candidate.xStart - cluster.xStart) <= 20
                && Math.abs(candidate.xEnd - cluster.xEnd) <= 20
                && Math.abs(candidate.yTop - cluster.yTop) <= 20
                && Math.abs(candidate.yBottom - cluster.yBottom) <= 20,
        );

        if (!existing) {
            deduped.push(cluster);
            continue;
        }

        existing.xStart = Math.min(existing.xStart, cluster.xStart);
        existing.xEnd = Math.max(existing.xEnd, cluster.xEnd);
        existing.yTop = Math.min(existing.yTop, cluster.yTop);
        existing.yBottom = Math.max(existing.yBottom, cluster.yBottom);
        existing.deviceTags = Array.from(new Set([...existing.deviceTags, ...cluster.deviceTags]));
        existing.label =
            existing.deviceTags.length === 1
                ? existing.deviceTags[0]
                : `${existing.deviceTags[0]}-${existing.deviceTags[existing.deviceTags.length - 1]} (${existing.deviceTags.length})`;
    }

    return deduped;
}

// ============================================================================
// PDF Text → Positioned Items
// ============================================================================

interface PDFTextItem {
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
}

/**
 * Convert raw pdf.js text content items into positioned text items.
 * Returns both a newline-joined string and the positioned array.
 */
export function buildPositionedTextItems(
    pdfItems: PDFTextItem[],
): { text: string; items: PositionedTextItem[] } {
    const items: PositionedTextItem[] = [];

    for (const item of pdfItems) {
        const str = item.str?.trim();
        if (!str) continue;
        items.push({
            str,
            x: item.transform?.[4] ?? 0,
            y: item.transform?.[5] ?? 0,
            width: item.width ?? 0,
            height: item.height ?? 0,
        });
    }

    const text = items.map(i => i.str).join("\n");
    return { text, items };
}
