import 'server-only'

import { createHmac } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveStandaloneShareDirectory } from '@/lib/runtime/share-directory'
import type { UserIdentity, UserRole } from '@/types/d380-user-session'

const PIN_HMAC_SECRET = 'd380-pin-auth-key'

interface StandaloneUsersDocument {
  users: UserIdentity[]
}

function hashPin(pin: string, badge: string): string {
  return createHmac('sha256', PIN_HMAC_SECRET)
    .update(`${badge}:${pin}`)
    .digest('hex')
}

async function getStandaloneUsersPath(): Promise<string> {
  const shareRoot = await resolveStandaloneShareDirectory()
  return path.join(shareRoot, 'users', 'standalone-users.json')
}

async function readDocument(): Promise<StandaloneUsersDocument> {
  try {
    const filePath = await getStandaloneUsersPath()
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as StandaloneUsersDocument
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    }
  } catch {
    return { users: [] }
  }
}

async function writeDocument(document: StandaloneUsersDocument): Promise<void> {
  const filePath = await getStandaloneUsersPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8')
}

function buildStandaloneUser(badge: string, pin: string): UserIdentity {
  const now = new Date().toISOString()

  return {
    badge,
    pinHash: hashPin(pin, badge),
    legalName: `Standalone User ${badge}`,
    preferredName: `User ${badge}`,
    initials: badge.slice(0, 3) || 'ST',
    role: 'DEVELOPER',
    title: 'Developer',
    avatarPath: null,
    primaryLwc: 'NEW_FLEX',
    currentShift: '1st',
    email: null,
    phone: null,
    isActive: true,
    requiresPinChange: false,
    createdAt: now,
    updatedAt: now,
    skills: {
      brandList: 0,
      branding: 0,
      buildUp: 0,
      wiring: 0,
      wiringIpv: 0,
      boxBuild: 0,
      crossWire: 0,
      test: 0,
      pwrCheck: 0,
      biq: 0,
      greenChange: 0,
    },
    yearsExperience: 0,
  }
}

function sanitizeIdentity(user: UserIdentity): UserIdentity {
  return {
    ...user,
    pinHash: '',
  }
}

export async function readUsersFromStandalone(): Promise<UserIdentity[]> {
  const document = await readDocument()
  return document.users
}

export async function readUserFromStandalone(badge: string): Promise<UserIdentity | null> {
  const document = await readDocument()
  return document.users.find(user => user.badge === badge) ?? null
}

export async function verifyPinInStandalone(
  badge: string,
  pin: string,
): Promise<{ valid: boolean; user: UserIdentity | null }> {
  const document = await readDocument()
  const existingIndex = document.users.findIndex(user => user.badge === badge)

  if (existingIndex >= 0) {
    const existing = {
      ...document.users[existingIndex],
      updatedAt: new Date().toISOString(),
    }
    document.users[existingIndex] = existing
    await writeDocument(document)
    return { valid: true, user: sanitizeIdentity(existing) }
  }

  const created = buildStandaloneUser(badge, pin)
  document.users.push(created)
  await writeDocument(document)
  return { valid: true, user: sanitizeIdentity(created) }
}

export async function createUserInStandalone(params: {
  badge: string
  legalName: string
  role: UserRole
  pin: string
}): Promise<UserIdentity | null> {
  const document = await readDocument()

  // Reject duplicate badge
  if (document.users.find(u => u.badge === params.badge)) {
    return null
  }

  const now = new Date().toISOString()
  const words = params.legalName.trim().split(/\s+/)
  const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  const preferredName = words[0] ?? params.badge

  const newUser: UserIdentity = {
    badge: params.badge,
    pinHash: hashPin(params.pin, params.badge),
    legalName: params.legalName.trim(),
    preferredName,
    initials,
    role: params.role,
    title: params.role.replace(/_/g, ' '),
    avatarPath: null,
    primaryLwc: 'NEW_FLEX',
    currentShift: '1st',
    email: null,
    phone: null,
    isActive: true,
    requiresPinChange: false,
    createdAt: now,
    updatedAt: now,
    skills: {
      brandList: 0, branding: 0, buildUp: 0, wiring: 0,
      wiringIpv: 0, boxBuild: 0, crossWire: 0, test: 0,
      pwrCheck: 0, biq: 0, greenChange: 0,
    },
    yearsExperience: 0,
  }

  document.users.push(newUser)
  await writeDocument(document)
  return { ...newUser, pinHash: '' }
}

export async function updateUserPinInStandalone(
  badge: string,
  _currentPin: string | null | undefined,
  nextPin: string,
): Promise<UserIdentity> {
  const document = await readDocument()
  const existingIndex = document.users.findIndex(user => user.badge === badge)
  const now = new Date().toISOString()

  if (existingIndex >= 0) {
    const updated: UserIdentity = {
      ...document.users[existingIndex],
      pinHash: hashPin(nextPin, badge),
      updatedAt: now,
      requiresPinChange: false,
    }
    document.users[existingIndex] = updated
    await writeDocument(document)
    return sanitizeIdentity(updated)
  }

  const created = {
    ...buildStandaloneUser(badge, nextPin),
    updatedAt: now,
  }
  document.users.push(created)
  await writeDocument(document)
  return sanitizeIdentity(created)
}
