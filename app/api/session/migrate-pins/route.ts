import { NextResponse } from 'next/server'

import { migratePinsToHash } from '@/lib/session/share-user-store'

export async function POST() {
    try {
        const migrated = await migratePinsToHash()
        return NextResponse.json({ success: true, migrated })
    } catch (error) {
        console.error('[session/migrate-pins] POST failed', error)
        return NextResponse.json(
            { success: false, error: 'Migration failed' },
            { status: 500 },
        )
    }
}
