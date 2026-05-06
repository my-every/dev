import type { DevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'
import { readDevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'

/**
 * Get part number for a device from the project's device part numbers map
 * Falls back gracefully if map doesn't exist or device not found
 */
export async function getProjectDevicePartNumber(
    projectDirectory: string,
    deviceId: string,
): Promise<string | null> {
    const map = await readDevicePartNumbersMap(projectDirectory)
    if (!map) return null

    const baseDeviceId = deviceId?.split(':')[0]?.trim().toUpperCase() || ''
    const entry = map.devices[baseDeviceId]

    return entry?.partNumber ?? null
}

/**
 * Get all device part numbers for a project from the map
 */
export async function getProjectDevicePartNumbersMap(
    projectDirectory: string,
): Promise<DevicePartNumbersMap | null> {
    return readDevicePartNumbersMap(projectDirectory)
}
