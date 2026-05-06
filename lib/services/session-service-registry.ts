import type { ISessionService } from '@/lib/services/contracts/session-service'
import type { AppDataMode } from '@/lib/services/provider-registry'
import { resolveServiceProvider } from '@/lib/services/service-provider-registry'

export async function getSessionService(mode: AppDataMode): Promise<ISessionService> {
  const provider = await resolveServiceProvider(mode)
  return provider.session
}