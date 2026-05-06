"use client";

/**
 * useWiringDocument Hook
 *
 * Fetches the wire list print document data (location groups, settings, rows)
 * for a given project sheet. Used by the wiring stage on the assignment page
 * to provide data to WiringExecutionMode.
 */

import { useState, useEffect, useCallback } from "react";
import type { PrintLocationGroup } from "@/lib/wire-list-print/model";
import type { PrintSettings } from "@/lib/wire-list-print/defaults";
import type { SemanticWireListRow } from "@/lib/workbook/types";

export interface WiringDocumentData {
    processedLocationGroups: PrintLocationGroup[];
    settings: PrintSettings;
    currentSheetName: string;
    hiddenSectionKeys: string[];
    hiddenRowIds: string[];
    crossWireSectionKeys: string[];
}

export interface UseWiringDocumentReturn {
    data: WiringDocumentData | null;
    rows: SemanticWireListRow[];
    rowMap: Map<string, SemanticWireListRow>;
    isLoading: boolean;
    error: string | null;
    reload: () => void;
}

export function useWiringDocument(
    projectId: string | null,
    sheetSlug: string | null,
): UseWiringDocumentReturn {
    const [data, setData] = useState<WiringDocumentData | null>(null);
    const [rows, setRows] = useState<SemanticWireListRow[]>([]);
    const [rowMap, setRowMap] = useState<Map<string, SemanticWireListRow>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!projectId || !sheetSlug) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch document data and sheet schema in parallel
            const [docRes, schemaRes] = await Promise.all([
                fetch(`/api/projects/${encodeURIComponent(projectId)}/wiring-document?sheet=${encodeURIComponent(sheetSlug)}`),
                fetch(`/api/projects/${encodeURIComponent(projectId)}/sheets/${encodeURIComponent(sheetSlug)}`),
            ]);

            if (!docRes.ok) {
                const body = await docRes.json().catch(() => ({}));
                throw new Error(body.error || "Failed to load wiring document");
            }

            const docData = await docRes.json() as WiringDocumentData;
            setData(docData);

            // Build row map from schema rows
            if (schemaRes.ok) {
                const schemaPayload = await schemaRes.json() as { schema?: { rows?: SemanticWireListRow[] } };
                const schemaRows = schemaPayload.schema?.rows ?? [];
                setRows(schemaRows);
                setRowMap(new Map(schemaRows.map(r => [r.__rowId, r])));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load wiring document");
        } finally {
            setIsLoading(false);
        }
    }, [projectId, sheetSlug]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    return {
        data,
        rows,
        rowMap,
        isLoading,
        error,
        reload: fetchData,
    };
}
