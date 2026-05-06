import { NextRequest, NextResponse } from 'next/server'

import {
    readProjectManifest,
    readStoredProjectFromState,
    resolveProjectRootDirectory,
} from '@/lib/project-state/share-project-state-handlers'
import {
    generateDevicePartNumbersMap,
    readDevicePartNumbersMap,
    saveDevicePartNumbersMap,
} from '@/lib/project-state/device-part-numbers-generator'

export const dynamic = 'force-dynamic'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params

    const manifest = await readProjectManifest(projectId)
    if (!manifest) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectRoot = await resolveProjectRootDirectory(projectId, {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
    })
    if (!projectRoot) {
        return NextResponse.json({ devices: {} })
    }

    const map = await readDevicePartNumbersMap(projectRoot)
    return NextResponse.json({ devices: map?.devices ?? {}, generatedAt: map?.generatedAt })
}

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params

    try {
        const stored = await readStoredProjectFromState(projectId)
        if (!stored) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Project not found',
                },
                { status: 404 },
            )
        }

        const map = await generateDevicePartNumbersMap(stored.project)
        await saveDevicePartNumbersMap(stored.root, map)

        return NextResponse.json({
            success: true,
            deviceCount: Object.keys(map.devices).length,
            generatedAt: map.generatedAt,
            message: 'Device part numbers generated successfully',
        })
    } catch (error) {
        console.error('Error generating device part numbers:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to generate device part numbers',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        )
    }
}
