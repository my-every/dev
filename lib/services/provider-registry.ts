import { isElectronRuntimeAvailable } from '@/lib/services/providers/share-380-electron/bridge'

export type AppDataMode = 'mock' | 'share' | 'electron'

function normalizeEnvMode(value: string | undefined): AppDataMode | null {
  if (value === 'mock' || value === 'share' || value === 'electron') {
    return value
  }

  return null
}

export function detectInitialAppDataMode(): AppDataMode {
  if (isElectronRuntimeAvailable()) {
    return 'electron'
  }

  const envMode = normalizeEnvMode(process.env.NEXT_PUBLIC_DATA_MODE)
  if (envMode) {
    return envMode
  }

  return process.env.NODE_ENV === 'development' ? 'mock' : 'share'
}