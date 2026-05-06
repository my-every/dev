import type { PartNumberLookupResult } from "@/lib/part-number-list";

import type { PatternExtractionContext } from "./types";
import { getBaseDeviceId } from "./device-parser";

const MECHANICAL_RELAY_PART_NUMBERS = new Set(["1061979-1", "1061979-2"]);

function normalizePartNumberToken(value: string): string {
  return value.trim().toUpperCase();
}

function splitPartNumberTokens(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((entry) => normalizePartNumberToken(entry))
    .filter((entry) => entry.length > 0 && entry !== "PART OF ASSEMBLY");
}

function getDevicePartNumberEntry(
  deviceId: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null | undefined,
): PartNumberLookupResult | undefined {
  if (!partNumberMap || partNumberMap.size === 0) return undefined;
  return partNumberMap.get(getBaseDeviceId(deviceId).toUpperCase());
}

export function getDevicePartNumberTokens(
  deviceId: string,
  context: PatternExtractionContext,
): string[] {
  const entry = getDevicePartNumberEntry(deviceId, context.partNumberMap);
  if (!entry?.partNumber) return [];
  return splitPartNumberTokens(entry.partNumber);
}

export function hasMechanicalRelayPartNumber(
  deviceId: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null | undefined,
): boolean {
  const entry = getDevicePartNumberEntry(deviceId, partNumberMap);
  if (!entry?.partNumber) {
    return false;
  }

  return splitPartNumberTokens(entry.partNumber).some((token) => MECHANICAL_RELAY_PART_NUMBERS.has(token));
}

export function isMechanicalRelayFamilyDevice(
  deviceId: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null | undefined,
): boolean {
  if (partNumberMap && partNumberMap.size > 0) {
    return hasMechanicalRelayPartNumber(deviceId, partNumberMap);
  }

  return getBaseDeviceId(deviceId).toUpperCase().startsWith("KA");
}

export function haveCompatibleJumperPartNumbers(
  fromDeviceId: string,
  toDeviceId: string,
  context: PatternExtractionContext,
): boolean {
  const partNumberMap = context.partNumberMap;

  if (!partNumberMap || partNumberMap.size === 0) {
    return true;
  }

  const fromTokens = getDevicePartNumberTokens(fromDeviceId, context);
  const toTokens = getDevicePartNumberTokens(toDeviceId, context);

  if (fromTokens.length === 0 || toTokens.length === 0) {
    return false;
  }

  return fromTokens.some((token) => toTokens.includes(token));
}

export function isAllowedMechanicalRelayPartNumber(
  deviceId: string,
  context: PatternExtractionContext,
): boolean {
  const partNumberMap = context.partNumberMap;

  if (!partNumberMap || partNumberMap.size === 0) {
    return true;
  }

  return hasMechanicalRelayPartNumber(deviceId, partNumberMap);
}