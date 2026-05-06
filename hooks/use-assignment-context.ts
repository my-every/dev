'use client'

/**
 * Assignment Context Hook
 * 
 * Provides assignment context for Build Up, Wiring, and other stage pages.
 * Links the /projects assignment mappings to the /380 execution routes.
 */

import { useMemo } from 'react'
import { useProjectContext } from '@/contexts/project-context'
import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageDefinition, ASSIGNMENT_STAGES } from '@/types/d380-assignment-stages'
import { SWS_TYPE_REGISTRY, type SwsTypeId } from '@/lib/assignment/sws-detection'

/**
 * Assignment context data
 */
export interface AssignmentContextData {
  // Assignment info
  assignment: MappedAssignment | null
  hasAssignment: boolean
  
  // SWS info
  swsType: SwsTypeId | null
  swsLabel: string | null
  swsShortLabel: string | null
  
  // Stage info
  stage: AssignmentStageId | null
  stageLabel: string | null
  stageDescription: string | null
  
  // Detection info
  detectedSwsType: SwsTypeId | null
  detectedConfidence: number | null
  isOverride: boolean
  overrideReason: string | null
  
  // Project info
  projectId: string | null
  projectName: string | null
}

/**
 * Hook to get assignment context for a specific sheet
 */
export function useAssignmentContext(sheetSlug: string): AssignmentContextData {
  const { currentProject, assignmentMappings } = useProjectContext()
  
  return useMemo(() => {
    const assignment = assignmentMappings.find(a => a.sheetSlug === sheetSlug) || null
    
    if (!assignment) {
      return {
        assignment: null,
        hasAssignment: false,
        swsType: null,
        swsLabel: null,
        swsShortLabel: null,
        stage: null,
        stageLabel: null,
        stageDescription: null,
        detectedSwsType: null,
        detectedConfidence: null,
        isOverride: false,
        overrideReason: null,
        projectId: currentProject?.id || null,
        projectName: currentProject?.name || null,
      }
    }
    
    const swsInfo = SWS_TYPE_REGISTRY[assignment.selectedSwsType]
    const stageInfo = getStageDefinition(assignment.selectedStage)
    
    return {
      assignment,
      hasAssignment: true,
      swsType: assignment.selectedSwsType,
      swsLabel: swsInfo?.label || null,
      swsShortLabel: swsInfo?.shortLabel || null,
      stage: assignment.selectedStage,
      stageLabel: stageInfo?.label || null,
      stageDescription: stageInfo?.description || null,
      detectedSwsType: assignment.detectedSwsType,
      detectedConfidence: assignment.detectedConfidence,
      isOverride: assignment.isOverride,
      overrideReason: assignment.overrideReason || null,
      projectId: currentProject?.id || null,
      projectName: currentProject?.name || null,
    }
  }, [sheetSlug, assignmentMappings, currentProject])
}

/**
 * Get assignments filtered by stage
 */
export function useAssignmentsByStage(stage: AssignmentStageId): MappedAssignment[] {
  const { assignmentMappings } = useProjectContext()
  
  return useMemo(() => {
    return assignmentMappings.filter(a => a.selectedStage === stage)
  }, [assignmentMappings, stage])
}

/**
 * Get assignments filtered by SWS type
 */
export function useAssignmentsBySwsType(swsType: SwsTypeId): MappedAssignment[] {
  const { assignmentMappings } = useProjectContext()
  
  return useMemo(() => {
    return assignmentMappings.filter(a => a.selectedSwsType === swsType)
  }, [assignmentMappings, swsType])
}

/**
 * Get counts by stage for summary display
 */
export function useAssignmentStageCounts(): Record<AssignmentStageId, number> {
  const { assignmentMappings } = useProjectContext()
  
  return useMemo(() => {
    const counts = Object.fromEntries(ASSIGNMENT_STAGES.map(s => [s.id, 0])) as Record<AssignmentStageId, number>
    
    for (const assignment of assignmentMappings) {
      counts[assignment.selectedStage]++
    }
    
    return counts
  }, [assignmentMappings])
}
