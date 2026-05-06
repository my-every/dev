import "server-only";

import { readDevicePartNumbersMap } from "@/lib/project-state/device-part-numbers-generator";
import { getPartByNumber, updatePart } from "@/lib/project-state/parts-library-handlers";
import type { SheetSchema } from "@/types/sheet-schema";
import type { PartRecord, PartTerminalDefinition, PartTerminalSchema } from "@/types/parts-library";

const DEFAULT_NEGATIVE_PATTERNS = ["COM", "COMMON", "0V", "0VDC", "DC-", "NEG", "NEGATIVE", "-"];

type ExtractedTerminalCandidate = {
  name: string;
  wireId?: string;
  size?: string;
  isNegative: boolean;
};

export type TerminalMetadata = {
  partNumber: string;
  terminal: string;
  side?: string;
  tier?: string;
  order?: number | null;
  isNegative?: boolean;
  polarityMode?: "fixed-negative" | "fixed-positive" | "either";
  wireId?: string;
  size?: string;
  hardware?: Record<string, string>;
  hardwareStackId?: string;
  instructions?: string[];
};

function normalizePartNumberToken(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(/[\n,;]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function parseDeviceId(deviceId: string | null | undefined) {
  const [baseId, terminal] = String(deviceId ?? "")
    .split(":")
    .map((value) => value.trim());

  return {
    baseId: (baseId || "").toUpperCase(),
    terminal: normalizeTerminalName(terminal),
  };
}

function normalizeTerminalName(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function getDevicePrefix(baseId: string): string {
  const match = baseId.match(/^([A-Z]+)/);
  return match?.[1] ?? baseId;
}

function isNegativeTerminalPattern(baseDeviceId: string, terminal: string): boolean {
  const normalizedTerminal = normalizeTerminalName(terminal);
  const prefix = getDevicePrefix(baseDeviceId);

  if (prefix === "AF" && normalizedTerminal === "COM") {
    return true;
  }

  if (DEFAULT_NEGATIVE_PATTERNS.includes(normalizedTerminal)) {
    return true;
  }

  return false;
}

function normalizeSignalToken(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function inferNegativeFromSignalContext(input: {
  wireNo?: string;
  wireId?: string;
  terminal?: string;
}): boolean | undefined {
  const wireNo = normalizeSignalToken(input.wireNo);
  const wireId = normalizeSignalToken(input.wireId);
  const terminal = normalizeSignalToken(input.terminal);
  const combined = `${wireNo} ${wireId} ${terminal}`;

  if (!combined.trim()) {
    return undefined;
  }

  if (/\(\s*-\s*\)/.test(combined)) return true;
  if (/(^|[^A-Z0-9])0V($|[^A-Z0-9])/.test(combined)) return true;
  if (/(^|[^A-Z0-9])DC-($|[^A-Z0-9])/.test(combined)) return true;
  if (/(^|[^A-Z0-9])NEG(ATIVE)?($|[^A-Z0-9])/.test(combined)) return true;
  if (/(^|[^A-Z0-9])[LP]?N($|[^A-Z0-9])/.test(terminal)) return true;

  if (/(^|[^A-Z0-9])24V($|[^A-Z0-9])/.test(combined)) return false;
  if (/(^|[^A-Z0-9])V\+($|[^A-Z0-9])/.test(combined)) return false;
  if (/(^|[^A-Z0-9])POS(ITIVE)?($|[^A-Z0-9])/.test(combined)) return false;

  return undefined;
}

function mergeTerminalDefinition(
  existing: PartTerminalDefinition | undefined,
  candidate: ExtractedTerminalCandidate,
): PartTerminalDefinition {
  const existingPolarity = existing?.polarityMode;
  const derivedPolarity =
    existingPolarity
    ?? (typeof existing?.isNegative === "boolean"
      ? (existing.isNegative ? "fixed-negative" : "fixed-positive")
      : undefined);
  return {
    name: candidate.name,
    aliases: existing?.aliases ?? [],
    wireId: existing?.wireId ?? candidate.wireId ?? "",
    size: existing?.size ?? candidate.size ?? "",
    side: existing?.side,
    tier: existing?.tier,
    order: existing?.order ?? null,
    isNegative: typeof existing?.isNegative === "boolean" ? existing.isNegative : candidate.isNegative,
    polarityMode: derivedPolarity,
    instructions: existing?.instructions ?? [],
    hardware: existing?.hardware ?? {},
    hardwareStackId: existing?.hardwareStackId,
  };
}

function mergeTerminalSchema(existing: PartTerminalSchema | undefined, candidates: Map<string, ExtractedTerminalCandidate>): PartTerminalSchema {
  const existingMap = new Map(
    (existing?.terminals ?? []).map((terminal) => [normalizeTerminalName(terminal.name), terminal]),
  );

  for (const [terminalName, candidate] of candidates) {
    existingMap.set(terminalName, mergeTerminalDefinition(existingMap.get(terminalName), candidate));
  }

  const negativePatterns = Array.from(
    new Set([...(existing?.negativePatterns ?? []), ...DEFAULT_NEGATIVE_PATTERNS]),
  ).sort();

  return {
    terminals: Array.from(existingMap.values()).sort((left, right) => {
      const orderDelta = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      const tierCompare = String(left.tier ?? "").localeCompare(String(right.tier ?? ""), undefined, { numeric: true });
      if (tierCompare !== 0) {
        return tierCompare;
      }

      return left.name.localeCompare(right.name, undefined, { numeric: true });
    }),
    negativePatterns,
    updatedAt: new Date().toISOString(),
  };
}

export async function syncExtractedPartTerminalSchemas(options: {
  projectRoot: string;
  sheetSchemas: SheetSchema[];
}): Promise<{ updatedParts: string[] }> {
  const map = await readDevicePartNumbersMap(options.projectRoot);
  if (!map?.devices) {
    return { updatedParts: [] };
  }

  const partCandidates = new Map<string, Map<string, ExtractedTerminalCandidate>>();

  const observeTerminal = (
    deviceId: string | null | undefined,
    wireId: string | null | undefined,
    size: string | null | undefined,
  ) => {
    const parsed = parseDeviceId(deviceId);
    if (!parsed.baseId || !parsed.terminal) {
      return;
    }

    const partEntry = map.devices[parsed.baseId];
    if (!partEntry?.partNumber) {
      return;
    }

    for (const partNumber of normalizePartNumberToken(partEntry.partNumber)) {
      const terminalMap = partCandidates.get(partNumber) ?? new Map<string, ExtractedTerminalCandidate>();
      const existing = terminalMap.get(parsed.terminal);

      terminalMap.set(parsed.terminal, {
        name: parsed.terminal,
        wireId: existing?.wireId ?? (String(wireId ?? "").trim().toUpperCase() || undefined),
        size: existing?.size ?? (String(size ?? "").trim() || undefined),
        isNegative: existing?.isNegative ?? isNegativeTerminalPattern(parsed.baseId, parsed.terminal),
      });
      partCandidates.set(partNumber, terminalMap);
    }
  };

  for (const sheetSchema of options.sheetSchemas) {
    if (sheetSchema.kind !== "operational") {
      continue;
    }

    for (const row of sheetSchema.rows ?? []) {
      observeTerminal(row.fromDeviceId, row.wireId, row.gaugeSize);
      observeTerminal(row.toDeviceId, row.wireId, row.gaugeSize);
    }
  }

  const updatedParts: string[] = [];

  for (const [partNumber, candidates] of partCandidates) {
    const part = await getPartByNumber(partNumber);
    if (!part) {
      continue;
    }

    const nextTerminalSchema = mergeTerminalSchema(part.terminalSchema, candidates);
    const samePayload = JSON.stringify(part.terminalSchema ?? null) === JSON.stringify(nextTerminalSchema);
    if (samePayload) {
      continue;
    }

    await updatePart({
      ...part,
      terminalSchema: nextTerminalSchema,
    });
    updatedParts.push(partNumber);
  }

  return { updatedParts };
}

export async function createProjectPartTerminalResolver(
  projectRoot: string,
): Promise<
  (
    input:
      | string
      | {
          deviceId?: string;
          wireNo?: string;
          wireId?: string;
        },
  ) => TerminalMetadata | null
> {
  const map = await readDevicePartNumbersMap(projectRoot);
  const partCache = new Map<string, PartRecord | null>();

  const uniquePartNumbers = new Set<string>();
  for (const entry of Object.values(map?.devices ?? {})) {
    for (const partNumber of normalizePartNumberToken(entry.partNumber)) {
      uniquePartNumbers.add(partNumber);
    }
  }

  await Promise.all(
    Array.from(uniquePartNumbers).map(async (partNumber) => {
      partCache.set(partNumber, await getPartByNumber(partNumber));
    }),
  );

  return (input) => {
    const deviceId = typeof input === "string" ? input : input?.deviceId;
    const wireNo = typeof input === "string" ? undefined : input?.wireNo;
    const wireId = typeof input === "string" ? undefined : input?.wireId;
    const parsed = parseDeviceId(deviceId);
    if (!parsed.baseId || !parsed.terminal || !map?.devices?.[parsed.baseId]?.partNumber) {
      return null;
    }

    for (const partNumber of normalizePartNumberToken(map.devices[parsed.baseId].partNumber)) {
      const part = partCache.get(partNumber) ?? null;
      const terminal = (part?.terminalSchema?.terminals ?? []).find((item) => {
        if (normalizeTerminalName(item.name) === parsed.terminal) {
          return true;
        }

        return (item.aliases ?? []).some((alias) => normalizeTerminalName(alias) === parsed.terminal);
      });

      if (terminal) {
        const explicitPolarity = terminal.polarityMode
          ?? (typeof terminal.isNegative === "boolean"
            ? (terminal.isNegative ? "fixed-negative" : "fixed-positive")
            : undefined);
        const inferred = inferNegativeFromSignalContext({
          wireNo,
          wireId,
          terminal: parsed.terminal,
        });
        const resolvedIsNegative =
          explicitPolarity === "fixed-negative"
            ? true
            : explicitPolarity === "fixed-positive"
              ? false
              : explicitPolarity === "either"
                ? inferred
                : (typeof terminal.isNegative === "boolean" ? terminal.isNegative : inferred);
        return {
          partNumber,
          terminal: parsed.terminal,
          side: terminal.side,
          tier: terminal.tier,
          order: terminal.order ?? null,
          isNegative: resolvedIsNegative,
          polarityMode: explicitPolarity,
          wireId: terminal.wireId,
          size: terminal.size,
          hardware: terminal.hardware,
          hardwareStackId: terminal.hardwareStackId,
          instructions: terminal.instructions,
        };
      }
    }

    const fallbackNegative = isNegativeTerminalPattern(parsed.baseId, parsed.terminal);
    const inferred = inferNegativeFromSignalContext({
      wireNo,
      wireId,
      terminal: parsed.terminal,
    });
    const isNegative = typeof inferred === "boolean" ? inferred : fallbackNegative;
    if (typeof isNegative !== "boolean" || !isNegative) {
      return null;
    }

    return {
      partNumber: normalizePartNumberToken(map.devices[parsed.baseId].partNumber)[0] ?? "",
      terminal: parsed.terminal,
      wireId: undefined,
      size: undefined,
      isNegative: true,
    };
  };
}

export function applyNegativeWireMarker(wireNo: string, isNegative: boolean): string {
  const normalized = String(wireNo ?? "").trim();
  if (!normalized || !isNegative) {
    return normalized;
  }

  return normalized.startsWith("-") ? normalized : `-${normalized}`;
}
