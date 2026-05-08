import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import { getUserDefaultTitleForRole } from '@/lib/users/display'

import type { LwcType } from '@/lib/workbook/types'
import type { UserIdentity, UserRole } from '@/types/d380-user-session'
import type { ShiftOptionId } from '@/types/d380-startup'

const REQUIRED_PIN_CHANGE_COLUMN = 'requires_pin_change'
const TITLE_COLUMN = 'title'
const PIN_HMAC_SECRET = 'd380-pin-auth-key'
const DEFAULT_USER_CSV_HEADERS = [
  'badge',
  'pin',
  REQUIRED_PIN_CHANGE_COLUMN,
  'legal_name',
  'preferred_name',
  'initials',
  'role',
  TITLE_COLUMN,
  'primary_lwc',
  'shift',
  'email',
  'phone',
  'is_active',
  'created_at',
  'updated_at',
  'skill_brand_list',
  'skill_branding',
  'skill_build_up',
  'skill_wiring',
  'skill_wiring_ipv',
  'skill_box_build',
  'skill_cross_wire',
  'skill_test',
  'skill_pwr_check',
  'skill_biq',
  'skill_green_change',
  'years_experience',
  'hire_date',
] as const

async function getUsersCsvPath(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'users', 'users.csv')
}

// ============================================================================
// PIN Hashing
// ============================================================================

function hashPin(pin: string, badge: string): string {
  return createHmac('sha256', PIN_HMAC_SECRET)
    .update(`${badge}:${pin}`)
    .digest('hex')
}

function normalizeBadgeValue(value: string): string {
  const digitsOnly = value.trim().replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }

  return digitsOnly.replace(/^0+(?=\d)/, '')
}

function isSameBadge(left: string, right: string): boolean {
  const leftTrimmed = left.trim()
  const rightTrimmed = right.trim()

  if (leftTrimmed === rightTrimmed) {
    return true
  }

  const leftNormalized = normalizeBadgeValue(leftTrimmed)
  const rightNormalized = normalizeBadgeValue(rightTrimmed)
  return leftNormalized.length > 0 && leftNormalized === rightNormalized
}

function isPlaintextPin(value: string): boolean {
  return /^\d{4}$/.test(value)
}

function verifyPinHash(inputPin: string, storedValue: string, badge: string): boolean {
  if (isPlaintextPin(storedValue)) {
    // Legacy plaintext — compare directly
    return storedValue === inputPin
  }
  const inputHash = Buffer.from(hashPin(inputPin, badge))
  const stored = Buffer.from(storedValue)
  if (inputHash.length !== stored.length) return false
  return timingSafeEqual(inputHash, stored)
}

interface CsvDocument {
  headers: string[]
  rows: string[][]
}

function createEmptyCsvDocument(): CsvDocument {
  return {
    headers: [...DEFAULT_USER_CSV_HEADERS],
    rows: [],
  }
}

function normalizeBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) {
    return defaultValue
  }

  return value.trim().toLowerCase() === 'true'
}

function normalizeRole(value: string): UserRole {
  const role = value.trim().toUpperCase()

  switch (role) {
    case 'DEVELOPER':
    case 'MANAGER':
    case 'SUPERVISOR':
    case 'ENGINEER':
    case 'TEAM_LEAD':
    case 'QA':
    case 'BRANDER':
    case 'ASSEMBLER':
      return role
    default:
      return 'ASSEMBLER'
  }
}

function normalizeShift(value: string): ShiftOptionId {
  return value === '2' || value.toUpperCase() === 'SECOND' ? '2nd' : '1st'
}

function normalizeLwc(value: string): LwcType {
  const lwc = value.trim().toUpperCase()

  switch (lwc) {
    case 'ONSKID':
    case 'OFFSKID':
    case 'NTB':
    case 'FLOAT':
      return lwc
    case 'NEW_FLEX':
    case 'NEWFLEX':
    default:
      return 'NEW_FLEX'
  }
}

function ensurePinChangeColumn(document: CsvDocument): CsvDocument {
  if (document.headers.includes(REQUIRED_PIN_CHANGE_COLUMN)) {
    return document
  }

  const pinIndex = document.headers.indexOf('pin')
  const insertAt = pinIndex >= 0 ? pinIndex + 1 : 2
  const headers = [...document.headers]
  headers.splice(insertAt, 0, REQUIRED_PIN_CHANGE_COLUMN)

  const rows = document.rows.map(row => {
    const values = [...row]
    values.splice(insertAt, 0, 'false')
    return values
  })

  return { headers, rows }
}

function ensureTitleColumn(document: CsvDocument): CsvDocument {
  if (document.headers.includes(TITLE_COLUMN)) {
    return document
  }

  const roleIndex = document.headers.indexOf('role')
  const insertAt = roleIndex >= 0 ? roleIndex + 1 : document.headers.length
  const headers = [...document.headers]
  headers.splice(insertAt, 0, TITLE_COLUMN)

  const rows = document.rows.map(row => {
    const values = [...row]
    const role = roleIndex >= 0 ? (row[roleIndex] ?? '') : ''
    values.splice(insertAt, 0, getUserDefaultTitleForRole(role))
    return values
  })

  return { headers, rows }
}

function stripQuotes(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(stripQuotes)
}

function parseCsv(content: string): CsvDocument {
  if (!content.trim()) {
    return createEmptyCsvDocument()
  }

  const lines = content.trim().split(/\r?\n/)
  const headers = splitCsvLine(lines[0] ?? '')
  const rows = lines.slice(1).filter(Boolean).map(splitCsvLine)
  return ensureTitleColumn(ensurePinChangeColumn({ headers, rows }))
}

function getValue(headers: string[], row: string[], key: string): string {
  const index = headers.indexOf(key)
  return index >= 0 ? (row[index] ?? '') : ''
}

function findRowByBadge(document: CsvDocument, badge: string): string[] | undefined {
  return document.rows.find(candidate => isSameBadge(getValue(document.headers, candidate, 'badge'), badge))
}

function findRowIndexByBadge(document: CsvDocument, badge: string): number {
  return document.rows.findIndex(candidate => isSameBadge(getValue(document.headers, candidate, 'badge'), badge))
}

function setValue(headers: string[], row: string[], key: string, value: string): string[] {
  const index = headers.indexOf(key)
  if (index < 0) {
    return row
  }

  const next = [...row]
  next[index] = value
  return next
}

function toUserIdentity(headers: string[], row: string[]): UserIdentity {
  const legalName = getValue(headers, row, 'legal_name')
  const preferredName = getValue(headers, row, 'preferred_name') || legalName.split(' ')[0] || getValue(headers, row, 'badge')

  return {
    badge: getValue(headers, row, 'badge'),
    pinHash: getValue(headers, row, 'pin'),
    legalName,
    preferredName,
    initials: getValue(headers, row, 'initials'),
    role: normalizeRole(getValue(headers, row, 'role')),
    title: getValue(headers, row, TITLE_COLUMN) || getUserDefaultTitleForRole(getValue(headers, row, 'role')),
    avatarPath: null,
    primaryLwc: normalizeLwc(getValue(headers, row, 'primary_lwc')),
    currentShift: normalizeShift(getValue(headers, row, 'shift')),
    email: getValue(headers, row, 'email') || null,
    phone: getValue(headers, row, 'phone') || null,
    isActive: normalizeBoolean(getValue(headers, row, 'is_active'), true),
    requiresPinChange: normalizeBoolean(getValue(headers, row, REQUIRED_PIN_CHANGE_COLUMN), false),
    createdAt: getValue(headers, row, 'created_at') || new Date().toISOString(),
    updatedAt: getValue(headers, row, 'updated_at') || new Date().toISOString(),
    skills: {
      brandList: Number.parseInt(getValue(headers, row, 'skill_brand_list'), 10) || 0,
      branding: Number.parseInt(getValue(headers, row, 'skill_branding'), 10) || 0,
      buildUp: Number.parseInt(getValue(headers, row, 'skill_build_up'), 10) || 0,
      wiring: Number.parseInt(getValue(headers, row, 'skill_wiring'), 10) || 0,
      wiringIpv: Number.parseInt(getValue(headers, row, 'skill_wiring_ipv'), 10) || 0,
      boxBuild: Number.parseInt(getValue(headers, row, 'skill_box_build'), 10) || 0,
      crossWire: Number.parseInt(getValue(headers, row, 'skill_cross_wire'), 10) || 0,
      test: Number.parseInt(getValue(headers, row, 'skill_test'), 10) || 0,
      pwrCheck: Number.parseInt(getValue(headers, row, 'skill_pwr_check'), 10) || 0,
      biq: Number.parseInt(getValue(headers, row, 'skill_biq'), 10) || 0,
      greenChange: Number.parseInt(getValue(headers, row, 'skill_green_change'), 10) || 0,
    },
    yearsExperience: Number.parseFloat(getValue(headers, row, 'years_experience')) || 0,
    hireDate: getValue(headers, row, 'hire_date') || undefined,
  }
}

async function readCsvDocument(): Promise<CsvDocument> {
  const usersCsvPath = await getUsersCsvPath()
  try {
    const raw = await fs.readFile(usersCsvPath, 'utf-8')
    return parseCsv(raw)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createEmptyCsvDocument()
    }

    throw error
  }
}

async function writeCsvDocument(document: CsvDocument): Promise<void> {
  const lines = [document.headers.join(','), ...document.rows.map(row => row.join(','))]
  const usersCsvPath = await getUsersCsvPath()
  await fs.mkdir(path.dirname(usersCsvPath), { recursive: true })
  await fs.writeFile(usersCsvPath, `${lines.join('\n')}\n`, 'utf-8')
}

export async function readUsersFromShare(): Promise<UserIdentity[]> {
  const document = await readCsvDocument()
  return document.rows.map(row => toUserIdentity(document.headers, row))
}

export async function readUserFromShare(badge: string): Promise<UserIdentity | null> {
  const document = await readCsvDocument()
  const row = findRowByBadge(document, badge)
  return row ? toUserIdentity(document.headers, row) : null
}

export async function verifyPinInShare(
  badge: string,
  pin: string,
): Promise<{ valid: boolean; user: UserIdentity | null }> {
  const document = await readCsvDocument()
  const row = findRowByBadge(document, badge)
  if (!row) return { valid: false, user: null }

  const storedBadge = getValue(document.headers, row, 'badge')
  const storedPin = getValue(document.headers, row, 'pin')
  const user = toUserIdentity(document.headers, row)
  const valid = verifyPinHash(pin, storedPin, storedBadge)
  return { valid, user }
}

export async function updateUserPinInShare(
  badge: string,
  currentPin: string | null | undefined,
  nextPin: string,
): Promise<UserIdentity | null> {
  const document = await readCsvDocument()
  const rowIndex = findRowIndexByBadge(document, badge)

  if (rowIndex < 0) {
    return null
  }

  const currentRow = document.rows[rowIndex]
  const storedBadge = getValue(document.headers, currentRow, 'badge')
  const storedPin = getValue(document.headers, currentRow, 'pin')
  const currentUser = toUserIdentity(document.headers, currentRow)
  const isInitialPinSetup = currentUser.requiresPinChange && !currentPin

  if (!isInitialPinSetup && !verifyPinHash(currentPin ?? '', storedPin, storedBadge)) {
    return null
  }

  const now = new Date().toISOString()
  let nextRow = setValue(document.headers, currentRow, 'pin', hashPin(nextPin, storedBadge))
  nextRow = setValue(document.headers, nextRow, REQUIRED_PIN_CHANGE_COLUMN, 'false')
  nextRow = setValue(document.headers, nextRow, 'updated_at', now)
  document.rows[rowIndex] = nextRow

  await writeCsvDocument(document)
  return toUserIdentity(document.headers, nextRow)
}

export async function createUserInShare(params: {
  badge: string
  legalName: string
  role: UserRole
  pin: string
}): Promise<UserIdentity | null> {
  const document = await readCsvDocument()

  // Reject duplicate badge
  if (findRowByBadge(document, params.badge)) {
    return null
  }

  const now = new Date().toISOString()
  const firstWord = params.legalName.trim().split(/\s+/)
  const initials = firstWord
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  const preferredName = firstWord[0] ?? params.badge
  const title = getUserDefaultTitleForRole(params.role)
  const pinHash = hashPin(params.pin, params.badge)

  // Build row aligned to current headers
  const row: string[] = document.headers.map(header => {
    switch (header) {
      case 'badge': return params.badge
      case 'pin': return pinHash
      case REQUIRED_PIN_CHANGE_COLUMN: return 'false'
      case 'legal_name': return params.legalName.trim()
      case 'preferred_name': return preferredName
      case 'initials': return initials
      case 'role': return params.role
      case TITLE_COLUMN: return title
      case 'primary_lwc': return 'NEW_FLEX'
      case 'shift': return '1st'
      case 'is_active': return 'true'
      case 'created_at': return now
      case 'updated_at': return now
      default: return ''
    }
  })

  document.rows.push(row)
  await writeCsvDocument(document)
  return toUserIdentity(document.headers, row)
}

export async function migratePinsToHash(): Promise<number> {
  const document = await readCsvDocument()
  let migrated = 0

  for (let i = 0; i < document.rows.length; i++) {
    const row = document.rows[i]
    const badge = getValue(document.headers, row, 'badge')
    const pin = getValue(document.headers, row, 'pin')
    if (isPlaintextPin(pin)) {
      document.rows[i] = setValue(document.headers, row, 'pin', hashPin(pin, badge))
      migrated++
    }
  }

  if (migrated > 0) {
    await writeCsvDocument(document)
  }
  return migrated
}
