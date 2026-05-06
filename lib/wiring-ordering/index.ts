/**
 * Wiring Ordering Module
 * 
 * Device family-specific ordering profiles for wire list rows.
 * Reflects physical panel reading order (typically bottom-to-top).
 */

// Types
export * from "./types";

// Constants and profiles
export * from "./constants";

// Core utilities
export {
  parseDeviceId,
  getBaseDeviceId,
  parseTerminal,
  normalizeNumericTerminal,
  getAfTerminalSortRank,
  getKaTerminalSortRank,
  getKtTerminalSortRank,
  getXtTerminalSortRank,
  getTerminalSortRankFn,
  resolveOrderingEndpoint,
  determineTargetPrefix,
} from "./device-order-profiles";

// Main ordering functions
export {
  sortRowsByOrderingProfile,
  extractDeviceGroups,
  buildBlueLabelsOrderMap,
  applyDeviceFamilyOrdering,
  isDeviceGroupStart,
  getDeviceGroupLabel,
} from "./apply-device-family-ordering";
