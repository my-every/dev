import fs from 'node:fs'
import path from 'node:path'

import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'
import type { ShareUserProfile } from '@/lib/profile/share-profile-store'

const SHIFT_DIRS = ['1st-shift', '2nd-shift', '3rd-shift'] as const

export interface BoardMemberProfile extends ShareUserProfile {
  shiftDir: string
}

function getUsersRoot() {
  return path.join(resolveShareDirectorySync(), 'users')
}

export function listBoardMemberProfiles(): BoardMemberProfile[] {
  const usersRoot = getUsersRoot()

  if (!fs.existsSync(usersRoot)) {
    return []
  }

  const members: BoardMemberProfile[] = []

  for (const shiftDir of SHIFT_DIRS) {
    const shiftPath = path.join(usersRoot, shiftDir)
    if (!fs.existsSync(shiftPath)) {
      continue
    }

    const badgeDirs = fs.readdirSync(shiftPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)

    for (const badge of badgeDirs) {
      const profilePath = path.join(shiftPath, badge, 'profile.json')
      if (!fs.existsSync(profilePath)) {
        continue
      }

      try {
        const raw = fs.readFileSync(profilePath, 'utf-8')
        const parsed = JSON.parse(raw) as ShareUserProfile
        members.push({
          ...parsed,
          badge: parsed.badge || badge,
          shiftDir,
        })
      } catch {
        continue
      }
    }
  }

  return members.sort((left, right) => left.fullName.localeCompare(right.fullName))
}
