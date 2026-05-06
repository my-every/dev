import { NextResponse } from 'next/server'

import { createSessionFeedback } from '@/lib/session/session-feedback'
import {
  readUserForRuntime,
  readUsersForRuntime,
  updateUserPinForRuntime,
} from '@/lib/session/runtime-user-store'

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

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      badge?: string
      currentPin?: string
      nextPin?: string
    }

    if (!body.badge || !body.currentPin || !body.nextPin) {
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
