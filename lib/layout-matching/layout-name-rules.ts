/**
 * Domain-aware rules for normalizing and classifying layout titles and sheet names.
 * 
 * This module provides the core classification logic for matching layout PDF pages
 * to wire-list sheets by understanding structural categories, JB identifiers, and
 * side information.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Canonical area types for layout matching.
 */
export type AreaType =
  | "rail"
  | "panel"
  | "door"
  | "control"
  | "plc"
  | "prox"
  | "fandg"
  | "fandg_edio" // F&G EDIO ONSK - specific F&G variant
  | "fandg_pwr"  // F&G PWR ONSK - specific F&G variant
  | "hmi"
  | "power"
  | "bop"
  | "hpc"
  | "vio"
  | "mcc"
  | "tcp"
  | "gen"
  | "conv"
  | "vfd"
  | "fo_conv"    // FO CONV (Fiber Optic Converter)
  | "unknown";

/**
 * Side classification for rail/panel layouts.
 */
export type SideType = "left" | "right" | null;

/**
 * Normalized layout name classification.
 */
export interface NormalizedLayoutName {
  /** Original raw string */
  raw: string;
  /** Normalized string (lowercase, cleaned) */
  normalized: string;
  /** Extracted JB identifier (e.g., "JB74") */
  jbId: string | null;
  /** Side classification */
  side: SideType;
  /** Primary area type */
  areaType: AreaType;
  /** Secondary area type (for compound names like "F&G POWER") */
  secondaryAreaType: AreaType | null;
  /** Extracted structural tokens */
  tokens: string[];
  /** Function-specific tokens (non-structural) */
  functionTokens: string[];
  /** All aliases and expanded forms */
  aliases: string[];
}

// ============================================================================
// Token Aliases
// ============================================================================

/**
 * Canonical token aliases for normalization.
 * Maps various spellings/abbreviations to canonical forms.
 */
export const TOKEN_ALIASES: Record<string, string | string[]> = {
  // Control synonyms
  "ctrl": "control",
  "cntrl": "control",
  "ctl": "control",
  
  // Power synonyms
  "pwr": "power",
  "pow": "power",
  
  // F&G synonyms
  "f&g": "fandg",
  "fg": "fandg",
  "fge": "fandg",
  "fire gas": "fandg",
  "fire & gas": "fandg",
  "fire and gas": "fandg",
  
  // HMI synonyms
  "hmi-s": "hmi",
  "hmis": "hmi",
  
  // Prox synonyms
  "proximity": "prox",
  
  // Panel synonyms
  "pnl": "panel",
  "pn": "panel",
  
  // Door synonyms
  "dr": "door",
  "drawer": "door",
  
  // Rail compound phrases
  "right side rail": ["rail", "right"],
  "left side rail": ["rail", "left"],
  "railright": ["rail", "right"],
  "railleft": ["rail", "left"],
  "right rail": ["rail", "right"],
  "left rail": ["rail", "left"],
  "rail right": ["rail", "right"],
  "rail left": ["rail", "left"],
  
  // BOP synonyms
  "bottom of panel": "bop",
  
  // VFD synonyms
  "variable frequency": "vfd",
  "variable freq": "vfd",
  
  // Converter synonyms
  "converter": "conv",
  "convvfd": ["conv", "vfd"],
  
  // ONSK is a location/function identifier
  "onsk": "onsk",
};

/**
 * Phrase replacements for multi-word normalization.
 * Applied before tokenization.
 */
export const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Rail phrases
  [/right\s+side\s+rail/gi, "rail right"],
  [/left\s+side\s+rail/gi, "rail left"],
  [/rail\s*,?\s*right/gi, "rail right"],
  [/rail\s*,?\s*left/gi, "rail left"],
  
  // F&G phrases
  [/fire\s*&?\s*gas/gi, "fandg"],
  [/f\s*&\s*g/gi, "fandg"],
  
  // HMI phrases
  [/hmi[\-\s]*s/gi, "hmi"],
  
  // BOP phrases
  [/bottom\s+of\s+panel/gi, "bop"],
];

// ============================================================================
// Area Type Detection
// ============================================================================

/**
 * Keywords that indicate specific area types.
 * Order matters - first match wins for primary classification.
 */
export const AREA_TYPE_KEYWORDS: Array<{ pattern: RegExp; type: AreaType; priority: number }> = [
  // Rail must come first - it's very specific
  { pattern: /\brail\b/i, type: "rail", priority: 100 },
  
  // Door/panel door
  { pattern: /\bdoor\b/i, type: "door", priority: 95 },
  
  // PLC
  { pattern: /\bplc\b/i, type: "plc", priority: 90 },
  
  // Prox/HPC
  { pattern: /\bprox\b/i, type: "prox", priority: 85 },
  { pattern: /\bhpc\b/i, type: "hpc", priority: 85 },
  
  // F&G - specific variants first (higher priority)
  { pattern: /\bf\s*&\s*g\s+edio/i, type: "fandg_edio", priority: 82 },
  { pattern: /\bf\s*&\s*g\s+pwr/i, type: "fandg_pwr", priority: 82 },
  { pattern: /\bfandg\b/i, type: "fandg", priority: 80 },
  { pattern: /\bf\s*&\s*g\b/i, type: "fandg", priority: 80 },
  
  // HMI
  { pattern: /\bhmi\b/i, type: "hmi", priority: 75 },
  
  // BOP
  { pattern: /\bbop\b/i, type: "bop", priority: 70 },
  
  // Control (after more specific types)
  { pattern: /\bcontrol\b/i, type: "control", priority: 60 },
  { pattern: /\bctrl\b/i, type: "control", priority: 60 },
  
  // Power
  { pattern: /\bpower\b/i, type: "power", priority: 55 },
  { pattern: /\bpwr\b/i, type: "power", priority: 55 },
  
  // VFD/Conv - FO CONV first (higher priority)
  { pattern: /\bfo\s+conv\b/i, type: "fo_conv", priority: 52 },
  { pattern: /\bvfd\b/i, type: "vfd", priority: 50 },
  { pattern: /\bconv\b/i, type: "conv", priority: 50 },
  
  // MCC
  { pattern: /\bmcc\b/i, type: "mcc", priority: 45 },
  
  // TCP
  { pattern: /\btcp\b/i, type: "tcp", priority: 40 },
  
  // Gen
  { pattern: /\bgen\b/i, type: "gen", priority: 35 },
  
  // VIO
  { pattern: /\bvio\b/i, type: "vio", priority: 30 },
  
  // Generic panel (lowest priority)
  { pattern: /\bpanel\b/i, type: "panel", priority: 10 },
  { pattern: /\bpnl\b/i, type: "panel", priority: 10 },
];

/**
 * Side detection patterns.
 */
export const SIDE_PATTERNS: Array<{ pattern: RegExp; side: SideType }> = [
  { pattern: /\bright\b/i, side: "right" },
  { pattern: /\bleft\b/i, side: "left" },
  { pattern: /\b[rl]\s*side\b/i, side: null }, // Will be refined
];

/**
 * JB extraction pattern.
 */
export const JB_PATTERN = /\bJB\s*(\d+)/i;

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Clean and normalize text for matching.
 */
export function cleanText(text: string): string {
  let result = text.toUpperCase();
  
  // Replace punctuation with spaces
  result = result.replace(/[,\-_:;\.]+/g, " ");
  
  // Collapse multiple spaces
  result = result.replace(/\s+/g, " ");
  
  return result.trim().toLowerCase();
}

/**
 * Apply phrase replacements before tokenization.
 */
export function applyPhraseReplacements(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Extract JB identifier from text.
 */
export function extractJbId(text: string): string | null {
  const match = text.match(JB_PATTERN);
  return match ? `JB${match[1]}` : null;
}

/**
 * Strip JB suffix and other trailing identifiers from a name.
 * "CONTROL A,JB70" => "CONTROL A"
 * "BOP CTRL,JB74" => "BOP CTRL"
 * "RAIL,RIGHT,JB70" => "RAIL,RIGHT" OR "RAIL RIGHT"
 */
export function stripJbSuffix(text: string): string {
  // Remove JB suffix patterns: ,JB70 or ;JB70 or -JB70 or JB70 at end
  let result = text.replace(/[,;\-\s]*JB\s*\d+\s*$/i, "").trim();
  // Also remove TT suffix: ;TT6 or ,TT6
  result = result.replace(/[,;\-\s]*TT\s*\d+\s*$/i, "").trim();
  return result;
}

/**
 * Extract the core name from a layout title, stripping JB/TT suffixes.
 * This is useful for comparing sheet names that don't include the JB suffix.
 */
export function extractCoreName(text: string): string {
  return cleanText(stripJbSuffix(text));
}

/**
 * Extract side information from text.
 */
export function extractSide(text: string): SideType {
  const upper = text.toUpperCase();
  
  if (/\bright\b/i.test(upper)) return "right";
  if (/\bleft\b/i.test(upper)) return "left";
  
  // Check for R/L abbreviations in specific contexts
  if (/\b[rl]\s+side\b/i.test(upper)) {
    return /\br\s+side\b/i.test(upper) ? "right" : "left";
  }
  
  return null;
}

/**
 * Detect area type from text.
 * Returns primary and optionally secondary area type.
 */
export function detectAreaTypes(text: string): { primary: AreaType; secondary: AreaType | null } {
  const normalized = cleanText(applyPhraseReplacements(text));
  
  const matches: Array<{ type: AreaType; priority: number }> = [];
  
  for (const { pattern, type, priority } of AREA_TYPE_KEYWORDS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      matches.push({ type, priority });
    }
  }
  
  // Sort by priority descending
  matches.sort((a, b) => b.priority - a.priority);
  
  if (matches.length === 0) {
    return { primary: "unknown", secondary: null };
  }
  
  return {
    primary: matches[0].type,
    secondary: matches.length > 1 ? matches[1].type : null,
  };
}

/**
 * Tokenize text into structural and function tokens.
 */
export function tokenize(text: string): { structural: string[]; functional: string[] } {
  const normalized = cleanText(applyPhraseReplacements(text));
  const words = normalized.split(" ").filter(w => w.length > 0);
  
  const structural: string[] = [];
  const functional: string[] = [];
  
  // Structural keywords
  const structuralKeywords = new Set([
    "rail", "door", "panel", "pnl", "control", "ctrl", "plc", "prox",
    "fandg", "hmi", "power", "pwr", "bop", "hpc", "vio", "mcc", "tcp",
    "gen", "vfd", "conv", "left", "right",
  ]);
  
  // Stop words to ignore
  const stopWords = new Set(["the", "and", "of", "for", "to", "a", "an", "in", "on"]);
  
  for (const word of words) {
    // Apply aliases
    const alias = TOKEN_ALIASES[word];
    const expanded = alias
      ? Array.isArray(alias) ? alias : [alias]
      : [word];
    
    for (const token of expanded) {
      if (stopWords.has(token)) continue;
      
      if (structuralKeywords.has(token)) {
        if (!structural.includes(token)) structural.push(token);
      } else {
        if (!functional.includes(token)) functional.push(token);
      }
    }
  }
  
  return { structural, functional };
}

/**
 * Create a fully normalized layout name classification.
 */
export function normalizeLayoutName(text: string): NormalizedLayoutName {
  const raw = text;
  const cleaned = cleanText(applyPhraseReplacements(text));
  const jbId = extractJbId(text);
  const side = extractSide(text);
  const { primary, secondary } = detectAreaTypes(text);
  const { structural, functional } = tokenize(text);
  
  // Build aliases list
  const aliases: string[] = [cleaned];
  if (jbId) aliases.push(jbId.toLowerCase());
  if (side) aliases.push(side);
  aliases.push(...structural);
  
  return {
    raw,
    normalized: cleaned,
    jbId,
    side,
    areaType: primary,
    secondaryAreaType: secondary,
    tokens: structural,
    functionTokens: functional,
    aliases: [...new Set(aliases)],
  };
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Area types that are mutually exclusive - matching these incorrectly is a strong signal.
 * CRITICAL: Even if two layouts share the same JB identifier, they are different panels
 * if they have different area types (e.g., "HPC CTRL,JB73" is NOT "RAIL,RIGHT,JB73").
 */
export const MUTUALLY_EXCLUSIVE_AREAS: Array<[AreaType, AreaType[]]> = [
  // Rails are exclusive from most other types
  ["rail", ["control", "plc", "door", "panel", "fandg", "fandg_edio", "fandg_pwr", "hmi", "bop", "hpc", "prox", "conv", "vfd", "tcp", "gen", "mcc", "fo_conv"]],
  // Doors are exclusive from many types
  ["door", ["rail", "plc", "fandg", "fandg_edio", "fandg_pwr", "hmi", "hpc", "prox", "conv", "vfd", "fo_conv"]],
  // PLC is exclusive from most types
  ["plc", ["rail", "door", "fandg", "fandg_edio", "fandg_pwr", "hmi", "control", "prox", "conv", "vfd", "tcp", "fo_conv"]],
  // F&G variants are mutually exclusive with each other and most other types
  ["fandg", ["plc", "hmi", "rail", "door", "hpc", "prox", "conv", "vfd", "tcp", "control", "fo_conv"]],
  ["fandg_edio", ["fandg_pwr", "plc", "hmi", "rail", "door", "hpc", "prox", "conv", "vfd", "tcp", "control", "fo_conv"]],
  ["fandg_pwr", ["fandg_edio", "plc", "hmi", "rail", "door", "hpc", "prox", "conv", "vfd", "tcp", "control", "fo_conv"]],
  // HMI is exclusive from most
  ["hmi", ["plc", "fandg", "fandg_edio", "fandg_pwr", "rail", "door", "hpc", "prox", "conv", "vfd", "fo_conv"]],
  // Control panels are exclusive from rails and specific systems
  ["control", ["rail", "plc", "fandg", "fandg_edio", "fandg_pwr", "conv", "vfd", "fo_conv"]],
  // HPC (High Power Control) is exclusive from many
  ["hpc", ["rail", "door", "fandg", "fandg_edio", "fandg_pwr", "hmi", "prox", "conv", "vfd", "fo_conv"]],
  // Prox (Proximity/Vibration) is exclusive
  ["prox", ["rail", "door", "plc", "fandg", "fandg_edio", "fandg_pwr", "hmi", "hpc", "conv", "vfd", "fo_conv"]],
  // Conv/VFD are exclusive from most
  ["conv", ["rail", "door", "plc", "fandg", "fandg_edio", "fandg_pwr", "hmi", "hpc", "prox", "control"]],
  ["vfd", ["rail", "door", "plc", "fandg", "fandg_edio", "fandg_pwr", "hmi", "hpc", "prox", "control"]],
  // FO CONV is exclusive from most
  ["fo_conv", ["rail", "door", "plc", "fandg", "fandg_edio", "fandg_pwr", "hmi", "hpc", "prox", "control"]],
];

/**
 * Check if two area types conflict.
 */
export function hasAreaTypeConflict(type1: AreaType, type2: AreaType): boolean {
  if (type1 === type2) return false;
  if (type1 === "unknown" || type2 === "unknown") return false;
  
  for (const [baseType, conflicting] of MUTUALLY_EXCLUSIVE_AREAS) {
    if (type1 === baseType && conflicting.includes(type2)) return true;
    if (type2 === baseType && conflicting.includes(type1)) return true;
  }
  
  return false;
}

/**
 * Check if two sides conflict (left vs right).
 */
export function hasSideConflict(side1: SideType, side2: SideType): boolean {
  if (side1 === null || side2 === null) return false;
  return side1 !== side2;
}
