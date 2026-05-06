/**
 * Wiring Identification Module
 * 
 * This module provides utilities for identifying and filtering wire list patterns
 * such as grounds, jumpers, clips, and twin ferrules.
 */

// Types
export * from "./types";

// Constants
export * from "./constants";

// Device parsing
export * from "./device-parser";

// Blue Labels
export * from "./blue-label-sequence";

// Extractors
export { extractGrounds, countGrounds, getGroundSummary } from "./extract-grounds";
export { extractClips, countClips } from "./extract-clips";
export { extractAfJumpers, countAfJumpers, isSequentialAfFamilyJumper } from "./extract-af-jumpers";
export { extractXtJumpers, countXtJumpers } from "./extract-xt-jumpers";
export { extractXtClips, countXtClips } from "./extract-xt-clips";
export { extractKaJumpers, countKaJumpers } from "./extract-ka-jumpers";
export { 
  extractKaTwinFerrules, 
  countKaTwinFerrules, 
  getKaTwinFerruleGroups,
  groupKaTerminationsByTerminal,
  isValidTwinFerruleGroup,
  type KaTerminationGroup,
  type KaTerminationGroupingResult,
} from "./extract-ka-twin-ferrules";
export { extractKtJumpers, countKtJumpers } from "./extract-kt-jumpers";
export { extractFuJumpers, countFuJumpers } from "./extract-fu-jumpers";
export { extractCables, countCables, isCableType, isCableWireId } from "./extract-cables";
export { extractSingleConnections, extractSingleConnectionsByLocation, countSingleConnections } from "./extract-single-connections";
export { extractVioJumpers, countVioJumpers, isVioJumper } from "./extract-vio-jumpers";
export { extractResistors, countResistors, isResistorWireId, isResistorDevice } from "./extract-resistors";
export { 
  extractKaRelayPluginJumpers,
  extractKaRelayPluginJumperRows,
  countKaRelayPluginJumpers,
  hasRelayPluginJumperRuns,
} from "./extract-ka-relay-plugin-jumpers";

// Presence detection
export * from "./presence-detection";

// Filter registry
export * from "./filter-registry";

// Prefix filter
export * from "./prefix-filter";

// Gauge filter
export * from "./gauge-filter";

// Device change pattern detection (:J -> :P)
export * from "./device-change-pattern";
