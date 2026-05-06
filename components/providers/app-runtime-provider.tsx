'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  detectInitialAppDataMode,
  type AppDataMode,
} from '@/lib/services/provider-registry'
import {
  DEFAULT_APP_LAUNCH_MODE,
  type AppLaunchMode,
} from '@/lib/runtime/app-mode-types'
import { getProviderIdForMode } from '@/lib/services/service-provider-registry'
import type { AppProviderId } from '@/lib/services/provider-types'
import { getElectronBridge } from '@/lib/services/providers/share-380-electron/bridge'
import type { D380ElectronRuntimeInfo } from '@/types/electron-bridge'

interface AppRuntimeContextValue {
  dataMode: AppDataMode
  isElectron: boolean
  isPackaged: boolean
  platform: NodeJS.Platform | 'browser'
  version: string | null
  providerId: AppProviderId
  appMode: AppLaunchMode
  hasCompletedFirstLaunch: boolean
  isAppModeLoading: boolean
  isLoading: boolean
  isSelectingWorkspace: boolean
  refreshRuntimeInfo: () => Promise<void>
  refreshAppModeSettings: () => Promise<void>
  setAppMode: (nextMode: AppLaunchMode) => Promise<void>
  chooseWorkspaceRoot: () => Promise<string | null>
}

const defaultMode = detectInitialAppDataMode()

const defaultContextValue: AppRuntimeContextValue = {
  dataMode: defaultMode,
  isElectron: defaultMode === 'electron',
  isPackaged: false,
  platform: 'browser',
  version: null,
  providerId: getProviderIdForMode(defaultMode),
  appMode: DEFAULT_APP_LAUNCH_MODE,
  hasCompletedFirstLaunch: false,
  isAppModeLoading: true,
  isLoading: defaultMode === 'electron',
  isSelectingWorkspace: false,
  refreshRuntimeInfo: async () => {},
  refreshAppModeSettings: async () => {},
  setAppMode: async () => {},
  chooseWorkspaceRoot: async () => null,
}

const AppRuntimeContext = createContext<AppRuntimeContextValue>(defaultContextValue)

function buildFallbackRuntimeInfo(dataMode: AppDataMode): D380ElectronRuntimeInfo {
  return {
    isElectron: dataMode === 'electron',
    isPackaged: false,
    platform: 'linux',
    version: null as unknown as string,
  }
}

export function AppRuntimeProvider({ children }: { children: ReactNode }) {
  const [dataMode, setDataMode] = useState<AppDataMode>(defaultMode)
  const [runtimeInfo, setRuntimeInfo] = useState<D380ElectronRuntimeInfo>(buildFallbackRuntimeInfo(defaultMode))
  const [appMode, setAppModeState] = useState<AppLaunchMode>(DEFAULT_APP_LAUNCH_MODE)
  const [hasCompletedFirstLaunch, setHasCompletedFirstLaunch] = useState(false)
  const [isAppModeLoading, setIsAppModeLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(defaultMode === 'electron')
  const [isSelectingWorkspace, setIsSelectingWorkspace] = useState(false)

  const bridge = useMemo(() => getElectronBridge(), [])

  const refreshRuntimeInfo = useCallback(async () => {
    if (!bridge) {
      setDataMode(detectInitialAppDataMode())
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const nextRuntimeInfo = await bridge.getRuntimeInfo()
      setRuntimeInfo(nextRuntimeInfo)
      setDataMode(nextRuntimeInfo.isElectron ? 'electron' : detectInitialAppDataMode())
    } catch (error) {
      console.error('[runtime] Failed to refresh runtime info', error)
      setDataMode(detectInitialAppDataMode())
    } finally {
      setIsLoading(false)
    }
  }, [bridge])

  useEffect(() => {
    void refreshRuntimeInfo()
  }, [refreshRuntimeInfo])

  const refreshAppModeSettings = useCallback(async () => {
    setIsAppModeLoading(true)

    try {
      const response = await fetch('/api/runtime/app-mode', { cache: 'no-store' })
      if (!response.ok) {
        console.warn('[runtime] Failed to load app mode settings — status', response.status)
        setAppModeState(DEFAULT_APP_LAUNCH_MODE)
        setHasCompletedFirstLaunch(false)
        return
      }

      const nextSettings = await response.json() as {
        appMode: AppLaunchMode
        firstLaunchCompleted: boolean
      }

      setAppModeState(nextSettings.appMode)
      setHasCompletedFirstLaunch(nextSettings.firstLaunchCompleted)
    } catch (error) {
      console.error('[runtime] Failed to refresh app mode settings', error)
      setAppModeState(DEFAULT_APP_LAUNCH_MODE)
      setHasCompletedFirstLaunch(false)
    } finally {
      setIsAppModeLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAppModeSettings()
  }, [refreshAppModeSettings])

  const setAppMode = useCallback(async (nextMode: AppLaunchMode) => {
    setIsAppModeLoading(true)

    try {
      const response = await fetch('/api/runtime/app-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appMode: nextMode }),
      })

      if (!response.ok) {
        throw new Error('Failed to save app mode settings')
      }

      const nextSettings = await response.json() as {
        appMode: AppLaunchMode
        firstLaunchCompleted: boolean
      }

      setAppModeState(nextSettings.appMode)
      setHasCompletedFirstLaunch(nextSettings.firstLaunchCompleted)
    } finally {
      setIsAppModeLoading(false)
    }
  }, [])

  const chooseWorkspaceRoot = useCallback(async () => {
    if (!bridge) {
      return null
    }

    setIsSelectingWorkspace(true)

    try {
      const selectedRoot = await bridge.chooseWorkspaceRoot()
      if (!selectedRoot) {
        return null
      }

      return selectedRoot
    } finally {
      setIsSelectingWorkspace(false)
    }
  }, [bridge])

  const value: AppRuntimeContextValue = {
    dataMode,
    isElectron: dataMode === 'electron',
    isPackaged: dataMode === 'electron' ? runtimeInfo.isPackaged : false,
    platform: dataMode === 'electron' ? runtimeInfo.platform : 'browser',
    version: dataMode === 'electron' ? runtimeInfo.version : null,
    providerId: getProviderIdForMode(dataMode),
    appMode,
    hasCompletedFirstLaunch,
    isAppModeLoading,
    isLoading,
    isSelectingWorkspace,
    refreshRuntimeInfo,
    refreshAppModeSettings,
    setAppMode,
    chooseWorkspaceRoot,
  }

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>
}

export function useAppRuntime() {
  return useContext(AppRuntimeContext)
}
