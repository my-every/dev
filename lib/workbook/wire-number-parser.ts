/**
 * Wire number parsing and classification utilities.
 * 
 * Wire numbers in the system follow various patterns:
 * - Voltage references: 0V, 24V
 * - Fuse references: FU0172, FU0136 (prefix "FU")
 * - Device/terminal references: XT05002, UV01705, AT017823
 * - Ground wires: AT0170G, GR0170, UV0170G (suffix "G")
 * - Cable references: WC1242, WC8050 (prefix "WC")
 * - Relay references: KA0172A1, KA6510 (prefix "KA")
 * - Special wires: LON2S1, LON2B (LON network wires)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Classification of a wire number.
 */
export type WireNumberCategory =
  | "voltage"        // 0V, 24V, etc.
  | "fuse"           // FU0172, FU0136
  | "ground"         // AT0170G, GR0170
  | "cable"          // WC1242, WC8050
  | "relay"          // KA0172A1, KA6510
  | "terminal"       // XT05002, XT0173
  | "analog"         // AT0170, AT0175 (analog terminals)
  | "universal"      // UV0170, UV0175 (universal valves)
  | "network"        // LON2S1, LON0P (LON network)
  | "sensor"         // SA017023, SB097024 (sensors)
  | "indicator"      // HL01712, VD0175A (indicator lights, voltage displays)
  | "resistor"       // RR0178, RR7614 (resistors)
  | "diode"          // VD0178 (voltage drop/diode)
  | "generic"        // Unknown pattern

/**
 * Parsed wire number information.
 */
export interface ParsedWireNumber {
  /** Original raw value */
  raw: string;
  /** Normalized display value */
  display: string;
  /** Wire number category */
  category: WireNumberCategory;
  /** Device prefix (e.g., "FU", "WC", "AT") */
  prefix: string;
  /** Numeric portion of the wire number */
  numericPart: string;
  /** Suffix if present (e.g., "G" for ground) */
  suffix: string;
  /** Whether this is a ground wire */
  isGround: boolean;
  /** Whether this is a voltage reference */
  isVoltageRef: boolean;
  /** Whether this is a cable/multiconductor */
  isCable: boolean;
}

// ============================================================================
// Patterns
// ============================================================================

/**
 * Wire number classification patterns.
 * Order matters - more specific patterns should come first.
 */
const WIRE_NUMBER_PATTERNS: { pattern: RegExp; category: WireNumberCategory; prefix?: string }[] = [
  // Voltage references: 0V, 24V, 120V (including negative: -0V, -24V)
  { pattern: /^-?(\d+)V$/i, category: "voltage" },

  // Ground wires: AT0170G, GR0170, UV0170G (end with G)
  { pattern: /^([A-Z]{2,4})(\d{3,5})G$/i, category: "ground" },
  { pattern: /^GR(\d{3,5})$/i, category: "ground", prefix: "GR" },
  { pattern: /^GND$/i, category: "ground" },
  { pattern: /^GROUND$/i, category: "ground" },
  { pattern: /^FRAME$/i, category: "ground" },

  // Fuse references: FU0172, FU0136
  { pattern: /^FU(\d{3,5})$/i, category: "fuse", prefix: "FU" },

  // Cable references: WC1242, WC8050
  { pattern: /^WC(\d{3,5})$/i, category: "cable", prefix: "WC" },

  // Relay references: KA0172A1, KA6510:A2
  { pattern: /^KA(\d{3,5})(:?[A-Z]?\d*)$/i, category: "relay", prefix: "KA" },

  // Network wires: LON2S1, LON0P, LON2B
  { pattern: /^LON\d?[A-Z]?\d?$/i, category: "network", prefix: "LON" },

  // Analog terminals: AT0170, AT01715
  { pattern: /^AT(\d{3,6})([A-Z]?\d*)$/i, category: "analog", prefix: "AT" },

  // Universal valves: UV01705, UV0170
  { pattern: /^UV(\d{3,6})([A-Z]?\d*)$/i, category: "universal", prefix: "UV" },

  // Sensors: SA017023, SB097024
  { pattern: /^S[AB](\d{5,7})$/i, category: "sensor", prefix: "S" },

  // Indicator lights: HL01712, HL09722
  { pattern: /^HL(\d{4,6})$/i, category: "indicator", prefix: "HL" },

  // Voltage display/diode: VD0175A, VD0975I
  { pattern: /^VD(\d{3,5})([A-Z]?)$/i, category: "diode", prefix: "VD" },

  // Resistors: RR0178, RR7614
  { pattern: /^RR(\d{3,5})$/i, category: "resistor", prefix: "RR" },

  // Terminal blocks: XT05002, XT0510
  { pattern: /^XT(\d{3,6})$/i, category: "terminal", prefix: "XT" },

  // IEG (circuit breaker) references
  { pattern: /^IEG(\d{3,6})$/i, category: "fuse", prefix: "IEG" },

  // AF (panel) references
  { pattern: /^AF(\d{3,6})$/i, category: "terminal", prefix: "AF" },

  // UA (universal analog?) references
  { pattern: /^UA[AI]?(\d{3,6})([A-Z]?\d*)$/i, category: "analog", prefix: "UA" },
];

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse and classify a wire number value.
 * 
 * @param value - Raw wire number from spreadsheet
 * @returns Parsed wire number information
 */
export function parseWireNumber(value: string | number | boolean | Date | null): ParsedWireNumber {
  // Handle empty/null values
  if (value === null || value === undefined || value === "") {
    return {
      raw: "",
      display: "-",
      category: "generic",
      prefix: "",
      numericPart: "",
      suffix: "",
      isGround: false,
      isVoltageRef: false,
      isCable: false,
    };
  }

  const strValue = String(value).trim();

  // Try to match against known patterns
  for (const { pattern, category, prefix: defaultPrefix } of WIRE_NUMBER_PATTERNS) {
    const match = strValue.match(pattern);
    if (match) {
      // Extract parts based on category
      let prefix = defaultPrefix || "";
      let numericPart = "";
      let suffix = "";

      if (category === "voltage") {
        numericPart = match[1];
        suffix = "V";
      } else if (category === "ground" && strValue.endsWith("G")) {
        // Ground wire with G suffix
        const prefixMatch = strValue.match(/^([A-Z]{2,4})/i);
        prefix = prefixMatch ? prefixMatch[1] : "";
        numericPart = strValue.replace(/^[A-Z]+/i, "").replace(/G$/i, "");
        suffix = "G";
      } else {
        // Extract prefix from beginning
        const prefixMatch = strValue.match(/^([A-Z]+)/i);
        prefix = prefixMatch ? prefixMatch[1] : "";
        // Extract numeric part
        const numMatch = strValue.match(/(\d+)/);
        numericPart = numMatch ? numMatch[1] : "";
        // Extract suffix after numeric
        const afterNumeric = strValue.replace(/^[A-Z]+\d+/i, "");
        suffix = afterNumeric;
      }

      return {
        raw: strValue,
        display: strValue,
        category,
        prefix,
        numericPart,
        suffix,
        isGround: category === "ground" || strValue.endsWith("G") || /^GND|GROUND|FRAME$/i.test(strValue),
        isVoltageRef: category === "voltage",
        isCable: category === "cable",
      };
    }
  }

  // Generic fallback - try to extract any prefix/numeric pattern
  const genericMatch = strValue.match(/^([A-Z]*)(\d*)(.*)$/i);

  return {
    raw: strValue,
    display: strValue,
    category: "generic",
    prefix: genericMatch?.[1] || "",
    numericPart: genericMatch?.[2] || "",
    suffix: genericMatch?.[3] || "",
    isGround: strValue.endsWith("G") || /GND|GROUND|FRAME/i.test(strValue),
    isVoltageRef: /^-?\d+V$/i.test(strValue),
    isCable: strValue.startsWith("WC"),
  };
}

/**
 * Get a human-readable label for a wire number category.
 */
export function getWireNumberCategoryLabel(category: WireNumberCategory): string {
  const labels: Record<WireNumberCategory, string> = {
    voltage: "Voltage Reference",
    fuse: "Fuse",
    ground: "Ground",
    cable: "Cable",
    relay: "Relay",
    terminal: "Terminal",
    analog: "Analog",
    universal: "Universal",
    network: "Network",
    sensor: "Sensor",
    indicator: "Indicator",
    resistor: "Resistor",
    diode: "Diode",
    generic: "Generic",
  };
  return labels[category];
}

/**
 * Check if a wire number is a fuse reference.
 */
export function isFuseWire(value: string | number | boolean | Date | null): boolean {
  const parsed = parseWireNumber(value);
  return parsed.category === "fuse";
}

/**
 * Check if a wire number is a cable reference.
 */
export function isCableWire(value: string | number | boolean | Date | null): boolean {
  const parsed = parseWireNumber(value);
  return parsed.isCable;
}

/**
 * Check if a wire number is a ground wire.
 */
export function isGroundWire(value: string | number | boolean | Date | null): boolean {
  const parsed = parseWireNumber(value);
  return parsed.isGround;
}

/**
 * Check if a wire number is a voltage reference (0V, 24V, etc).
 */
export function isVoltageReference(value: string | number | boolean | Date | null): boolean {
  const parsed = parseWireNumber(value);
  return parsed.isVoltageRef;
}

/**
 * Extract the device prefix from a wire number.
 * Returns empty string if no prefix found.
 */
export function extractWirePrefix(value: string | number | boolean | Date | null): string {
  const parsed = parseWireNumber(value);
  return parsed.prefix;
}

/**
 * Get all unique wire number categories from a list of wire numbers.
 */
export function getUniqueWireCategories(
  wireNumbers: (string | number | boolean | Date | null)[]
): WireNumberCategory[] {
  const categories = new Set<WireNumberCategory>();
  for (const wn of wireNumbers) {
    const parsed = parseWireNumber(wn);
    categories.add(parsed.category);
  }
  return Array.from(categories);
}

/**
 * Filter wire numbers by category.
 */
export function filterWiresByCategory<T extends { [key: string]: unknown }>(
  rows: T[],
  wireNoKey: string,
  categories: WireNumberCategory[]
): T[] {
  return rows.filter(row => {
    const parsed = parseWireNumber(row[wireNoKey] as string | number | boolean | Date | null);
    return categories.includes(parsed.category);
  });
}
