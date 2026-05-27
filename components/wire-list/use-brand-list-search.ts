"use client";

import { useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { BrandListExportSchema, BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import type {
  BrandListColumnKey,
  BrandListReplacePreview,
  BrandListSearchMatch,
  BrandListSearchOptions,
} from "@/lib/wire-brand-list/editor-types";

export const SEARCH_COLUMN_LABELS: Record<BrandListColumnKey, string> = {
  fromDeviceId: "From Device",
  wireNo: "Wire No.",
  wireId: "Wire ID",
  gaugeSize: "Gauge",
  length: "Length",
  toDeviceId: "To Device",
  toLocation: "To Location",
  bundleDisplay: "Bundle Display",
};

const ALL_COLUMNS: BrandListColumnKey[] = [
  "fromDeviceId",
  "wireNo",
  "wireId",
  "gaugeSize",
  "length",
  "toDeviceId",
  "toLocation",
  "bundleDisplay",
];

// Readonly columns that must never be replaced
const READONLY_COLUMNS = new Set<BrandListColumnKey>([]);

function getRowValue(row: BrandListSchemaRow, column: BrandListColumnKey): string {
  const raw = row[column as keyof BrandListSchemaRow];
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function matchCell(
  cellValue: string,
  query: string,
  options: Pick<BrandListSearchOptions, "matchCase" | "matchWholeCell">,
): { matchStart: number; matchEnd: number } | null {
  if (!query) return null;
  const haystack = options.matchCase ? cellValue : cellValue.toLowerCase();
  const needle = options.matchCase ? query : query.toLowerCase();
  if (options.matchWholeCell) {
    return haystack === needle ? { matchStart: 0, matchEnd: cellValue.length } : null;
  }
  const idx = haystack.indexOf(needle);
  if (idx === -1) return null;
  return { matchStart: idx, matchEnd: idx + needle.length };
}

export function buildSearchMatches(
  schemas: Array<{ slug: string; name: string; schema: BrandListExportSchema }>,
  options: BrandListSearchOptions,
  visibleColumns: BrandListColumnKey[],
): BrandListSearchMatch[] {
  if (!options.query.trim()) return [];
  const columnsToSearch = options.visibleColumnsOnly ? visibleColumns : ALL_COLUMNS;
  const matches: BrandListSearchMatch[] = [];

  for (const { slug, name, schema } of schemas) {
    for (let pi = 0; pi < schema.prefixGroups.length; pi++) {
      const prefixGroup = schema.prefixGroups[pi];
      for (let bi = 0; bi < prefixGroup.bundles.length; bi++) {
        const bundle = prefixGroup.bundles[bi];
        for (let ri = 0; ri < bundle.rows.length; ri++) {
          const row = bundle.rows[ri];
          for (const col of columnsToSearch) {
            const cellValue = getRowValue(row, col);
            const hit = matchCell(cellValue, options.query, options);
            if (hit) {
              matches.push({
                id: uuidv4(),
                sheetSlug: slug,
                sheetName: name,
                prefixIndex: pi,
                bundleIndex: bi,
                rowIndex: ri,
                rowId: row.rowId,
                column: col,
                columnLabel: SEARCH_COLUMN_LABELS[col],
                cellValue,
                matchStart: hit.matchStart,
                matchEnd: hit.matchEnd,
              });
            }
          }
        }
      }
    }
  }
  return matches;
}

export function buildReplacePreview(
  matches: BrandListSearchMatch[],
  replaceWith: string,
  matchCase: boolean,
  matchWholeCell: boolean,
): BrandListReplacePreview[] {
  return matches.map((match) => {
    if (READONLY_COLUMNS.has(match.column)) {
      return {
        match,
        previousValue: match.cellValue,
        nextValue: match.cellValue,
        status: "blocked",
      };
    }
    let nextValue: string;
    if (matchWholeCell) {
      nextValue = replaceWith;
    } else {
      const haystack = matchCase ? match.cellValue : match.cellValue.toLowerCase();
      const needle = matchCase ? match.cellValue.slice(match.matchStart, match.matchEnd) : match.cellValue.slice(match.matchStart, match.matchEnd);
      void haystack;
      void needle;
      nextValue =
        match.cellValue.slice(0, match.matchStart) +
        replaceWith +
        match.cellValue.slice(match.matchEnd);
    }
    return {
      match,
      previousValue: match.cellValue,
      nextValue,
      status: nextValue === match.cellValue ? "unchanged" : "safe",
    };
  });
}

export interface UseBrandListSearchReturn {
  searchOpen: boolean;
  replaceOpen: boolean;
  searchOptions: BrandListSearchOptions;
  matches: BrandListSearchMatch[];
  activeMatchIndex: number;
  activeMatch: BrandListSearchMatch | null;
  replaceWith: string;
  replacePreviews: BrandListReplacePreview[];
  openSearch: () => void;
  openReplace: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  setMatchCase: (v: boolean) => void;
  setMatchWholeCell: (v: boolean) => void;
  setScope: (scope: BrandListSearchOptions["scope"]) => void;
  setVisibleColumnsOnly: (v: boolean) => void;
  setReplaceWith: (v: string) => void;
  goToNextMatch: () => void;
  goToPreviousMatch: () => void;
  goToMatch: (index: number) => void;
}

export function useBrandListSearch(
  schemas: Array<{ slug: string; name: string; schema: BrandListExportSchema }>,
  activeSheetSlug: string | null,
  visibleColumns: BrandListColumnKey[],
): UseBrandListSearchReturn {
  const [searchOpen, setSearchOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceWith, setReplaceWith] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [searchOptions, setSearchOptions] = useState<BrandListSearchOptions>({
    query: "",
    matchCase: false,
    matchWholeCell: false,
    scope: "current-sheet",
    visibleColumnsOnly: false,
  });

  const filteredSchemas = useMemo(() => {
    if (searchOptions.scope === "current-sheet") {
      return schemas.filter((s) => s.slug === activeSheetSlug);
    }
    return schemas;
  }, [schemas, searchOptions.scope, activeSheetSlug]);

  const matches = useMemo(
    () => buildSearchMatches(filteredSchemas, searchOptions, visibleColumns),
    [filteredSchemas, searchOptions, visibleColumns],
  );

  const replacePreviews = useMemo(
    () => buildReplacePreview(matches, replaceWith, searchOptions.matchCase, searchOptions.matchWholeCell),
    [matches, replaceWith, searchOptions.matchCase, searchOptions.matchWholeCell],
  );

  const safeActiveIndex = matches.length === 0 ? 0 : ((activeMatchIndex % matches.length) + matches.length) % matches.length;
  const activeMatch = matches[safeActiveIndex] ?? null;

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setReplaceOpen(false);
  }, []);

  const openReplace = useCallback(() => {
    setSearchOpen(true);
    setReplaceOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setReplaceOpen(false);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchOptions((prev) => ({ ...prev, query }));
    setActiveMatchIndex(0);
  }, []);

  const setMatchCase = useCallback((v: boolean) => {
    setSearchOptions((prev) => ({ ...prev, matchCase: v }));
    setActiveMatchIndex(0);
  }, []);

  const setMatchWholeCell = useCallback((v: boolean) => {
    setSearchOptions((prev) => ({ ...prev, matchWholeCell: v }));
    setActiveMatchIndex(0);
  }, []);

  const setScope = useCallback((scope: BrandListSearchOptions["scope"]) => {
    setSearchOptions((prev) => ({ ...prev, scope }));
    setActiveMatchIndex(0);
  }, []);

  const setVisibleColumnsOnly = useCallback((v: boolean) => {
    setSearchOptions((prev) => ({ ...prev, visibleColumnsOnly: v }));
    setActiveMatchIndex(0);
  }, []);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const goToPreviousMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => ((prev - 1) + matches.length) % matches.length);
  }, [matches.length]);

  const goToMatch = useCallback((index: number) => {
    setActiveMatchIndex(index);
  }, []);

  return {
    searchOpen,
    replaceOpen,
    searchOptions,
    matches,
    activeMatchIndex: safeActiveIndex,
    activeMatch,
    replaceWith,
    replacePreviews,
    openSearch,
    openReplace,
    closeSearch,
    setSearchQuery,
    setMatchCase,
    setMatchWholeCell,
    setScope,
    setVisibleColumnsOnly,
    setReplaceWith,
    goToNextMatch,
    goToPreviousMatch,
    goToMatch,
  };
}
