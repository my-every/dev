import 'server-only'

import type { UserIdentity, UserRole } from '@/types/d380-user-session'
import { isStandaloneToolMode } from '@/lib/runtime/share-directory'
import {
  createUserInShare,
  readUserFromShare,
  readUsersFromShare,
  updateUserPinInShare,
  verifyPinInShare,
} from '@/lib/session/share-user-store'
import {
  createUserInStandalone,
  readUserFromStandalone,
  readUsersFromStandalone,
  updateUserPinInStandalone,
  verifyPinInStandalone,
} from '@/lib/session/standalone-user-store'

export async function readUsersForRuntime(): Promise<UserIdentity[]> {
  if (await isStandaloneToolMode()) {
    return readUsersFromStandalone()
  }

  return readUsersFromShare()
}

export async function readUserForRuntime(badge: string): Promise<UserIdentity | null> {
  if (await isStandaloneToolMode()) {
    return readUserFromStandalone(badge)
  }

  return readUserFromShare(badge)
}

export async function verifyPinForRuntime(
  badge: string,
  pin: string,
): Promise<{ valid: boolean; user: UserIdentity | null }> {
  if (await isStandaloneToolMode()) {
    return verifyPinInStandalone(badge, pin)
  }

  return verifyPinInShare(badge, pin)
}

export async function createUserForRuntime(params: {
  badge: string
  legalName: string
  role: UserRole
  pin: string
}): Promise<UserIdentity | null> {
  if (await isStandaloneToolMode()) {
    return createUserInStandalone(params)
  }

  return createUserInShare(params)
}

export async function updateUserPinForRuntime(
  badge: string,
  currentPin: string | null | undefined,
  nextPin: string,
): Promise<UserIdentity | null> {
  if (await isStandaloneToolMode()) {
    return updateUserPinInStandalone(badge, currentPin, nextPin)
  }

  return updateUserPinInShare(badge, currentPin, nextPin)
}
