import type { LayoutPdfTextItem, LayoutPdfTextSource } from "./parse-layout-pdf";

export interface PdfColumnBoundary {
    key: string;
    header?: string;
    xMin: number;
    xMax: number;
}

export interface PdfColumnExtractionOptions {
    rowTolerance?: number;
    includeEmptyRows?: boolean;
    trimValues?: boolean;
    columns?: PdfColumnBoundary[];
    headers?: string[];
}

export interface ExtractedPdfColumnRow {
    rowIndex: number;
    pageNumber: number;
    values: Record<string, string>;
}

export interface ProjectUnitKeyInput {
    pdNumber: string;
    project: string;
    unit: string;
}

export type ProjectUnitColumnObject = Record<string, Record<string, string>>;

const DEFAULT_ROW_TOLERANCE = 2;

interface GroupedRow {
    pageNumber: number;
    y: number;
    items: LayoutPdfTextItem[];
}

function normalizeToken(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9-_]/g, "")
        .toLowerCase();
}

export function createProjectUnitKey(input: ProjectUnitKeyInput): string {
    return [input.pdNumber, input.project, input.unit].map(normalizeToken).join("-");
}

function groupItemsByRow(items: LayoutPdfTextItem[], rowTolerance: number): GroupedRow[] {
    const byPage = new Map<number, LayoutPdfTextItem[]>();
    for (const item of items) {
        const text = item.text.trim();
        if (!text) {
            continue;
        }

        const pageItems = byPage.get(item.pageNumber) ?? [];
        pageItems.push({ ...item, text });
        byPage.set(item.pageNumber, pageItems);
    }

    const grouped: GroupedRow[] = [];
    const pages = Array.from(byPage.keys()).sort((left, right) => left - right);

    for (const pageNumber of pages) {
        const sorted = (byPage.get(pageNumber) ?? []).sort((left, right) => {
            if (Math.abs(left.y - right.y) > rowTolerance) {
                return right.y - left.y;
            }
            return left.x - right.x;
        });

        for (const item of sorted) {
            const current = grouped[grouped.length - 1];
            if (!current || current.pageNumber !== pageNumber || Math.abs(current.y - item.y) > rowTolerance) {
                grouped.push({ pageNumber, y: item.y, items: [item] });
                continue;
            }
            current.items.push(item);
        }
    }

    return grouped;
}

function rowToValuesByHeaders(rowItems: LayoutPdfTextItem[], headers?: string[], trimValues = true): Record<string, string> {
    const sorted = [...rowItems].sort((left, right) => left.x - right.x);
    const values: Record<string, string> = {};

    sorted.forEach((item, index) => {
        const raw = item.text;
        const value = trimValues ? raw.trim() : raw;
        const key = headers?.[index] ?? `column_${index + 1}`;

        if (!values[key]) {
            values[key] = value;
            return;
        }

        values[key] = `${values[key]} ${value}`.trim();
    });

    return values;
}

function rowToValuesByBoundaries(
    rowItems: LayoutPdfTextItem[],
    columns: PdfColumnBoundary[],
    trimValues = true,
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const column of columns) {
        const parts = rowItems
            .filter((item) => item.x >= column.xMin && item.x <= column.xMax)
            .sort((left, right) => left.x - right.x)
            .map((item) => (trimValues ? item.text.trim() : item.text))
            .filter(Boolean);

        values[column.key] = parts.join(" ").trim();
    }
    return values;
}

export function extractPdfColumnRows(
    source: LayoutPdfTextSource,
    options: PdfColumnExtractionOptions = {},
): ExtractedPdfColumnRow[] {
    const rowTolerance = options.rowTolerance ?? DEFAULT_ROW_TOLERANCE;
    const includeEmptyRows = options.includeEmptyRows ?? false;
    const trimValues = options.trimValues ?? true;
    const rows = groupItemsByRow(source.items, rowTolerance);

    return rows
        .map((row, index) => {
            const values = options.columns?.length
                ? rowToValuesByBoundaries(row.items, options.columns, trimValues)
                : rowToValuesByHeaders(row.items, options.headers, trimValues);

            return {
                rowIndex: index,
                pageNumber: row.pageNumber,
                values,
            } satisfies ExtractedPdfColumnRow;
        })
        .filter((row) => includeEmptyRows || Object.values(row.values).some(Boolean));
}

export function buildProjectUnitColumnObject(
    keyInput: ProjectUnitKeyInput,
    rowValues: Record<string, string>,
): ProjectUnitColumnObject {
    return {
        [createProjectUnitKey(keyInput)]: { ...rowValues },
    };
}

export function buildProjectUnitColumnObjectFromPdf(
    source: LayoutPdfTextSource,
    keyInput: ProjectUnitKeyInput,
    options: PdfColumnExtractionOptions = {},
): ProjectUnitColumnObject {
    const rows = extractPdfColumnRows(source, options);
    const firstRow = rows[0]?.values ?? {};
    return buildProjectUnitColumnObject(keyInput, firstRow);
}
