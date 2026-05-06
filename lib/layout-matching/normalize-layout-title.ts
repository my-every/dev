/**
 * Utilities for normalizing sheet names and layout page titles for matching.
 */

// ============================================================================
// Abbreviation Mappings
// ============================================================================

/**
 * Common abbreviations and their expanded forms.
 * Key is the canonical form, values are alternatives.
 */
const ABBREVIATION_MAP: Record<string, string[]> = {
  "PNL": ["PANEL", "PN"],
  "CTRL": ["CONTROL", "CNTRL", "CTL"],
  "PWR": ["POWER", "POW"],
  "DST": ["DIST", "DISTRIBUTION"],
  "DR": ["DOOR", "DRAWER"],
  "CMPNT": ["COMPONENT", "COMP"],
  "GEN": ["GENERAL", "GENERATOR"],
  "FGE": ["FG&E", "F&G", "FIRE GAS", "FIRE & GAS", "FIRE AND GAS"],
  "PROX": ["PROXIMITY"],
  "TURB": ["TURBINE"],
  "MCC": ["MOTOR CONTROL CENTER", "MOTOR CONTROL"],
  "TCP": ["THERMOCOUPLE", "TC PANEL", "TCPANEL"],
  "PLC": ["PROGRAMMABLE LOGIC", "PROGRAMMABLE LOGIC CONTROLLER"],
  "JB": ["JUNCTION BOX", "JBOX", "J-BOX"],
  "SMT": ["SUMMIT"],
  "VIB": ["VIBRATION"],
  "BECK": ["BECKWITH"],
};

/**
 * Build a reverse lookup map for expansions.
 */
function buildReverseLookup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [abbrev, expansions] of Object.entries(ABBREVIATION_MAP)) {
    map.set(abbrev.toUpperCase(), abbrev.toUpperCase());
    for (const expansion of expansions) {
      map.set(expansion.toUpperCase(), abbrev.toUpperCase());
    }
  }
  return map;
}

const REVERSE_LOOKUP = buildReverseLookup();

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Remove common suffixes like ",SMT130" or ",JB70" that are project-specific.
 * These suffixes don't help with matching and can cause false negatives.
 */
function removeSuffixes(text: string): string {
  // Remove project-specific suffixes like ",SMT130", ",JB70", etc.
  let result = text;
  
  // Remove suffixes at end of string or before other text
  result = result.replace(/[,\s]+SMT\d+/gi, "");
  result = result.replace(/[,\s]+JB\d+/gi, "");
  result = result.replace(/[,\s]+\d+-BAY/gi, ""); // Remove n-BAY suffixes
  
  return result.trim();
}

/**
 * Normalize punctuation and whitespace.
 */
function normalizePunctuation(text: string): string {
  return text
    .replace(/[,\-_:;]+/g, " ")  // Replace punctuation with spaces
    .replace(/\s+/g, " ")         // Collapse multiple spaces
    .trim();
}

/**
 * Expand abbreviations to canonical form.
 */
function expandAbbreviations(text: string): string {
  const words = text.split(" ");
  return words.map(word => {
    const upper = word.toUpperCase();
    return REVERSE_LOOKUP.get(upper) || upper;
  }).join(" ");
}

/**
 * Normalize a sheet name for matching.
 * This is used for wire-list sheet names.
 */
export function normalizeSheetName(name: string): string {
  let normalized = name.toUpperCase();
  normalized = removeSuffixes(normalized);
  normalized = normalizePunctuation(normalized);
  normalized = expandAbbreviations(normalized);
  return normalized;
}

/**
 * Normalize a layout page title for matching.
 * This is used for PDF layout page titles.
 */
export function normalizeLayoutPageTitle(title: string): string {
  let normalized = title.toUpperCase();
  normalized = removeSuffixes(normalized);
  normalized = normalizePunctuation(normalized);
  normalized = expandAbbreviations(normalized);
  return normalized;
}

/**
 * Extract keywords from normalized text for fuzzy matching.
 */
export function extractKeywords(text: string): string[] {
  const normalized = normalizeSheetName(text);
  return normalized
    .split(" ")
    .filter(word => word.length > 1)
    .filter(word => !["THE", "AND", "OF", "FOR", "TO", "A", "AN"].includes(word));
}

/**
 * Check if two normalized strings are equivalent.
 */
export function areNamesEquivalent(name1: string, name2: string): boolean {
  const norm1 = normalizeSheetName(name1);
  const norm2 = normalizeSheetName(name2);
  return norm1 === norm2;
}

/**
 * Calculate similarity score between two names (0-1).
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const keywords1 = extractKeywords(name1);
  const keywords2 = extractKeywords(name2);
  
  if (keywords1.length === 0 || keywords2.length === 0) {
    return 0;
  }
  
  // Calculate Jaccard similarity
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) {
      intersection++;
    }
  }
  
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract panel letter from a name (e.g., "PNL A" -> "A").
 */
export function extractPanelLetter(name: string): string | undefined {
  const match = name.match(/PNL\s*([A-Z])/i);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Check if name contains specific panel type keywords.
 */
export function getPanelTypeKeywords(name: string): string[] {
  const upper = name.toUpperCase();
  const keywords: string[] = [];
  
  // Panel types
  if (/\bCONTROL\b/i.test(upper) || /\bCTRL\b/i.test(upper)) keywords.push("CONTROL");
  if (/\bDOOR\b/i.test(upper)) keywords.push("DOOR");
  if (/\bPOWER\b/i.test(upper) || /\bPWR\b/i.test(upper)) keywords.push("POWER");
  if (/\bPNL\b/i.test(upper) || /\bPANEL\b/i.test(upper)) keywords.push("PANEL");
  if (/\bMCC\b/i.test(upper)) keywords.push("MCC");
  if (/\bPLC\b/i.test(upper)) keywords.push("PLC");
  if (/\bTCP\b/i.test(upper)) keywords.push("TCP");
  if (/\bGEN\b/i.test(upper)) keywords.push("GEN");
  if (/\bFG&E\b/i.test(upper) || /\bFGE\b/i.test(upper) || /\bFIRE\s*(AND|&)?\s*GAS\b/i.test(upper)) keywords.push("FGE");
  if (/\bDST\b/i.test(upper) || /\bDIST\b/i.test(upper)) keywords.push("DIST");
  if (/\bBECKWITH\b/i.test(upper)) keywords.push("BECKWITH");
  if (/\bRELAY\b/i.test(upper)) keywords.push("RELAY");
  if (/\bVIB\b/i.test(upper) || /\bVIBRATION\b/i.test(upper)) keywords.push("VIB");
  if (/\bJB\d*\b/i.test(upper) || /\bJUNCTION\s*BOX\b/i.test(upper)) keywords.push("JB");
  if (/\bCMPNT\b/i.test(upper) || /\bCOMPONENT\b/i.test(upper)) keywords.push("CMPNT");
  
  // Extract panel letter if present
  const panelMatch = upper.match(/\b(?:PNL|PANEL)\s*([A-Z])\b/);
  if (panelMatch) {
    keywords.push(`PNL_${panelMatch[1]}`);
  }
  
  // Extract JB number if present
  const jbMatch = upper.match(/\bJB(\d+)\b/);
  if (jbMatch) {
    keywords.push(`JB${jbMatch[1]}`);
  }
  
  return keywords;
}
