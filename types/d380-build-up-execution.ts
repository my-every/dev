/**
 * Build Up Execution Types
 * 
 * Defines the data model for tracking Build Up stage execution.
 * Each BUILD_UP assignment is broken into sections with step-level tracking,
 * shift/member attribution, and timestamps for IPV compliance.
 */

// ============================================================================
// SHIFT TYPES
// ============================================================================

/**
 * Work shift type for member tracking.
 */
export type WorkShift = 'day' | 'night' | 'swing'

/**
 * Member participation record for a section.
 */
export interface BuildUpMemberRecord {
  badgeId: string
  name: string
  shift: WorkShift
  startedAt: string // ISO timestamp
  endedAt?: string  // ISO timestamp (set when another member takes over or section completes)
}

// ============================================================================
// STEP EXECUTION
// ============================================================================

/**
 * Execution tracking for a single step within a section.
 */
export interface BuildUpStepExecution {
  /** Stable step identifier */
  id: string
  
  /** Display label for the step */
  label: string
  
  /** Optional description/instructions */
  description?: string
  
  /** Whether this step is completed */
  completed: boolean
  
  /** Timestamp when completed */
  completedAt?: string
  
  /** Who completed this step */
  completedBy?: {
    badgeId: string
    name: string
  }
}

// ============================================================================
// SECTION EXECUTION
// ============================================================================

/**
 * Section status in the execution flow.
 */
export type BuildUpSectionStatus = 'pending' | 'in_progress' | 'completed'

/**
 * Execution tracking for a section within Build Up.
 */
export interface BuildUpSectionExecution {
  /** Stable section identifier */
  id: string
  
  /** Key for rehydration (matches section definition) */
  sectionKey: string
  
  /** Display title */
  title: string
  
  /** Order in the section list */
  order: number
  
  /** Steps within this section */
  steps: BuildUpStepExecution[]
  
  /** When this section was started */
  startedAt?: string
  
  /** When this section was completed */
  completedAt?: string
  
  /** Members who worked on this section (with shift tracking) */
  members: BuildUpMemberRecord[]
  
  /** Current section status */
  status: BuildUpSectionStatus
  
  /** Optional notes for this section */
  notes?: string
}

// ============================================================================
// SESSION EXECUTION
// ============================================================================

/**
 * Session status for the overall Build Up execution.
 */
export type BuildUpSessionStatus = 'not_started' | 'in_progress' | 'completed'

/**
 * Complete Build Up execution session for an assignment.
 */
export interface BuildUpExecutionSession {
  /** Unique session identifier */
  id: string
  
  /** Assignment this session belongs to */
  assignmentId: string
  
  /** Project this session belongs to */
  projectId: string
  
  /** When the session was started */
  startedAt: string
  
  /** When the session was completed */
  completedAt?: string
  
  /** Who started the session */
  startedBy: {
    badgeId: string
    name: string
  }
  
  /** All sections in this session */
  sections: BuildUpSectionExecution[]
  
  /** Currently active section (for resume) */
  currentSectionId?: string
  
  /** Overall session status */
  status: BuildUpSessionStatus
  
  /** Last activity timestamp (for idle detection) */
  lastActivityAt: string
  
  /** Last member who worked on this session */
  lastMember?: {
    badgeId: string
    name: string
    shift: WorkShift
  }
}

// ============================================================================
// SECTION DEFINITIONS BY SWS TYPE
// ============================================================================

/**
 * Definition for a section (used to generate execution sections).
 */
export interface BuildUpSectionDefinition {
  /** Stable section key */
  key: string
  
  /** Display title */
  title: string
  
  /** Section description */
  description?: string
  
  /** Step definitions for this section */
  steps: BuildUpStepDefinition[]
  
  /** Order in the section list */
  order: number
  
  /** Whether this section is required */
  required: boolean
  
  /** Estimated time in minutes */
  estimatedMinutes?: number
}

/**
 * Definition for a step within a section.
 */
export interface BuildUpStepDefinition {
  /** Stable step key */
  key: string
  
  /** Display label */
  label: string
  
  /** Optional description */
  description?: string
  
  /** Whether this step is required */
  required: boolean
}

// ============================================================================
// SWS TYPE TO SECTION MAPPING
// ============================================================================

/**
 * SWS types that support Build Up execution.
 * Maps to the simplified assignment SWS classification used by build-up flows
 */
export type BuildUpSwsType = 'PANEL' | 'RAIL' | 'BOX' | 'COMPONENT' | 'BLANK'

/**
 * Section definitions by SWS type.
 */
export const BUILD_UP_SECTIONS: Record<BuildUpSwsType, BuildUpSectionDefinition[]> = {
  PANEL: [
    {
      key: 'mount_rails',
      title: 'Mount Rails',
      description: 'Install DIN rails and mounting hardware',
      order: 1,
      required: true,
      estimatedMinutes: 30,
      steps: [
        { key: 'verify_rail_qty', label: 'Verify rail quantity per drawing', required: true },
        { key: 'position_rails', label: 'Position rails per layout', required: true },
        { key: 'secure_rails', label: 'Secure rails with proper hardware', required: true },
        { key: 'torque_verify', label: 'Verify torque on all fasteners', required: true },
      ],
    },
    {
      key: 'install_panduct',
      title: 'Install Panduct',
      description: 'Install wire duct/panduct channels',
      order: 2,
      required: true,
      estimatedMinutes: 25,
      steps: [
        { key: 'verify_panduct_qty', label: 'Verify panduct quantity and sizes', required: true },
        { key: 'cut_panduct', label: 'Cut panduct to required lengths', required: true },
        { key: 'mount_panduct', label: 'Mount panduct per layout', required: true },
        { key: 'secure_covers', label: 'Verify cover fit (do not snap yet)', required: false },
      ],
    },
    {
      key: 'install_terminal_blocks',
      title: 'Install Terminal Blocks',
      description: 'Install terminal blocks and markers',
      order: 3,
      required: true,
      estimatedMinutes: 45,
      steps: [
        { key: 'verify_tb_qty', label: 'Verify terminal block quantity', required: true },
        { key: 'install_end_brackets', label: 'Install end brackets', required: true },
        { key: 'mount_terminals', label: 'Mount terminals per sequence', required: true },
        { key: 'install_markers', label: 'Install terminal markers', required: true },
        { key: 'verify_sequence', label: 'Verify terminal sequence', required: true },
      ],
    },
    {
      key: 'install_components',
      title: 'Install Components',
      description: 'Install relays, fuses, and other components',
      order: 4,
      required: true,
      estimatedMinutes: 60,
      steps: [
        { key: 'verify_bom', label: 'Verify component BOM', required: true },
        { key: 'install_relays', label: 'Install relays (KA prefix)', required: false },
        { key: 'install_fuses', label: 'Install fuses (FU prefix)', required: false },
        { key: 'install_misc', label: 'Install misc components', required: false },
        { key: 'verify_placement', label: 'Verify component placement', required: true },
        { key: 'verify_labels', label: 'Verify component labels', required: true },
      ],
    },
    {
      key: 'grounding',
      title: 'Grounding',
      description: 'Install grounding connections',
      order: 5,
      required: true,
      estimatedMinutes: 20,
      steps: [
        { key: 'install_ground_bar', label: 'Install ground bar', required: true },
        { key: 'connect_grounds', label: 'Connect component grounds', required: true },
        { key: 'verify_continuity', label: 'Verify ground continuity', required: true },
      ],
    },
    {
      key: 'hardware_check',
      title: 'Hardware Check',
      description: 'Final hardware verification',
      order: 6,
      required: true,
      estimatedMinutes: 15,
      steps: [
        { key: 'torque_all', label: 'Verify all torque values', required: true },
        { key: 'visual_inspection', label: 'Visual inspection complete', required: true },
        { key: 'cleanup', label: 'Clean work area', required: true },
      ],
    },
  ],
  
  RAIL: [
    {
      key: 'rail_prep',
      title: 'Rail Prep',
      description: 'Prepare rail assembly',
      order: 1,
      required: true,
      estimatedMinutes: 15,
      steps: [
        { key: 'verify_rail_type', label: 'Verify rail type and length', required: true },
        { key: 'clean_rail', label: 'Clean rail surface', required: true },
        { key: 'install_end_stops', label: 'Install end stops', required: true },
      ],
    },
    {
      key: 'terminal_install',
      title: 'Terminal Install',
      description: 'Install terminal blocks on rail',
      order: 2,
      required: true,
      estimatedMinutes: 30,
      steps: [
        { key: 'verify_terminal_qty', label: 'Verify terminal quantity', required: true },
        { key: 'mount_terminals', label: 'Mount terminals per sequence', required: true },
        { key: 'install_markers', label: 'Install terminal markers', required: true },
        { key: 'verify_alignment', label: 'Verify terminal alignment', required: true },
      ],
    },
    {
      key: 'jumper_install',
      title: 'Jumper Install',
      description: 'Install jumpers between terminals',
      order: 3,
      required: false,
      estimatedMinutes: 20,
      steps: [
        { key: 'identify_jumpers', label: 'Identify jumper requirements', required: true },
        { key: 'install_jumpers', label: 'Install jumper bars', required: true },
        { key: 'verify_connections', label: 'Verify jumper connections', required: true },
      ],
    },
    {
      key: 'ground_install',
      title: 'Ground Install',
      description: 'Install grounding for rail',
      order: 4,
      required: true,
      estimatedMinutes: 10,
      steps: [
        { key: 'install_ground_terminal', label: 'Install ground terminal', required: true },
        { key: 'verify_ground', label: 'Verify ground connection', required: true },
      ],
    },
  ],
  
  BOX: [
    {
      key: 'enclosure_prep',
      title: 'Enclosure Prep',
      description: 'Prepare enclosure for assembly',
      order: 1,
      required: true,
      estimatedMinutes: 20,
      steps: [
        { key: 'verify_enclosure', label: 'Verify enclosure type/size', required: true },
        { key: 'inspect_enclosure', label: 'Inspect for damage', required: true },
        { key: 'clean_enclosure', label: 'Clean enclosure interior', required: true },
        { key: 'mark_mounting', label: 'Mark mounting locations', required: true },
      ],
    },
    {
      key: 'rail_mounting',
      title: 'Rail Mounting',
      description: 'Mount rails in enclosure',
      order: 2,
      required: true,
      estimatedMinutes: 30,
      steps: [
        { key: 'position_rails', label: 'Position rails per layout', required: true },
        { key: 'drill_mount_holes', label: 'Drill mounting holes if needed', required: false },
        { key: 'secure_rails', label: 'Secure rails with hardware', required: true },
        { key: 'verify_level', label: 'Verify rails are level', required: true },
      ],
    },
    {
      key: 'door_prep',
      title: 'Door Prep',
      description: 'Prepare door assembly',
      order: 3,
      required: false,
      estimatedMinutes: 25,
      steps: [
        { key: 'verify_door_components', label: 'Verify door components', required: true },
        { key: 'install_door_hardware', label: 'Install door hardware', required: true },
        { key: 'test_door_operation', label: 'Test door operation', required: true },
      ],
    },
    {
      key: 'labeling',
      title: 'Labeling',
      description: 'Apply enclosure labels',
      order: 4,
      required: true,
      estimatedMinutes: 15,
      steps: [
        { key: 'apply_nameplate', label: 'Apply nameplate', required: true },
        { key: 'apply_warning_labels', label: 'Apply warning labels', required: true },
        { key: 'verify_labels', label: 'Verify label placement', required: true },
      ],
    },
  ],
  
  COMPONENT: [
    {
      key: 'device_mounting',
      title: 'Device Mounting',
      description: 'Mount device to substrate',
      order: 1,
      required: true,
      estimatedMinutes: 20,
      steps: [
        { key: 'verify_device', label: 'Verify device part number', required: true },
        { key: 'prep_mounting', label: 'Prepare mounting surface', required: true },
        { key: 'mount_device', label: 'Mount device per spec', required: true },
        { key: 'secure_device', label: 'Secure with proper hardware', required: true },
      ],
    },
    {
      key: 'terminal_prep',
      title: 'Terminal Prep',
      description: 'Prepare terminals for wiring',
      order: 2,
      required: true,
      estimatedMinutes: 15,
      steps: [
        { key: 'identify_terminals', label: 'Identify terminal points', required: true },
        { key: 'install_markers', label: 'Install terminal markers', required: true },
        { key: 'verify_clearance', label: 'Verify wire clearance', required: true },
      ],
    },
    {
      key: 'prewire_prep',
      title: 'Pre-Wire Prep',
      description: 'Prepare for wiring stage',
      order: 3,
      required: true,
      estimatedMinutes: 10,
      steps: [
        { key: 'route_planning', label: 'Plan wire routing', required: true },
        { key: 'label_check', label: 'Verify all labels in place', required: true },
        { key: 'ready_for_wire', label: 'Mark ready for wiring', required: true },
      ],
    },
  ],
  
  BLANK: [
    {
      key: 'blank_prep',
      title: 'Blank Panel Prep',
      description: 'Prepare blank/basic panel',
      order: 1,
      required: true,
      estimatedMinutes: 15,
      steps: [
        { key: 'verify_panel_type', label: 'Verify panel type', required: true },
        { key: 'inspect_panel', label: 'Inspect panel surface', required: true },
        { key: 'mark_layout', label: 'Mark layout positions', required: true },
      ],
    },
    {
      key: 'basic_mounting',
      title: 'Basic Mounting',
      description: 'Install basic components',
      order: 2,
      required: true,
      estimatedMinutes: 30,
      steps: [
        { key: 'install_rail', label: 'Install DIN rail', required: true },
        { key: 'install_terminals', label: 'Install terminal blocks', required: true },
        { key: 'install_markers', label: 'Install markers', required: true },
      ],
    },
    {
      key: 'final_check',
      title: 'Final Check',
      description: 'Final verification',
      order: 3,
      required: true,
      estimatedMinutes: 10,
      steps: [
        { key: 'visual_check', label: 'Visual inspection', required: true },
        { key: 'hardware_check', label: 'Hardware torque check', required: true },
      ],
    },
  ],
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get section definitions for an SWS type.
 */
export function getSectionDefinitionsForSwsType(swsType: string): BuildUpSectionDefinition[] {
  // Map the full assignment SWS classification to BuildUpSwsType
  const typeMap: Record<string, BuildUpSwsType> = {
    'PANEL': 'PANEL',
    'PANEL_BUILD_WIRE': 'PANEL',
    'PANEL_BUILD_WIRE': 'PANEL',
    'RAIL': 'RAIL',
    'BOX': 'BOX',
    'BOX_BUILD_UP': 'BOX',
    'COMPONENT': 'COMPONENT',
    'BLANK': 'BLANK',
    'BASIC_BLANK_PANEL': 'BLANK',
    'CONSOLE_BUILD_UP_PANEL_HANG': 'PANEL',
  }
  
  const buildUpType = typeMap[swsType] || 'PANEL' // Default to PANEL
  return BUILD_UP_SECTIONS[buildUpType]
}

/**
 * Generate stable section ID from assignment and section key.
 */
export function generateSectionId(assignmentId: string, sectionKey: string): string {
  return `${assignmentId}_${sectionKey}`
}

/**
 * Generate stable step ID from section ID and step key.
 */
export function generateStepId(sectionId: string, stepKey: string): string {
  return `${sectionId}_${stepKey}`
}

/**
 * Create a new execution session from section definitions.
 */
export function createExecutionSession(
  assignmentId: string,
  projectId: string,
  swsType: string,
  startedBy: { badgeId: string; name: string }
): BuildUpExecutionSession {
  const now = new Date().toISOString()
  const sessionId = `session_${assignmentId}_${Date.now()}`
  const definitions = getSectionDefinitionsForSwsType(swsType)
  
  const sections: BuildUpSectionExecution[] = definitions.map((def) => {
    const sectionId = generateSectionId(assignmentId, def.key)
    return {
      id: sectionId,
      sectionKey: def.key,
      title: def.title,
      order: def.order,
      steps: def.steps.map((stepDef) => ({
        id: generateStepId(sectionId, stepDef.key),
        label: stepDef.label,
        description: stepDef.description,
        completed: false,
      })),
      members: [],
      status: 'pending' as BuildUpSectionStatus,
    }
  })
  
  return {
    id: sessionId,
    assignmentId,
    projectId,
    startedAt: now,
    startedBy,
    sections,
    currentSectionId: sections[0]?.id,
    status: 'in_progress',
    lastActivityAt: now,
    lastMember: undefined,
  }
}

/**
 * Check if a session is complete (all required sections done).
 */
export function isSessionComplete(session: BuildUpExecutionSession): boolean {
  return session.sections.every(s => s.status === 'completed')
}

/**
 * Calculate session progress percentage.
 */
export function calculateSessionProgress(session: BuildUpExecutionSession): number {
  const totalSteps = session.sections.reduce((sum, s) => sum + s.steps.length, 0)
  if (totalSteps === 0) return 0
  
  const completedSteps = session.sections.reduce(
    (sum, s) => sum + s.steps.filter(step => step.completed).length,
    0
  )
  
  return Math.round((completedSteps / totalSteps) * 100)
}

/**
 * Get the next incomplete section.
 */
export function getNextIncompleteSection(session: BuildUpExecutionSession): BuildUpSectionExecution | undefined {
  return session.sections.find(s => s.status !== 'completed')
}
