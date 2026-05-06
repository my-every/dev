/**
 * Normalize part numbers for consistent filename matching.
 * Handles:
 * - trimming whitespace
 * - removing duplicates
 * - sorting deterministically
 * - joining with commas
 *
 * Example:
 *   ["2684693-33", "2684693-19", "2684693-19"]
 *   → "2684693-19,2684693-33"
 */
export function normalizePartNumberKey(partNumbers: string[]): string {
  const normalized = [
    ...new Set(
      partNumbers
        .map(pn => pn.trim())
        .filter(pn => pn.length > 0)
    )
  ].sort();

  return normalized.join(",");
}

/**
 * Check if a file exists in the static assets.
 * Used for matching part number filenames against /public/devices directory.
 *
 * Since we can't directly check filesystem during runtime,
 * this returns the path assuming the file exists.
 * The caller should handle 404 errors gracefully.
 */
export function getStaticDeviceImagePath(filenameWithoutExt: string): string {
  return `/devices/${filenameWithoutExt}.png`;
}

/**
 * Build a list of device image filename candidates to try.
 * Returns filenames in priority order (without directory or extension).
 *
 * Example for ["2684693-19", "2684693-33"]:
 *   1. "2684693-19,2684693-33" (exact multi-part match)
 *   2. "2684693-19"
 *   3. "2684693-33"
 */
export function buildStaticDeviceImageCandidates(partNumbers: string[]): string[] {
  const candidates: string[] = [];

  if (partNumbers.length === 0) return candidates;

  // Priority 1: normalized multi-part filename (exact match)
  if (partNumbers.length > 1) {
    candidates.push(normalizePartNumberKey(partNumbers));
  }

  // Priority 2: each part number individually
  for (const pn of partNumbers) {
    const normalized = pn.trim();
    if (normalized.length > 0 && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }

  return candidates;
}
