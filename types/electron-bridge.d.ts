export interface D380ElectronRuntimeInfo {
  isElectron: boolean
  isPackaged: boolean
  platform: NodeJS.Platform
  version: string
}

export interface D380ElectronBridge {
  getRuntimeInfo(): Promise<D380ElectronRuntimeInfo>
  chooseWorkspaceRoot(): Promise<string | null>
}

declare global {
  interface Window {
    d380Electron?: D380ElectronBridge
  }
}

export { }
