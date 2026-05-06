#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const rootDir = process.cwd()
const standaloneNodeModulesDirs = [
  path.join(rootDir, '.next', 'standalone', 'node_modules'),
  path.join(rootDir, '.next', 'standalone', '.next', 'node_modules'),
]

const standaloneRoot = path.join(rootDir, '.next', 'standalone')

function normalizePathForMatch(inputPath) {
  return inputPath.replace(/\\/g, '/')
}

function isWithinPackagedElectronTree(entryPath) {
  const normalized = normalizePathForMatch(entryPath)
  return normalized.includes('/node_modules/.pnpm/electron@')
}

function isWithinKnownNonRuntimeTree(entryPath) {
  const normalized = normalizePathForMatch(entryPath)

  // Electron package internals are not needed by the Next standalone server.
  if (normalized.includes('/node_modules/.pnpm/electron@')) {
    return true
  }

  // Browser binaries are test/runtime tooling assets and not part of the app server runtime.
  if (normalized.includes('/node_modules/.pnpm/playwright-core@') && normalized.includes('/node_modules/playwright-core/.local-browsers')) {
    return true
  }

  if (normalized.includes('/node_modules/.pnpm/playwright@') && normalized.includes('/node_modules/playwright/.local-browsers')) {
    return true
  }

  return false
}

function resolveFallbackPnpmTarget(linkPath) {
  // Example link path:
  //   <standalone>/node_modules/.pnpm/node_modules/semver
  // We attempt to locate any matching package folder under:
  //   <standalone>/node_modules/.pnpm/<pkg@version>/node_modules/semver
  const pnpmNodeModulesRoot = path.join(path.dirname(path.dirname(linkPath)), 'node_modules')
  const pnpmStoreRoot = path.dirname(pnpmNodeModulesRoot)

  if (!fs.existsSync(pnpmStoreRoot) || !fs.existsSync(pnpmNodeModulesRoot)) {
    return null
  }

  const packageRelativePath = path.relative(pnpmNodeModulesRoot, linkPath)
  if (!packageRelativePath || packageRelativePath.startsWith('..')) {
    return null
  }

  const storeEntries = fs
    .readdirSync(pnpmStoreRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('node_modules'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

  for (const entryName of storeEntries) {
    const candidate = path.join(pnpmStoreRoot, entryName, 'node_modules', packageRelativePath)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function materializeSymlink(linkPath) {
  const stat = fs.lstatSync(linkPath)
  if (!stat.isSymbolicLink()) {
    return { materialized: false, skipped: false }
  }

  const linkTarget = fs.readlinkSync(linkPath)
  const absoluteTarget = path.resolve(path.dirname(linkPath), linkTarget)
  const resolvedTarget = fs.existsSync(absoluteTarget)
    ? absoluteTarget
    : resolveFallbackPnpmTarget(linkPath)

  const removeEntry = (entryPath) => {
    let entryStat
    try {
      entryStat = fs.lstatSync(entryPath)
    } catch {
      return
    }
    if (entryStat.isSymbolicLink()) {
      fs.unlinkSync(entryPath)
      return
    }

    fs.rmSync(entryPath, { force: true, recursive: true })
  }

  if (!resolvedTarget) {
    removeEntry(linkPath)
    console.warn(`[materialize-standalone-symlinks] Removed broken symlink: ${linkPath} -> ${linkTarget}`)
    return { materialized: false, skipped: true }
  }

  try {
    removeEntry(linkPath)
    fs.mkdirSync(linkPath, { recursive: true })
    for (const entry of fs.readdirSync(resolvedTarget)) {
      const sourceEntry = path.join(resolvedTarget, entry)
      const destEntry = path.join(linkPath, entry)
      fs.cpSync(sourceEntry, destEntry, {
        recursive: true,
        force: true,
        errorOnExist: false,
        dereference: true,
      })
    }
    return { materialized: true, skipped: false }
  } catch (error) {
    removeEntry(linkPath)
    console.warn(`[materialize-standalone-symlinks] Failed to materialize ${linkPath}; removed unresolved link.`, error)
    return { materialized: false, skipped: true }
  }
}

function materializeSymlinksInTree(directory) {
  if (!fs.existsSync(directory)) {
    console.log(`[materialize-standalone-symlinks] Missing ${directory}, skipping.`)
    return 0
  }

  let materializedCount = 0
  let skippedCount = 0
  const entries = fs.readdirSync(directory)

  for (const entry of entries) {
    const entryPath = path.join(directory, entry)

    if (isWithinPackagedElectronTree(entryPath) || isWithinKnownNonRuntimeTree(entryPath)) {
      continue
    }

    const stat = fs.lstatSync(entryPath)

    if (stat.isSymbolicLink()) {
      const result = materializeSymlink(entryPath)
      if (result.materialized) {
        materializedCount += 1
      }
      if (result.skipped) {
        skippedCount += 1
      }
      continue
    }

    if (stat.isDirectory()) {
      const nested = materializeSymlinksInTree(entryPath)
      materializedCount += nested.materializedCount
      skippedCount += nested.skippedCount
    }
  }

  return { materializedCount, skippedCount }
}

function readPackageJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function ensureExternalizedDependenciesFromVirtualStore() {
  const virtualNodeModulesDir = path.join(standaloneRoot, 'node_modules', '.pnpm', 'node_modules')
  const externalizedNodeModulesDir = path.join(standaloneRoot, '.next', 'node_modules')

  if (!fs.existsSync(virtualNodeModulesDir) || !fs.existsSync(externalizedNodeModulesDir)) {
    return 0
  }

  let ensuredCount = 0
  const externalizedEntries = fs.readdirSync(externalizedNodeModulesDir, { withFileTypes: true })

  for (const entry of externalizedEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageJsonPath = path.join(externalizedNodeModulesDir, entry.name, 'package.json')
    const packageJson = readPackageJson(packageJsonPath)
    if (!packageJson) {
      continue
    }

    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
    ]

    for (const dependencyName of dependencyNames) {
      const sourcePath = path.join(virtualNodeModulesDir, dependencyName)
      const targetPath = path.join(externalizedNodeModulesDir, dependencyName)

      if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
        continue
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.cpSync(sourcePath, targetPath, {
        recursive: true,
        force: true,
        errorOnExist: false,
        dereference: true,
      })
      ensuredCount += 1
    }
  }

  return ensuredCount
}

function main() {
  let materializedCount = 0
  let skippedCount = 0

  for (const nodeModulesDir of standaloneNodeModulesDirs) {
    try {
      const result = materializeSymlinksInTree(nodeModulesDir)
      materializedCount += result.materializedCount
      skippedCount += result.skippedCount
    } catch (error) {
      console.error(`[materialize-standalone-symlinks] Failed for ${nodeModulesDir}:`, error)
      process.exitCode = 1
      return
    }
  }

  const ensuredExternalizedDependencyCount = ensureExternalizedDependenciesFromVirtualStore()

  console.log(
    `[materialize-standalone-symlinks] Materialized ${materializedCount} symlink(s); skipped ${skippedCount} broken symlink(s); ensured ${ensuredExternalizedDependencyCount} externalized dependency module(s).`
  )
}

main()
