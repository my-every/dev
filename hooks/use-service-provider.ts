'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { resolveServiceProvider } from '@/lib/services/service-provider-registry'
import type { Share380Provider } from '@/lib/services/provider-types'

interface UseServiceProviderResult {
  provider: Share380Provider | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<Share380Provider | null>
}

export function useServiceProvider(): UseServiceProviderResult {
  const { dataMode } = useAppRuntime()
  const [provider, setProvider] = useState<Share380Provider | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const nextProvider = await resolveServiceProvider(dataMode)
      setProvider(nextProvider)
      return nextProvider
    } catch (refreshError) {
      const nextError = refreshError instanceof Error ? refreshError : new Error('Failed to resolve service provider')
      setError(nextError)
      setProvider(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [dataMode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    provider,
    isLoading,
    error,
    refresh,
  }
}