import type { AppProviderId, Share380Provider } from '@/lib/services/provider-types'
import type { AppDataMode } from '@/lib/services/provider-registry'

const providerPromises = new Map<AppProviderId, Promise<Share380Provider>>()

export function getProviderIdForMode(_mode: AppDataMode): AppProviderId {
  return 'share-380-simulated'
}

export async function resolveServiceProvider(mode: AppDataMode): Promise<Share380Provider> {
  const providerId = getProviderIdForMode(mode)
  const existing = providerPromises.get(providerId)

  if (existing) {
    return existing
  }

  const nextProviderPromise = import('@/lib/services/providers/share-380-simulated')
    .then(module => module.getShare380Provider())

  providerPromises.set(providerId, nextProviderPromise)

  return nextProviderPromise
}
