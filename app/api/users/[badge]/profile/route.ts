import { NextResponse } from 'next/server'
import {
    readProfileFromShare,
    writeProfileToShare,
    createProfileInShare,
    deleteProfileFromShare,
} from '@/lib/profile/share-profile-store'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const profile = await readProfileFromShare(badge)

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        return NextResponse.json({ profile })
    } catch (error) {
        console.error(`[users/${badge}/profile] GET failed`, error)
        return NextResponse.json({ error: 'Failed to read profile' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const body = await request.json()
        delete body.badge
        delete body.createdAt

        const updated = await writeProfileToShare(badge, body)

        if (!updated) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        return NextResponse.json({ profile: updated })
    } catch (error) {
        console.error(`[users/${badge}/profile] PATCH failed`, error)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const shift = body?.shift as string | undefined

        if (!shift) {
            return NextResponse.json({ error: 'Missing shift in request body' }, { status: 400 })
        }

        const profile = await createProfileInShare(badge, shift, body)

        if (!profile) {
            return NextResponse.json({ error: 'Profile already exists for this badge' }, { status: 409 })
        }

        return NextResponse.json({ profile }, { status: 201 })
    } catch (error) {
        console.error(`[users/${badge}/profile] POST failed`, error)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!badge || !/^\d+$/.test(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const deleted = await deleteProfileFromShare(badge)

        if (!deleted) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        return NextResponse.json({ ok: true, badge })
    } catch (error) {
        console.error(`[users/${badge}/profile] DELETE failed`, error)
        return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
    }
}
