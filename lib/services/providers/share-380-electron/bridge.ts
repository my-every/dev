import type { D380ElectronBridge } from '@/types/electron-bridge'

export function getElectronBridge(): D380ElectronBridge | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.d380Electron ?? null
}

export function isElectronRuntimeAvailable(): boolean {
  return getElectronBridge() !== null
}