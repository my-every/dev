/**
 * SWS (Standard Work Sheet) Library
 * 
 * Template registry and utilities for SWS worksheet management.
 */

// Template registry
export { SWS_TEMPLATE_REGISTRY, getSwsTemplate, getSwsTemplatesByCategory } from './sws-template-registry'

// Auto-detection
export { autoDetectSwsType, type SwsDetectionContext } from './sws-auto-detect'

// Assignment-driven schema generation
export {
  generateSwsAssignmentTaskSchema,
  generateSwsSchemasForManifest,
  type GeneratedSwsAssignmentTaskSchema,
} from './sws-assignment-task-generator'

// ============================================================================
// SWS DATA EXPORTS
// ============================================================================

// Panel Build & Wire (standard console/panel assembly)
export { PANEL_BUILD_WIRE_SWS, createFreshSwsCopy, DISCREPANCY_CODES } from './panel-build-wire-sws-data'

// Box Build (enclosure/junction box assembly)
export { BOX_BUILD_SWS, createFreshBoxBuildSwsCopy } from './box-build-sws-data'

// Box Wire (junction box wiring)
export { BOX_WIRE_SWS, createFreshBoxWireSwsCopy } from './box-wire-sws-data'

// Console Build & Hang (console frame assembly and panel hanging)
export { CONSOLE_BUILD_HANG_SWS, createFreshConsoleBuildHangSwsCopy } from './console-build-hang-sws-data'

// Console Cross-Wire (inter-panel wiring in console)
export { CONSOLE_CROSS_WIRE_SWS, createFreshConsoleCrossWireSwsCopy } from './console-cross-wire-sws-data'

// Rail Build & Wire (DIN rail assemblies)
export { RAIL_BUILD_WIRE_SWS, createFreshRailBuildWireSwsCopy } from './rail-build-wire-sws-data'

// Component / Sub-Assembly (small component assemblies)
export { COMPONENT_SUBASSEMBLY_SWS, createFreshComponentSubAssemblySwsCopy } from './component-subassembly-sws-data'

// Basic / Blank (generic template for custom work)
export { BASIC_BLANK_SWS, createFreshBasicBlankSwsCopy } from './basic-blank-sws-data'

// ============================================================================
// SWS TYPE HELPERS
// ============================================================================

import { PANEL_BUILD_WIRE_SWS } from './panel-build-wire-sws-data'
import { BOX_BUILD_SWS } from './box-build-sws-data'
import { BOX_WIRE_SWS } from './box-wire-sws-data'
import { CONSOLE_BUILD_HANG_SWS } from './console-build-hang-sws-data'
import { CONSOLE_CROSS_WIRE_SWS } from './console-cross-wire-sws-data'
import { RAIL_BUILD_WIRE_SWS } from './rail-build-wire-sws-data'
import { COMPONENT_SUBASSEMBLY_SWS } from './component-subassembly-sws-data'
import { BASIC_BLANK_SWS } from './basic-blank-sws-data'
import type { SwsSection } from '@/components/d380/sws/sws-work-execution-table'

export type SwsDataTemplateType = 
  | 'PANEL_BUILD_WIRE'
  | 'BOX_BUILD'
  | 'BOX_WIRE'
  | 'CONSOLE_BUILD_HANG'
  | 'CONSOLE_CROSS_WIRE'
  | 'RAIL_BUILD_WIRE'
  | 'COMPONENT_SUBASSEMBLY'
  | 'BASIC_BLANK'

/**
 * Get SWS data for a specific template type
 */
export function getSwsDataByType(type: SwsDataTemplateType): SwsSection[] {
  const dataMap: Record<SwsDataTemplateType, SwsSection[]> = {
    PANEL_BUILD_WIRE: PANEL_BUILD_WIRE_SWS,
    BOX_BUILD: BOX_BUILD_SWS,
    BOX_WIRE: BOX_WIRE_SWS,
    CONSOLE_BUILD_HANG: CONSOLE_BUILD_HANG_SWS,
    CONSOLE_CROSS_WIRE: CONSOLE_CROSS_WIRE_SWS,
    RAIL_BUILD_WIRE: RAIL_BUILD_WIRE_SWS,
    COMPONENT_SUBASSEMBLY: COMPONENT_SUBASSEMBLY_SWS,
    BASIC_BLANK: BASIC_BLANK_SWS,
  }
  
  // Return a fresh copy to avoid mutations
  return JSON.parse(JSON.stringify(dataMap[type] || BASIC_BLANK_SWS))
}

/**
 * Template metadata for UI display
 */
export const SWS_DATA_TEMPLATE_METADATA: Record<SwsDataTemplateType, { 
  label: string
  description: string
  phases: ('build-up' | 'wiring' | 'ipv')[]
  estimatedTime: string
}> = {
  PANEL_BUILD_WIRE: {
    label: 'Panel Build & Wire',
    description: 'Standard console/panel assembly and wiring',
    phases: ['build-up', 'wiring'],
    estimatedTime: '4-8 hours',
  },
  BOX_BUILD: {
    label: 'Box Build',
    description: 'Enclosure/junction box assembly',
    phases: ['build-up'],
    estimatedTime: '1-2 hours',
  },
  BOX_WIRE: {
    label: 'Box Wire',
    description: 'Junction box internal wiring',
    phases: ['wiring'],
    estimatedTime: '2-4 hours',
  },
  CONSOLE_BUILD_HANG: {
    label: 'Console Build & Hang',
    description: 'Console frame assembly and panel hanging',
    phases: ['build-up'],
    estimatedTime: '2-4 hours',
  },
  CONSOLE_CROSS_WIRE: {
    label: 'Console Cross-Wire',
    description: 'Inter-panel wiring in console',
    phases: ['wiring'],
    estimatedTime: '4-8 hours',
  },
  RAIL_BUILD_WIRE: {
    label: 'Rail Build & Wire',
    description: 'DIN rail assembly and wiring',
    phases: ['build-up', 'wiring'],
    estimatedTime: '1-3 hours',
  },
  COMPONENT_SUBASSEMBLY: {
    label: 'Component Sub-Assembly',
    description: 'Small component assemblies',
    phases: ['build-up'],
    estimatedTime: '30min - 2 hours',
  },
  BASIC_BLANK: {
    label: 'Basic / Custom',
    description: 'Generic template for custom work',
    phases: ['build-up'],
    estimatedTime: 'Varies',
  },
}
