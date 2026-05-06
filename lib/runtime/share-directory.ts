import 'server-only'

import { promises as fs } from 'node:fs'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_APP_LAUNCH_MODE,
  type AppLaunchMode,
} from '@/lib/runtime/app-mode-types'

const DEFAULT_RUNTIME_STORAGE_DIRECTORY = path.join(process.cwd(), 'cache')
const RUNTIME_STORAGE_DIRECTORY = resolveRuntimeStorageDirectory()
const RUNTIME_SETTINGS_PATH = path.join(RUNTIME_STORAGE_DIRECTORY, 'runtime-settings.json')
const STANDALONE_SHARE_DIRECTORY = path.join(RUNTIME_STORAGE_DIRECTORY, 'standalone-tool', 'Share')

interface RuntimeSettings {
  shareDirectory?: string | null
  appMode?: AppLaunchMode
  firstLaunchCompleted?: boolean
}

type ShareDirectorySource = 'env' | 'config' | 'default' | 'standalone'

function resolveRuntimeStorageDirectory(): string {
  const configuredUserDataRoot = normalizeShareDirectory(process.env.D380_USER_DATA_DIR)
  if (configuredUserDataRoot) {
    return path.join(configuredUserDataRoot, 'runtime')
  }

  return DEFAULT_RUNTIME_STORAGE_DIRECTORY
}

async function readRuntimeSettings(): Promise<RuntimeSettings> {
  try {
    const raw = await fs.readFile(RUNTIME_SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw) as RuntimeSettings
  } catch {
    return {}
  }
}

function readRuntimeSettingsSync(): RuntimeSettings {
  try {
    const raw = readFileSync(RUNTIME_SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw) as RuntimeSettings
  } catch {
    return {}
  }
}

async function writeRuntimeSettings(settings: RuntimeSettings): Promise<void> {
  await fs.mkdir(path.dirname(RUNTIME_SETTINGS_PATH), { recursive: true })
  await fs.writeFile(RUNTIME_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
}

async function updateRuntimeSettings(
  updater: (current: RuntimeSettings) => RuntimeSettings,
): Promise<RuntimeSettings> {
  const current = await readRuntimeSettings()
  const next = updater(current)
  await writeRuntimeSettings(next)
  return next
}

function normalizeShareDirectory(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null
  }

  const trimmed = value.trim()
  if (!path.isAbsolute(trimmed)) {
    return null
  }

  return path.normalize(trimmed)
}

function repairLegacyMacSharedPrefix(value: string): string {
  const normalized = path.normalize(value)
  const legacyPrefix = path.join('/Users', 'Shared') + path.sep

  if (!normalized.startsWith(legacyPrefix) || existsSync(normalized)) {
    return normalized
  }

  const repaired = path.join('/Users', normalized.slice(legacyPrefix.length))
  return existsSync(repaired) ? repaired : normalized
}

function normalizeResolvedShareDirectory(value: string | null | undefined): string | null {
  const normalized = normalizeShareDirectory(value)
  if (!normalized) {
    return null
  }

  return repairLegacyMacSharedPrefix(normalized)
}

function resolveFallbackShareDirectory(configured: string | null): string | null {
  if (!configured) {
    return null
  }

  const defaultShare = path.join(process.cwd(), 'Share')
  const configuredUsersCsv = path.join(configured, 'users', 'users.csv')
  const defaultUsersCsv = path.join(defaultShare, 'users', 'users.csv')

  if (!existsSync(configuredUsersCsv) && existsSync(defaultUsersCsv)) {
    return defaultShare
  }

  return configured
}

function normalizeAppLaunchMode(value: string | null | undefined): AppLaunchMode {
  if (value === 'WORKSPACE' || value === 'STANDALONE_TOOL' || value === 'DEPARTMENT') {
    return value
  }

  return DEFAULT_APP_LAUNCH_MODE
}

async function resolveConfiguredAppMode(): Promise<AppLaunchMode> {
  const settings = await readRuntimeSettings()
  return normalizeAppLaunchMode(settings.appMode)
}

function resolveConfiguredAppModeSync(): AppLaunchMode {
  const settings = readRuntimeSettingsSync()
  return normalizeAppLaunchMode(settings.appMode)
}

export async function isStandaloneToolMode(): Promise<boolean> {
  return (await resolveConfiguredAppMode()) === 'STANDALONE_TOOL'
}

export function isStandaloneToolModeSync(): boolean {
  return resolveConfiguredAppModeSync() === 'STANDALONE_TOOL'
}

export async function resolveStandaloneShareDirectory(): Promise<string> {
  await fs.mkdir(STANDALONE_SHARE_DIRECTORY, { recursive: true })
  return STANDALONE_SHARE_DIRECTORY
}

export function resolveStandaloneShareDirectorySync(): string {
  return STANDALONE_SHARE_DIRECTORY
}

export async function resolveShareDirectory(): Promise<string> {
  if (await isStandaloneToolMode()) {
    return resolveStandaloneShareDirectory()
  }

  const envShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(process.env.SHARE_DIR))
  if (envShare) {
    return envShare
  }

  const settings = await readRuntimeSettings()
  const configuredShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(settings.shareDirectory))
  if (configuredShare) {
    return configuredShare
  }

  return path.join(process.cwd(), 'Share')
}

export function resolveShareDirectorySync(): string {
  if (isStandaloneToolModeSync()) {
    return resolveStandaloneShareDirectorySync()
  }

  const envShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(process.env.SHARE_DIR))
  if (envShare) {
    return envShare
  }

  const settings = readRuntimeSettingsSync()
  const configuredShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(settings.shareDirectory))
  if (configuredShare) {
    return configuredShare
  }

  return path.join(process.cwd(), 'Share')
}

export async function getShareDirectorySettings(): Promise<{
  shareDirectory: string
  source: ShareDirectorySource
}> {
  if (await isStandaloneToolMode()) {
    return {
      shareDirectory: await resolveStandaloneShareDirectory(),
      source: 'standalone',
    }
  }

  const envShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(process.env.SHARE_DIR))
  if (envShare) {
    return {
      shareDirectory: envShare,
      source: 'env',
    }
  }

  const settings = await readRuntimeSettings()
  const configuredShare = resolveFallbackShareDirectory(normalizeResolvedShareDirectory(settings.shareDirectory))
  if (configuredShare) {
    return {
      shareDirectory: configuredShare,
      source: 'config',
    }
  }

  return {
    shareDirectory: path.join(process.cwd(), 'Share'),
    source: 'default',
  }
}

export async function hasUsersDirectory(): Promise<boolean> {
  const shareDirectory = await resolveShareDirectory()
  const usersPath = path.join(shareDirectory, 'users')

  try {
    const stat = await fs.stat(usersPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export async function setShareDirectorySettings(shareDirectory: string | null): Promise<string> {
  const normalized = normalizeShareDirectory(shareDirectory)

  await updateRuntimeSettings(current => ({
    ...current,
    shareDirectory: normalized,
  }))

  const resolved = normalized ?? path.join(process.cwd(), 'Share')
  await fs.mkdir(resolved, { recursive: true })
  return resolved
}

export async function getAppModeSettings(): Promise<{
  appMode: AppLaunchMode
  firstLaunchCompleted: boolean
}> {
  const settings = await readRuntimeSettings()

  return {
    appMode: normalizeAppLaunchMode(settings.appMode),
    firstLaunchCompleted: settings.firstLaunchCompleted === true,
  }
}

export async function setAppModeSettings(appMode: AppLaunchMode): Promise<{
  appMode: AppLaunchMode
  firstLaunchCompleted: boolean
}> {
  const normalizedMode = normalizeAppLaunchMode(appMode)

  await updateRuntimeSettings(current => ({
    ...current,
    appMode: normalizedMode,
    firstLaunchCompleted: true,
  }))

  return {
    appMode: normalizedMode,
    firstLaunchCompleted: true,
  }
}
