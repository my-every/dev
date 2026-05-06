import { contextBridge, ipcRenderer } from 'electron'

import type {
  D380ElectronBridge,
  D380ElectronRuntimeInfo,
} from '../../types/electron-bridge'

const bridge: D380ElectronBridge = {
  getRuntimeInfo(): Promise<D380ElectronRuntimeInfo> {
    return ipcRenderer.invoke('d380:get-runtime-info')
  },
  chooseWorkspaceRoot(): Promise<string | null> {
    return ipcRenderer.invoke('d380:choose-workspace-root')
  },
}

contextBridge.exposeInMainWorld('d380Electron', bridge)
