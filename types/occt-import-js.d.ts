declare module "occt-import-js" {
  interface OcctImportModuleOptions {
    locateFile?: (path: string) => string
  }

  interface OcctImportResult {
    success: boolean
    root?: unknown
    meshes?: unknown[]
  }

  interface OcctImportModule {
    ReadStepFile: (content: Uint8Array, params: unknown) => OcctImportResult
  }

  const createOcctImportModule: (options?: OcctImportModuleOptions) => Promise<OcctImportModule>

  export default createOcctImportModule
}
