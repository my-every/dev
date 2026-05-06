import { z } from 'zod'

/**
 * Zod enum for SWS type detection/selection.
 * Includes both legacy values (for backward compat with existing data)
 * and the new canonical SwsTypeId values.
 */
const swsTypeEnum = z.enum([
  // New canonical values
  'PANEL', 'BLANK_PANEL', 'RAIL_BUILD', 'COMPONENT_BUILD', 'BOX_BUILD', 'WIRING_ONLY', 'UNDECIDED',
  // Legacy values (accepted on read, migrated on write)
  'BLANK', 'RAIL', 'BOX', 'COMPONENT',
])

/**
 * Zod enum for per-assignment stage IDs.
 */
const assignmentStageEnum = z.enum([
  'BUILD_UP',
  'WIRING',
  'WIRING_IPV',
  'BOX_BUILD',
  'CROSS_WIRE',
  'CROSS_WIRE_IPV',
  'TEST_1ST_PASS',
  'POWER_CHECK',
  'BIQ',
  'FINISHED_BIQ',
])

export const mappedAssignmentSchema = z.object({
  sheetSlug: z.string().min(1),
  sheetName: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  sheetKind: z.enum(['assignment', 'reference', 'other']),
  detectedSwsType: swsTypeEnum,
  detectedConfidence: z.number().min(0).max(100),
  detectedReasons: z.array(z.string()),
  selectedSwsType: swsTypeEnum,
  selectedStage: assignmentStageEnum,
  selectedStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'INCOMPLETE', 'COMPLETE']),
  overrideReason: z.string(),
  isOverride: z.boolean(),
  requiresWireSws: z.boolean(),
  requiresCrossWireSws: z.boolean(),
  matchedLayoutPage: z.number().int().positive().optional(),
  matchedLayoutTitle: z.string().optional(),
}).strict()

export const mappedAssignmentArraySchema = z.array(mappedAssignmentSchema)

export type MappedAssignment = z.infer<typeof mappedAssignmentSchema>