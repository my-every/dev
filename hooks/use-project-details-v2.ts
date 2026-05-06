"use client";

import { useCallback, useEffect, useState } from 'react'

import type {
  CreateProjectUnitInput,
  UpdateProjectUnitAssignmentMappingsInput,
  UpdateProjectUnitRevisionInput,
} from '@/lib/services/contracts/project-details-v2-service'
import type {
  ProjectDetailsRecord,
  ProjectValidationFindingRecord,
} from '@/types/d380-project-details'
import { useServiceProvider } from '@/hooks/use-service-provider'

export function useProjectDetailsV2(projectId: string) {
  const { provider, isLoading: providerLoading, error: providerError } = useServiceProvider()
  const [projectRecord, setProjectRecord] = useState<ProjectDetailsRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const loadProjectDetails = useCallback(async () => {
    if (!provider || !projectId) {
      setProjectRecord(null)
      setIsLoading(providerLoading)
      return
    }

    setIsLoading(true)
    const result = await provider.projectDetailsV2.getProjectDetails(projectId)
    setProjectRecord(result.data ?? null)
    setError(result.error)
    setIsLoading(false)
  }, [projectId, provider, providerLoading])

  useEffect(() => {
    if (!provider) {
      setIsLoading(providerLoading)
      return
    }

    void loadProjectDetails()
  }, [loadProjectDetails, provider, providerLoading])

  const createUnit = useCallback(async (input?: CreateProjectUnitInput) => {
    if (!provider) return null
    setIsMutating(true)
    const result = await provider.projectDetailsV2.createUnit(projectId, input)
    await loadProjectDetails()
    setIsMutating(false)
    return result
  }, [loadProjectDetails, projectId, provider])

  const switchUnit = useCallback(async (unitId: string) => {
    if (!provider) return null
    setIsMutating(true)
    const result = await provider.projectDetailsV2.switchUnit(projectId, unitId)
    setProjectRecord(result.data ?? null)
    setError(result.error)
    setIsMutating(false)
    return result
  }, [projectId, provider])

  const updateUnitRevision = useCallback(async (unitId: string, input: UpdateProjectUnitRevisionInput) => {
    if (!provider) return null
    setIsMutating(true)
    const result = await provider.projectDetailsV2.updateUnitRevision(projectId, unitId, input)
    setProjectRecord(result.data ?? null)
    setError(result.error)
    setIsMutating(false)
    return result
  }, [projectId, provider])

  const acknowledgeValidationFinding = useCallback(async (unitId: string, findingId: string) => {
    if (!provider) return null
    setIsMutating(true)
    const result = await provider.projectDetailsV2.acknowledgeValidationFinding(projectId, unitId, findingId)
    await loadProjectDetails()
    setIsMutating(false)
    return result as { data: ProjectValidationFindingRecord | null; error: string | null } | null
  }, [loadProjectDetails, projectId, provider])

  const updateUnitAssignmentMappings = useCallback(async (unitId: string, input: UpdateProjectUnitAssignmentMappingsInput) => {
    if (!provider) return null
    setIsMutating(true)
    const result = await provider.projectDetailsV2.updateUnitAssignmentMappings(projectId, unitId, input)
    setProjectRecord(result.data ?? null)
    setError(result.error)
    setIsMutating(false)
    return result
  }, [projectId, provider])

  return {
    isLoading: providerLoading || isLoading,
    isMutating,
    error: error ?? providerError?.message ?? null,
    projectRecord,
    sourceMode: provider ? 'provider-service' as const : 'unresolved-provider' as const,
    refresh: loadProjectDetails,
    createUnit,
    switchUnit,
    updateUnitRevision,
    updateUnitAssignmentMappings,
    acknowledgeValidationFinding,
  }
}