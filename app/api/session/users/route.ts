import { NextResponse } from 'next/server'

import { createSessionFeedback } from '@/lib/session/session-feedback'
import {
  createUserForRuntime,
  readUserForRuntime,
  readUsersForRuntime,
  updateUserPinForRuntime,
} from '@/lib/session/runtime-user-store'
import type { UserRole } from '@/types/d380-user-session'

const VALID_ROLES: UserRole[] = ['ASSEMBLER', 'TEAM_LEAD', 'ENGINEER', 'MANAGER', 'SUPERVISOR', 'QA', 'BRANDER', 'DEVELOPER']

function stripPin<T extends { pinHash?: unknown }>(user: T): Omit<T, 'pinHash'> {
  const { pinHash: _stripped, ...safe } = user
  return safe
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const badge = searchParams.get('badge')

    if (badge) {
      const user = await readUserForRuntime(badge)
      return NextResponse.json({ user: user ? stripPin(user) : null })
    }

    const users = await readUsersForRuntime()
    return NextResponse.json({ users: users.map(stripPin) })
  } catch (error) {
    console.error('[session/users] GET failed', error)
    return NextResponse.json(
      { users: [], error: createSessionFeedback('ACTION_FAILED').message },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      badge?: string
      legalName?: string
      role?: string
      pin?: string
    }

    if (!body.badge || !/^\d+$/.test(body.badge)) {
      return NextResponse.json({ error: 'Badge must be numeric.' }, { status: 400 })
    }
    if (!body.legalName?.trim()) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
    }
    if (!body.role || !VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 })
    }
    if (!body.pin || !/^\d{4}$/.test(body.pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 })
    }

    const user = await createUserForRuntime({
      badge: body.badge,
      legalName: body.legalName.trim(),
      role: body.role as UserRole,
      pin: body.pin,
    })

    if (!user) {
      return NextResponse.json(
        { error: 'A user with that badge number already exists.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ user: stripPin(user) }, { status: 201 })
  } catch (error) {
    console.error('[session/users] POST failed', error)
    return NextResponse.json(
      { error: createSessionFeedback('ACTION_FAILED').message },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      badge?: string
      currentPin?: string | null
      nextPin?: string
    }

    if (!body.badge || !body.nextPin) {
      return NextResponse.json(
        { success: false, feedback: createSessionFeedback('PIN_CHANGE_FAILED') },
        { status: 400 },
      )
    }

    if (!/^\d{4}$/.test(body.nextPin)) {
      return NextResponse.json(
        {
          success: false,
          error: 'New PIN must be 4 digits.',
          errorCode: 'PIN_CHANGE_FAILED',
          feedback: createSessionFeedback('PIN_CHANGE_FAILED'),
        },
        { status: 400 },
      )
    }

    const user = await updateUserPinForRuntime(body.badge, body.currentPin, body.nextPin)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: createSessionFeedback('PIN_CHANGE_FAILED').message,
          errorCode: 'PIN_CHANGE_FAILED',
          feedback: createSessionFeedback('PIN_CHANGE_FAILED'),
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('[session/users] PATCH failed', error)
    return NextResponse.json(
      {
        success: false,
        error: createSessionFeedback('PIN_CHANGE_FAILED').message,
        errorCode: 'PIN_CHANGE_FAILED',
        feedback: createSessionFeedback('PIN_CHANGE_FAILED'),
      },
      { status: 500 },
    )
  }
}
