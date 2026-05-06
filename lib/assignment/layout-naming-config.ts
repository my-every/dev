/**
 * Layout Naming Config
 *
 * A portable, exportable map that normalizes inconsistent PDF layout page
 * titles to stable assignment names. The config is keyed by the raw
 * extracted title and maps to a user-chosen normalized name.
 *
 * Example:
 *   "CONTROL,JB70;TT6" → "CONTROL A"
 *   "F&G EDIO ONSK"    → "F&G EDIO ONSK"
 *   "XTFGJB5"          → "PNL,PROBE DRIVER"
 */

export interface LayoutNamingConfig {
  /** Incremented when the config is modified */
  version: number
  /** Map of raw PDF title → normalized display name */
  entries: Record<string, string>
}

/** Build a fresh empty config */
export function createEmptyNamingConfig(): LayoutNamingConfig {
  return { version: 1, entries: {} }
}

/**
 * Resolve a layout page title through the naming config.
 * Returns the normalized name if present, otherwise the raw title.
 */
export function resolveLayoutTitle(
  rawTitle: string | undefined,
  config: LayoutNamingConfig | null,
): string {
  if (!rawTitle) return ''
  if (!config) return rawTitle
  return config.entries[rawTitle] ?? rawTitle
}

/**
 * Build a naming config from the current set of mappings.
 * Each mapping whose matchedLayoutTitle differs from its sheetName
 * produces an entry mapping raw PDF title → sheet name.
 */
export function buildNamingConfigFromMappings(
  mappings: { sheetName: string; matchedLayoutTitle?: string }[],
): LayoutNamingConfig {
  const entries: Record<string, string> = {}

  for (const m of mappings) {
    const raw = m.matchedLayoutTitle
    if (!raw) continue
    // Only record when the raw title differs from the sheet name
    if (raw !== m.sheetName) {
      entries[raw] = m.sheetName
    }
  }

  return { version: 1, entries }
}

/** Serialise to JSON for export / download */
export function exportNamingConfig(config: LayoutNamingConfig): string {
  return JSON.stringify(config, null, 2)
}

/** Deserialise from JSON (import / upload) */
export function importNamingConfig(json: string): LayoutNamingConfig {
  const parsed = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object' || !parsed.entries) {
    throw new Error('Invalid naming config format')
  }
  return {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    entries: parsed.entries as Record<string, string>,
  }
}
