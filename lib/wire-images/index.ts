/**
 * Wire Image Mapping Utility
 * 
 * Maps wire IDs to corresponding images in /public/wires/
 * Images are named with patterns that match wire characteristics:
 * - Part numbers: 1022941-32.png, 1022941-33.png
 * - Gauge-color combos: 14-GRN-JUMPER.png, 20-WHT.png, 8-GRN-RING.png
 * - Special types: AU-AF-16-JUMPER.png, GREN-YEL.png
 */

// Available wire images (without extension)
const WIRE_IMAGES = [
  "1022941-32",
  "1022941-33",
  "14-GRN-JUMPER",
  "14-GRN-RING",
  "14-GRN-YEL-RING",
  "14-WHT",
  "16-WHITE-JUMPER",
  "16-WHT-SPIRAL",
  "20-FORK",
  "20-VIO",
  "20-WHT",
  "8-GRN-RING",
  "AU-AF-16-JUMPER",
  "GREN-YEL",
] as const;

// Build a normalized lookup map for faster matching
const normalizedImageMap = new Map<string, string>();
for (const img of WIRE_IMAGES) {
  // Store both the original and a normalized (uppercase, no special chars) version
  normalizedImageMap.set(img.toUpperCase(), img);
  normalizedImageMap.set(img.toUpperCase().replace(/-/g, ""), img);
  normalizedImageMap.set(img.toUpperCase().replace(/-/g, " "), img);
}

/**
 * Normalize a wire ID for matching against image names.
 */
function normalizeWireId(wireId: string): string {
  return (wireId || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-") // spaces to dashes
    .replace(/[^A-Z0-9-]/g, ""); // remove special chars except dashes
}

/**
 * Extract potential match keys from a wire ID.
 * Returns multiple variations to try for matching.
 */
function getMatchKeys(wireId: string, gaugeSize?: string): string[] {
  const norm = normalizeWireId(wireId);
  const keys: string[] = [norm, norm.replace(/-/g, "")];
  
  // Try with gauge prefix if available
  if (gaugeSize) {
    const gauge = gaugeSize.replace(/\D/g, ""); // Extract numeric gauge
    if (gauge) {
      keys.push(`${gauge}-${norm}`);
      keys.push(`${gauge}${norm.replace(/-/g, "")}`);
    }
  }
  
  // Try partial matches (first parts)
  const parts = norm.split("-");
  if (parts.length > 1) {
    keys.push(parts.slice(0, 2).join("-"));
    keys.push(parts.slice(0, 3).join("-"));
  }
  
  return keys;
}

/**
 * Get the wire image path for a given wire ID.
 * 
 * @param wireId - The wire ID from the wire list
 * @param gaugeSize - Optional gauge size for additional matching context
 * @returns The image path or null if no match found
 */
export function getWireImagePath(wireId: string, gaugeSize?: string): string | null {
  if (!wireId) return null;
  
  const matchKeys = getMatchKeys(wireId, gaugeSize);
  
  // Try exact matches first
  for (const key of matchKeys) {
    const match = normalizedImageMap.get(key);
    if (match) {
      return `/wires/${match}.png`;
    }
  }
  
  // Try partial/fuzzy matching
  const normalized = normalizeWireId(wireId);
  for (const [imgKey, imgName] of normalizedImageMap) {
    // Check if wire ID contains the image name or vice versa
    if (normalized.includes(imgKey) || imgKey.includes(normalized)) {
      return `/wires/${imgName}.png`;
    }
  }
  
  // Special case mappings based on color/type keywords
  const colorMatches: Record<string, string> = {
    "GRN-YEL": "GREN-YEL",
    "GREEN-YELLOW": "GREN-YEL",
    "GRNYEL": "GREN-YEL",
  };
  
  for (const [pattern, imgName] of Object.entries(colorMatches)) {
    if (normalized.includes(pattern)) {
      return `/wires/${imgName}.png`;
    }
  }
  
  return null;
}

/**
 * Check if a wire image exists for the given wire ID.
 */
export function hasWireImage(wireId: string, gaugeSize?: string): boolean {
  return getWireImagePath(wireId, gaugeSize) !== null;
}

/**
 * Get all available wire image names.
 */
export function getAvailableWireImages(): readonly string[] {
  return WIRE_IMAGES;
}
