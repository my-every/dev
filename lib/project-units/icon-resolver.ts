import type {
  ProjectUnitIconDescriptor,
  ProjectUnitIconMatchLevel,
  ProjectUnitVisualState,
} from '@/lib/project-units/types'

interface UnitIconRecord {
  type: string
  state: ProjectUnitVisualState
  lwc: string
  doors: number
  iconPath: string
}

const UNIT_ICON_LIBRARY: UnitIconRecord[] = [
  {
    type: 'JB',
    state: 'closed',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB, State=closed, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'JB',
    state: 'open',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB, State=open, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'JB5',
    state: 'closed',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB5, State=closed, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'JB5',
    state: 'open',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB5, State=open, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'JB70',
    state: 'closed',
    lwc: 'ONSKID',
    doors: 2,
    iconPath: '/unit-type/Type=JB70, State=closed, lwc=ONSKID, Doors=2.svg',
  },
  {
    type: 'JB72',
    state: 'closed',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB72, State=closed, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'JB72',
    state: 'open',
    lwc: 'ONSKID',
    doors: 1,
    iconPath: '/unit-type/Type=JB72, State=open, lwc=ONSKID, Doors=1.svg',
  },
  {
    type: 'CONSOL',
    state: 'closed',
    lwc: 'OFFSKID',
    doors: 2,
    iconPath: '/unit-type/Type=consol, State=closed, lwc=OFFSKID, Doors=2.svg',
  },
  {
    type: 'CONSOLE',
    state: 'closed',
    lwc: 'OFFSKID',
    doors: 1,
    iconPath: '/unit-type/Type=console, State=closed, lwc=OFFSKID, Doors=1.svg',
  },
  {
    type: 'CONSOLE',
    state: 'closed',
    lwc: 'OFFSKID',
    doors: 3,
    iconPath: '/unit-type/Type=console, State=closed, lwc=OFFSKID, Doors=3.svg',
  },
  {
    type: 'SKID',
    state: 'closed',
    lwc: 'ONSKID',
    doors: 2,
    iconPath: '/unit-type/Type=skid, State=closed, lwc=ONSKID, Doors=2.svg',
  },
  {
    type: 'SKID',
    state: 'hanged',
    lwc: 'ONSKID',
    doors: 2,
    iconPath: '/unit-type/Type=skid, State=hanged, lwc=ONSKID, Doors=2.svg',
  },
]

function normalizeUnitType(value: string | undefined | null): string {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeLwc(value: string | undefined | null): string {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized.includes('OFF')) return 'OFFSKID'
  if (normalized.includes('ON')) return 'ONSKID'
  return normalized || 'ONSKID'
}

function getUnitTypeCandidates(unitType: string): string[] {
  const normalized = normalizeUnitType(unitType)
  if (!normalized) return ['JB']
  if (normalized === 'CONSOL') return ['CONSOL', 'CONSOLE']
  if (normalized === 'CONSOLE') return ['CONSOLE', 'CONSOL']
  if (normalized.startsWith('JB')) {
    return [normalized, 'JB']
  }
  return [normalized]
}

export function resolveUnitTypeIcon(input: {
  unitType?: string | null
  lwc?: string | null
  state?: ProjectUnitVisualState | null
  doorCount?: number | null
}): ProjectUnitIconDescriptor {
  const requestedUnitType = normalizeUnitType(input.unitType)
  const requestedLwc = normalizeLwc(input.lwc)
  const requestedState = input.state ?? 'closed'
  const requestedDoors = input.doorCount ?? null
  const typeCandidates = getUnitTypeCandidates(requestedUnitType)

  const exact = UNIT_ICON_LIBRARY.find(
    (record) =>
      typeCandidates[0] === record.type &&
      record.lwc === requestedLwc &&
      record.state === requestedState &&
      (requestedDoors == null || record.doors === requestedDoors),
  )

  if (exact) {
    return {
      iconPath: exact.iconPath,
      unitType: exact.type,
      lwc: exact.lwc,
      state: exact.state,
      doors: exact.doors,
      matchLevel: 'exact',
    }
  }

  const family = UNIT_ICON_LIBRARY.find(
    (record) =>
      typeCandidates.includes(record.type) &&
      record.lwc === requestedLwc &&
      record.state === requestedState,
  ) ?? UNIT_ICON_LIBRARY.find(
    (record) =>
      typeCandidates.includes(record.type) &&
      record.lwc === requestedLwc,
  )

  if (family) {
    return {
      iconPath: family.iconPath,
      unitType: family.type,
      lwc: family.lwc,
      state: family.state,
      doors: family.doors,
      matchLevel: 'family',
    }
  }

  const generic =
    UNIT_ICON_LIBRARY.find(
      (record) => record.lwc === requestedLwc && record.state === requestedState,
    ) ??
    UNIT_ICON_LIBRARY.find((record) => record.lwc === requestedLwc) ??
    UNIT_ICON_LIBRARY[0]

  return {
    iconPath: generic.iconPath,
    unitType: generic.type,
    lwc: generic.lwc,
    state: generic.state,
    doors: generic.doors,
    matchLevel: 'generic',
  }
}

export function buildUnitVisualDefaults(input: {
  unitType?: string | null
  lwc?: string | null
}): Pick<ProjectUnitIconDescriptor, 'iconPath' | 'lwc' | 'state' | 'doors' | 'matchLevel' | 'unitType'> {
  return resolveUnitTypeIcon({
    unitType: input.unitType,
    lwc: input.lwc,
    state: 'closed',
  })
}
