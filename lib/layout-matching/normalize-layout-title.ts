/**
 * Utilities for normalizing sheet names and layout page titles for matching.
 *
 * Pipeline (in order):
 *   1. removeSuffixes     — strip project-specific trailing tokens (,SMT130 ;TT6 ^JB70 etc.)
 *   2. normalizeSeparators — collapse ^ ; & . and other punctuation → single space
 *   3. replacePhrases     — swap multi-word expressions before word-level expansion
 *   4. expandAbbreviations — word-by-word lookup in ABBREVIATION_MAP
 */

// ============================================================================
// Abbreviation Map
// ============================================================================

/**
 * Canonical form → all accepted spellings (including the canonical itself).
 * `buildReverseLookup` inverts this so every spelling maps to its canonical.
 *
 * Rules:
 * - Key  = the canonical OUTPUT form used throughout the app.
 * - Values = every alias / abbreviation / long-form that should collapse to it.
 * - Keep keys upper-case; values are compared case-insensitively at runtime.
 */
const ABBREVIATION_MAP: Record<string, string[]> = {
  // ── Structural / physical ────────────────────────────────────────────────
  "PANEL":    ["PANEL", "PNL", "PN", "PNL."],
  "DOOR":     ["DOOR", "DR", "DRAWER"],
  "RAIL":     ["RAIL", "RL"],
  "BOX":      ["BOX", "BX"],
  "CONSOLE":  ["CONSOLE", "CONS"],
  "ASSEMBLY": ["ASSEMBLY", "ASSY"],
  "BLANK":    ["BLANK", "BLNK"],
  "LEFT":     ["LEFT", "LFT", "LT"],
  "RIGHT":    ["RIGHT", "RGT", "RT"],
  "BACK":     ["BACK", "BK"],
  "FRONT":    ["FRONT", "FRT"],
  "ISOLATOR": ["ISOLATOR", "ISOL", "ISO"],

  // ── Electrical / controls ────────────────────────────────────────────────
  "CTRL":     ["CTRL", "CONTROL", "CNTRL", "CTL", "CNTL"],
  "PWR":      ["PWR", "POWER", "POW"],
  "DIST":     ["DIST", "DISTRIBUTION", "DST", "DISTR", "DISTRB"],
  "VIB":      ["VIB", "VIBRATION", "VIBR"],
  "PROX":     ["PROX", "PROXIMITY", "PROXIMITOR"],
  "GEN":      ["GEN", "GENERATOR"],
  "TURB":     ["TURB", "TURBINE"],
  "COMP":     ["COMP", "COMPRESSOR"],
  "CONV":     ["CONV", "CONVERTER", "CONVERTOR"],
  "VFD":      ["VFD", "VARIABLE FREQUENCY DRIVE"],
  "AUX":      ["AUX", "AUXILIARY"],
  "OPR":      ["OPR", "OPERATOR", "OPERATION"],
  "EQP":      ["EQP", "EQUIPMENT", "EQUIP"],
  "CMPNT":    ["CMPNT", "COMPONENT"],
  "CUST":     ["CUST", "CUSTOMER"],
  "INTRFC":   ["INTRFC", "INTERFACE", "INTF"],
  "LIQ":      ["LIQ", "LIQUID"],
  "FO":       ["FO", "FUEL OIL", "FUEL-OIL"],
  "RELAY":    ["RELAY", "RLY"],

  // ── System acronyms (map common long-forms → short canonical) ───────────
  "MCC":      ["MCC", "MOTOR CONTROL CENTER", "MOTOR CONTROL"],
  "PLC":      ["PLC", "PROGRAMMABLE LOGIC CONTROLLER", "PROGRAMMABLE LOGIC"],
  "TCP":      ["TCP", "THERMOCOUPLE PANEL", "TC PANEL", "TCPANEL", "THERMOCOUPLE"],
  "FGE":      ["FGE", "FG&E", "F&G", "FIRE GAS", "FIRE & GAS", "FIRE AND GAS"],
  "BOP":      ["BOP", "BALANCE OF PLANT"],
  "HPC":      ["HPC", "HP COMP", "HIGH PRESSURE COMP", "HIGH PRESSURE COMPRESSOR"],
  "LPC":      ["LPC", "LP COMP", "LOW PRESSURE COMP", "LOW PRESSURE COMPRESSOR"],
  "GB":       ["GB", "GEARBOX", "GEAR BOX"],
  "DCS":      ["DCS", "DISTRIBUTED CONTROL SYSTEM"],
  "SIS":      ["SIS", "SAFETY INSTRUMENTED SYSTEM"],
  "UCP":      ["UCP", "UNIT CONTROL PANEL"],
  "EEC":      ["EEC"],
  "SCS":      ["SCS"],
  "PSS":      ["PSS"],
  "IS":       ["IS", "INTRINSICALLY SAFE"],

  // ── Junction-box type shortcuts ──────────────────────────────────────────
  "JB":       ["JB", "JUNCTION BOX", "JBOX", "J-BOX"],
  "SMT":      ["SMT", "SUMMIT"],
  "BECK":     ["BECK", "BECKWITH"],
};

// ============================================================================
// Phrase Map  (multi-word pre-substitutions, applied before word expansion)
// ============================================================================

/**
 * Ordered list of [pattern, replacement] pairs.
 * Applied against the UPPER-CASE, separator-normalised string.
 * Patterns are matched whole-word where possible.
 */
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Power distribution variants
  [/\bPOWER\s+DIST(?:RIBUTION)?\b/g,          "PWR DIST"],
  [/\bPWR\s+DST\b/g,                           "PWR DIST"],
  [/\bPWR\s+DISTR?\b/g,                        "PWR DIST"],
  [/\bPOWERDIST\b/g,                           "PWR DIST"],

  // HP / LP Compressor → canonical acronym
  [/\bHP\s+COMPRESSOR\b/g,                     "HPC"],
  [/\bHP\s+COMP\b/g,                           "HPC"],
  [/\bHIGH\s+PRESSURE\s+COMP(?:RESSOR)?\b/g,  "HPC"],
  [/\bLP\s+COMPRESSOR\b/g,                     "LPC"],
  [/\bLP\s+COMP\b/g,                           "LPC"],
  [/\bLOW\s+PRESSURE\s+COMP(?:RESSOR)?\b/g,   "LPC"],

  // Gear box
  [/\bGEAR\s+BOX\b/g,                          "GB"],

  // Fire & Gas
  [/\bFIRE\s*(?:AND|&)\s*GAS\b/g,             "FGE"],
  [/\bFG\s*&\s*E\b/g,                          "FGE"],

  // Fuel oil
  [/\bFUEL[\s-]+OIL\b/g,                       "FO"],

  // Junction box
  [/\bJUNCTION\s+BOX\b/g,                      "JB"],

  // Motor control center
  [/\bMOTOR\s+CONTROL\s+CENTER\b/g,            "MCC"],

  // Variable frequency drive
  [/\bVARIABLE\s+FREQUENCY\s+DRIVE\b/g,        "VFD"],

  // Programmable logic controller
  [/\bPROGRAMMABLE\s+LOGIC\s+CONTROLLER\b/g,   "PLC"],
  [/\bPROGRAMMABLE\s+LOGIC\b/g,                "PLC"],

  // Left / right rail shorthand
  [/\bLEFT\s+SIDE\s+RAIL\b/g,                  "LEFT RAIL"],
  [/\bRIGHT\s+SIDE\s+RAIL\b/g,                 "RIGHT RAIL"],
  [/\bLEFT\s+SIDE\s+PANEL\b/g,                 "LEFT PANEL"],
  [/\bRIGHT\s+SIDE\s+PANEL\b/g,                "RIGHT PANEL"],
];

// ============================================================================
// Reverse lookup
// ============================================================================

function buildReverseLookup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, spellings] of Object.entries(ABBREVIATION_MAP)) {
    const key = canonical.toUpperCase();
    map.set(key, key);
    for (const spelling of spellings) {
      map.set(spelling.toUpperCase(), key);
    }
  }
  return map;
}

const REVERSE_LOOKUP = buildReverseLookup();

// ============================================================================
// Normalization steps
// ============================================================================

/**
 * Strip project-specific trailing tokens that add noise without aiding matching.
 * Runs on the RAW (pre-punctuation) string so comma/semicolon anchors still work.
 */
function removeSuffixes(text: string): string {
  let t = text;

  // Project reference codes  e.g. ",SMT130"  ",JB70"  "^JB70"  " JB74"
  t = t.replace(/[\s,;^]+SMT\d+/gi, "");

  // Terminal-tray markers  e.g. ";TT6"  ";TT12"
  t = t.replace(/[;,\s^]+TT\d+\b/gi, "");

  // Bay counts  e.g. ",2-BAY"  " 1-BAY"
  t = t.replace(/[\s,;^]+\d+[\s-]?BAY\b/gi, "");

  // Customer-copy markers  e.g. ",C.C."
  t = t.replace(/[\s,;^]+C\.C\./gi, "");

  // Site/scope tags  e.g. ",ONSK"  ",CSMD"
  t = t.replace(/[\s,;^]+(?:ONSK|CSMD)\b/gi, "");

  return t.trim();
}

/**
 * Collapse ALL separator-like characters (commas, hyphens, carets, semicolons,
 * ampersands when standalone, periods, underscores) into a single space.
 */
function normalizeSeparators(text: string): string {
  return text
    .replace(/\^/g, " ")          // caret used as word separator
    .replace(/[,\-_:;]+/g, " ")   // standard punctuation
    .replace(/\.(?!\d)/g, " ")    // dot NOT followed by digit (preserve "2.5")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Apply PHRASE_REPLACEMENTS on the upper-cased, separator-normalised string
 * before word-level expansion so multi-word terms are caught as a unit.
 */
function replacePhrases(text: string): string {
  let t = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    t = t.replace(pattern, replacement);
  }
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Word-by-word lookup in REVERSE_LOOKUP.
 * Tokens that have no entry pass through unchanged.
 */
function expandAbbreviations(text: string): string {
  return text
    .split(" ")
    .map((word) => REVERSE_LOOKUP.get(word.toUpperCase()) ?? word.toUpperCase())
    .join(" ");
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Normalize a wire-list sheet name for matching against layout page titles.
 */
export function normalizeSheetName(name: string): string {
  let t = name.toUpperCase();
  t = removeSuffixes(t);
  t = normalizeSeparators(t);
  t = replacePhrases(t);
  t = expandAbbreviations(t);
  return t;
}

/**
 * Normalize a PDF layout page title for matching against sheet names.
 */
export function normalizeLayoutPageTitle(title: string): string {
  return normalizeSheetName(title);
}

/**
 * Extract keywords from a normalized string for fuzzy / keyword matching.
 * Short stop-words and very short tokens are filtered out.
 */
export function extractKeywords(text: string): string[] {
  const STOP = new Set(["THE", "AND", "OF", "FOR", "TO", "A", "AN", "IN", "AT", "BY"]);
  return normalizeSheetName(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Return true when two names normalise to the same string.
 */
export function areNamesEquivalent(name1: string, name2: string): boolean {
  return normalizeSheetName(name1) === normalizeSheetName(name2);
}

/**
 * Jaccard similarity (0–1) between the keyword sets of two names.
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const kw1 = new Set(extractKeywords(name1));
  const kw2 = new Set(extractKeywords(name2));
  if (kw1.size === 0 || kw2.size === 0) return 0;

  let intersection = 0;
  for (const w of kw1) if (kw2.has(w)) intersection++;

  const union = kw1.size + kw2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract the panel-letter designator from a name (e.g. "PNL A" → "A").
 */
export function extractPanelLetter(name: string): string | undefined {
  const match = name.match(/(?:PNL|PANEL)\s*([A-Z])\b/i);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Return a deduplicated list of panel-type keyword tags for a name.
 * Used for scoring / filtering in layout matching.
 */
export function getPanelTypeKeywords(name: string): string[] {
  const upper = name.toUpperCase();
  const tags: string[] = [];

  // Control
  if (/\b(?:CTRL|CONTROL|CNTRL|CTL|CNTL)\b/.test(upper)) tags.push("CTRL");
  // Door
  if (/\b(?:DOOR|DR)\b/.test(upper))                       tags.push("DOOR");
  // Power
  if (/\b(?:PWR|POWER|POW)\b/.test(upper))                 tags.push("PWR");
  // Panel
  if (/\b(?:PNL|PANEL|PN)\b/.test(upper))                  tags.push("PANEL");
  // MCC
  if (/\bMCC\b/.test(upper))                               tags.push("MCC");
  // PLC
  if (/\bPLC\b/.test(upper))                               tags.push("PLC");
  // TCP
  if (/\bTCP\b/.test(upper))                               tags.push("TCP");
  // Generator
  if (/\bGEN(?:ERATOR)?\b/.test(upper))                    tags.push("GEN");
  // Fire & Gas
  if (/\b(?:FG&E|FGE|F&G|FIRE\s*(?:AND|&)?\s*GAS)\b/.test(upper)) tags.push("FGE");
  // Distribution
  if (/\b(?:DIST|DST|DISTRIBUTION|DISTR)\b/.test(upper))  tags.push("DIST");
  // Beckwith
  if (/\b(?:BECKWITH|BECK)\b/.test(upper))                 tags.push("BECK");
  // Relay
  if (/\bRELAY\b/.test(upper))                             tags.push("RELAY");
  // Vibration
  if (/\b(?:VIB|VIBRATION)\b/.test(upper))                 tags.push("VIB");
  // Junction box
  if (/\b(?:JB\d*|JUNCTION\s*BOX)\b/.test(upper))          tags.push("JB");
  // Component
  if (/\b(?:CMPNT|COMPONENT)\b/.test(upper))               tags.push("CMPNT");
  // Compressor
  if (/\b(?:COMP|COMPRESSOR|HPC|LPC)\b/.test(upper))       tags.push("COMP");
  // HPC / LPC
  if (/\b(?:HPC|HP\s*COMP(?:RESSOR)?|HIGH\s+PRESSURE)\b/.test(upper)) tags.push("HPC");
  if (/\b(?:LPC|LP\s*COMP(?:RESSOR)?|LOW\s+PRESSURE)\b/.test(upper))  tags.push("LPC");
  // Converter / VFD
  if (/\b(?:CONV|CONVERTER|VFD)\b/.test(upper))            tags.push("CONV");
  // BOP
  if (/\bBOP\b/.test(upper))                               tags.push("BOP");
  // Auxiliary
  if (/\b(?:AUX|AUXILIARY)\b/.test(upper))                 tags.push("AUX");
  // Prox
  if (/\b(?:PROX|PROXIMITY|PROXIMITOR)\b/.test(upper))     tags.push("PROX");
  // Turbine
  if (/\b(?:TURB|TURBINE)\b/.test(upper))                  tags.push("TURB");
  // Gearbox
  if (/\b(?:GB|GEARBOX|GEAR\s*BOX)\b/.test(upper))         tags.push("GB");
  // Equipment
  if (/\b(?:EQP|EQUIPMENT|EQUIP)\b/.test(upper))           tags.push("EQP");
  // Interface
  if (/\b(?:INTRFC|INTF|INTERFACE)\b/.test(upper))         tags.push("INTRFC");
  // Liquid / Fuel Oil
  if (/\b(?:LIQ|LIQUID)\b/.test(upper))                    tags.push("LIQ");
  if (/\b(?:FO|FUEL\s*OIL)\b/.test(upper))                 tags.push("FO");
  // Assembly
  if (/\b(?:ASSY|ASSEMBLY)\b/.test(upper))                 tags.push("ASSY");

  // Panel letter  e.g. "PNL A" → "PNL_A"
  const panelLetterMatch = upper.match(/\b(?:PNL|PANEL)\s+([A-Z])\b/);
  if (panelLetterMatch) tags.push(`PNL_${panelLetterMatch[1]}`);

  // JB number  e.g. "JB70" → "JB70"
  const jbNumberMatch = upper.match(/\bJB(\d+)\b/);
  if (jbNumberMatch) tags.push(`JB${jbNumberMatch[1]}`);

  return [...new Set(tags)]; // deduplicate
}
