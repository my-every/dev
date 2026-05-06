import { createHmac } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

import { createProfileInShare } from '@/lib/profile/share-profile-store'
import { setShareDirectorySettings } from '@/lib/runtime/share-directory'
import {
  upsertUserSettings,
  writeUserSettings,
} from '@/lib/user-settings/share-user-settings-store'
import { applyPermissionGroup } from '@/types/user-settings'
import type { UserRole } from '@/types/d380-user-session'

export const dynamic = 'force-dynamic'

const PIN_HMAC_SECRET = 'd380-pin-auth-key'

const USER_CSV_HEADERS = [
  'badge',
  'pin',
  'requires_pin_change',
  'legal_name',
  'preferred_name',
  'initials',
  'role',
  'primary_lwc',
  'shift',
  'email',
  'phone',
  'is_active',
  'created_at',
  'updated_at',
  'hire_date',
  'years_experience',
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
]

type DepartmentSetupSource = 'import-existing' | 'create-new'

interface DepartmentSeedUserInput {
  badge: string
  legalName: string
  preferredName?: string
  initials?: string
  role: UserRole
  shift: '1' | '2'
  pin: string
  email?: string
}

interface DepartmentSetupRequest {
  shareDirectory: string
  source: DepartmentSetupSource
  seedUser?: DepartmentSeedUserInput
}

function hashPin(pin: string, badge: string): string {
  return createHmac('sha256', PIN_HMAC_SECRET)
    .update(`${badge}:${pin}`)
    .digest('hex')
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(value => {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1)
    }

    return value
  })
}

function serializeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

function normalizeRecord(
  headers: string[],
  values: string[],
): Record<string, string> {
  const record: Record<string, string> = {}

  for (let index = 0; index < headers.length; index += 1) {
    record[headers[index]] = values[index] ?? ''
  }

  return record
}

function normalizeShift(shiftValue: string): '1st' | '2nd' {
  return shiftValue === '2' || shiftValue.toLowerCase().startsWith('2') ? '2nd' : '1st'
}

function normalizeRole(roleValue: string): UserRole {
  const normalized = roleValue.trim().toUpperCase()

  if (
    normalized === 'DEVELOPER'
    || normalized === 'MANAGER'
    || normalized === 'SUPERVISOR'
    || normalized === 'TEAM_LEAD'
    || normalized === 'QA'
    || normalized === 'BRANDER'
    || normalized === 'ASSEMBLER'
  ) {
    return normalized
  }

  return 'ASSEMBLER'
}

function inferPresetId(role: UserRole): string {
  if (role === 'DEVELOPER' || role === 'MANAGER') {
    return 'admin'
  }

  if (role === 'SUPERVISOR') {
    return 'supervisor'
  }

  if (role === 'TEAM_LEAD') {
    return 'lead'
  }

  return 'team-member'
}

function makeUserRecordFromSeed(seedUser: DepartmentSeedUserInput, nowIso: string): Record<string, string> {
  const initials = (seedUser.initials ?? seedUser.legalName.split(' ').map(part => part.at(0) ?? '').join('').slice(0, 3)).toUpperCase()

  return {
    badge: seedUser.badge,
    pin: hashPin(seedUser.pin, seedUser.badge),
    requires_pin_change: 'false',
    legal_name: seedUser.legalName,
    preferred_name: seedUser.preferredName ?? seedUser.legalName,
    initials,
    role: seedUser.role,
    primary_lwc: 'NEW_FLEX',
    shift: seedUser.shift,
    email: seedUser.email ?? '',
    phone: '',
    is_active: 'true',
    created_at: nowIso,
    updated_at: nowIso,
    hire_date: nowIso.slice(0, 10),
    years_experience: '0',
    skill_brand_list: '0',
    skill_branding: '0',
    skill_build_up: '0',
    skill_wiring: '0',
    skill_wiring_ipv: '0',
    skill_box_build: '0',
    skill_cross_wire: '0',
    skill_test: '0',
    skill_pwr_check: '0',
    skill_biq: '0',
    skill_green_change: '0',
  }
}

function ensureRequiredColumns(record: Record<string, string>): Record<string, string> {
  const next = { ...record }

  for (const header of USER_CSV_HEADERS) {
    if (next[header] === undefined) {
      next[header] = ''
    }
  }

  if (!next.requires_pin_change) {
    next.requires_pin_change = 'false'
  }

  return next
}

async function scaffoldUserArtifacts(
  shareDirectory: string,
  records: Record<string, string>[],
): Promise<{ createdSettings: number; createdProfiles: number }> {
  let createdSettings = 0
  let createdProfiles = 0

  for (const record of records) {
    const badge = record.badge
    if (!badge || record.is_active.toLowerCase() === 'false') {
      continue
    }

    const role = normalizeRole(record.role)
    const shift = normalizeShift(record.shift)

    const currentSettings = await upsertUserSettings(badge, shift)
    const presetId = inferPresetId(role)
    const preset = applyPermissionGroup(presetId)

    if (preset) {
      await writeUserSettings(badge, shift, {
        ...currentSettings,
        dashboardAccess: preset.dashboardAccess,
        permissions: preset.permissions,
        permissionGroupId: presetId,
        lastUpdated: new Date().toISOString(),
      })
      createdSettings += 1
    }

    const createdProfile = await createProfileInShare(badge, shift, {
      fullName: record.legal_name,
      preferredName: record.preferred_name || null,
      initials: record.initials || null,
      role: role.toLowerCase(),
      shift,
      email: record.email || null,
      phone: record.phone || null,
      primaryLwc: record.primary_lwc || 'NEW_FLEX',
      hireDate: record.hire_date || null,
      yearsExperience: Number.parseFloat(record.years_experience || '0') || 0,
    })

    if (createdProfile) {
      createdProfiles += 1
    }
  }

  await fs.mkdir(path.join(shareDirectory, 'users', '1st-shift'), { recursive: true })
  await fs.mkdir(path.join(shareDirectory, 'users', '2nd-shift'), { recursive: true })
  await fs.mkdir(path.join(shareDirectory, 'users', '3rd-shift'), { recursive: true })

  return { createdSettings, createdProfiles }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DepartmentSetupRequest

    if (!body.shareDirectory || !path.isAbsolute(body.shareDirectory)) {
      return NextResponse.json(
        { error: 'shareDirectory must be an absolute path' },
        { status: 400 },
      )
    }

    if (body.source !== 'import-existing' && body.source !== 'create-new') {
      return NextResponse.json(
        { error: 'source must be import-existing or create-new' },
        { status: 400 },
      )
    }

    const resolvedShareDirectory = await setShareDirectorySettings(body.shareDirectory)
    const usersDir = path.join(resolvedShareDirectory, 'users')
    await fs.mkdir(usersDir, { recursive: true })

    const usersCsvPath = path.join(usersDir, 'users.csv')
    const nowIso = new Date().toISOString()

    let records: Record<string, string>[] = []

    if (body.source === 'import-existing') {
      const hasCsv = await fs
        .access(usersCsvPath)
        .then(() => true)
        .catch(() => false)

      if (!hasCsv) {
        return NextResponse.json(
          { error: 'No users.csv found in selected Share folder. Switch to Create New User Roster.' },
          { status: 400 },
        )
      }

      const csvRaw = await fs.readFile(usersCsvPath, 'utf-8')
      const lines = csvRaw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

      const parsedHeaders = splitCsvLine(lines[0] ?? '')
      const rows = lines.slice(1).map(splitCsvLine)
      const headers = Array.from(new Set([...parsedHeaders, ...USER_CSV_HEADERS]))
      records = rows.map(row => ensureRequiredColumns(normalizeRecord(headers, row)))
    } else {
      const seedUser = body.seedUser

      if (!seedUser) {
        return NextResponse.json(
          { error: 'seedUser is required when source is create-new' },
          { status: 400 },
        )
      }

      if (!/^\d+$/.test(seedUser.badge)) {
        return NextResponse.json({ error: 'seedUser.badge must be numeric' }, { status: 400 })
      }

      if (!/^\d{4}$/.test(seedUser.pin)) {
        return NextResponse.json({ error: 'seedUser.pin must be 4 digits' }, { status: 400 })
      }

      const adminRecord = makeUserRecordFromSeed(seedUser, nowIso)
      records = [ensureRequiredColumns(adminRecord)]
    }

    const csvHeader = USER_CSV_HEADERS.join(',')
    const csvRows = records.map(record => USER_CSV_HEADERS.map(header => serializeCsvValue(record[header] ?? '')).join(','))
    const csvContent = `${csvHeader}\n${csvRows.join('\n')}\n`

    await fs.writeFile(usersCsvPath, csvContent, 'utf-8')

    const result = await scaffoldUserArtifacts(resolvedShareDirectory, records)

    return NextResponse.json({
      success: true,
      shareDirectory: resolvedShareDirectory,
      source: body.source,
      usersDiscovered: records.length,
      ...result,
    })
  } catch (error) {
    console.error('[runtime/department-setup] POST failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run department setup' },
      { status: 500 },
    )
  }
}
