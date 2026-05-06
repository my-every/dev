import { NextResponse } from 'next/server'

import { createSessionFeedback } from '@/lib/session/session-feedback'
import { verifyPinForRuntime } from '@/lib/session/runtime-user-store'

export async function POST(request: Request) {
    try {
        const body = await request.json() as { badge?: string; pin?: string }
        const badge = body.badge?.trim().replace(/\D/g, '') ?? ''
        const pin = body.pin?.trim().replace(/\D/g, '') ?? ''

        if (!badge || !pin) {
            return NextResponse.json(
                { valid: false, error: 'Badge and PIN are required.' },
                { status: 400 },
            )
        }

        if (!/^\d+$/.test(badge) || !/^\d{4}$/.test(pin)) {
            return NextResponse.json(
                { valid: false, error: 'Badge must be numeric and PIN must be 4 digits.' },
                { status: 400 },
            )
        }

        const { valid, user } = await verifyPinForRuntime(badge, pin)

        if (!valid || !user) {
            return NextResponse.json({ valid: false, user: null })
        }

        // Return user WITHOUT pinHash
        const { pinHash: _stripped, ...safeUser } = user
        return NextResponse.json({ valid: true, user: safeUser })
    } catch (error) {
        console.error('[session/verify-pin] POST failed', error)
        return NextResponse.json(
            { valid: false, error: createSessionFeedback('ACTION_FAILED').message },
            { status: 500 },
        )
    }
}
