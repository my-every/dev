import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import * as XLSX from 'xlsx'

import { buildCablePartNumberMap, buildPartNumberMap } from '@/lib/part-number-list'
import { getCablePartNumbersSheet, getPartListSheet } from '@/lib/workbook/build-project-model'
import type { StoredProject } from '@/types/d380-shared'

export interface DevicePartNumberEntry {
    partNumber: string
    description: string
    category?: string
    sheet?: string
}

export interface SheetDevicePartNumbersEntry {
    sheet: string
    devices: Record<string, DevicePartNumberEntry>
}

export interface DevicePartNumbersMap {
    generatedAt: string
    version: string
    devices: Record<string, DevicePartNumberEntry>
    sheets?: Record<string, SheetDevicePartNumbersEntry>
}

interface PartNumberLibraryEntry {
    description: string
    category?: string
}

interface ProjectPartNumberEntry {
    partNumber: string
    description: string
    location?: string
}

function normalizeSheetName(value: string | undefined): string {
    const normalized = String(value ?? '').trim()
    return normalized || 'UNASSIGNED'
}

function normalizeHeader(header: unknown): string {
    return String(header ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function getColumnIndex(headers: unknown[], aliases: string[]): number {
    const normalizedHeaders = headers.map(normalizeHeader)
    for (const alias of aliases) {
        const index = normalizedHeaders.findIndex(header => header === alias)
        if (index !== -1) {
            return index
        }
    }
    return -1
}

async function readPartNumberLibrary(): Promise<Record<string, PartNumberLibraryEntry>> {
    const libraryPath = path.join(process.cwd(), 'public/library/part-number-libary.csv')

    try {
        const buffer = await fs.readFile(libraryPath)
        const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, dense: true })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
            return {}
        }

        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
            header: 1,
            raw: false,
            defval: '',
            blankrows: false,
        })

        if (rows.length === 0) {
            return {}
        }

        const [headerRow, ...dataRows] = rows
        const partNumberIndex = getColumnIndex(headerRow, ['part number', 'partnumber'])
        const descriptionIndex = getColumnIndex(headerRow, ['description'])
        const categoryIndex = getColumnIndex(headerRow, ['category'])

        if (partNumberIndex === -1) {
            return {}
        }

        const library: Record<string, PartNumberLibraryEntry> = {}

        for (const row of dataRows) {
            if (!Array.isArray(row) || row.length === 0) continue

            let partNumber = ''
            if (partNumberIndex !== -1 && row[partNumberIndex]) {
                partNumber = String(row[partNumberIndex]).trim().toUpperCase()
            }

            let description = ''
            if (descriptionIndex !== -1 && row[descriptionIndex]) {
                description = String(row[descriptionIndex]).trim()
            }

            let category = ''
            if (categoryIndex !== -1 && row[categoryIndex]) {
                category = String(row[categoryIndex]).trim()
            }

            if (partNumber) {
                library[partNumber] = {
                    description,
                    category: category || undefined,
                }
            }
        }

        return library
    } catch (error) {
        console.error('Error reading part number library:', error)
        return {}
    }
}

function splitPartNumbers(partNumber: string | undefined): string[] {
    return String(partNumber ?? '')
        .split(/[\n,;]+/)
        .map(value => value.trim().toUpperCase())
        .filter(Boolean)
}

function getLibraryMetadata(
    library: Record<string, PartNumberLibraryEntry>,
    partNumber: string,
): PartNumberLibraryEntry | undefined {
    for (const token of splitPartNumbers(partNumber)) {
        const entry = library[token]
        if (entry) {
            return entry
        }
    }

    return undefined
}

function extractDevicePartNumbers(project: StoredProject): Record<string, ProjectPartNumberEntry> {
    const devicePartNumbers: Record<string, ProjectPartNumberEntry> = {}

    try {
        const partListSheet = getPartListSheet(project.projectModel)
        const cablePartNumbersSheet = getCablePartNumbersSheet(project.projectModel)

        const partNumberMap = buildPartNumberMap(partListSheet)
        const cablePartNumberMap = buildCablePartNumberMap(cablePartNumbersSheet)

        for (const [deviceId, entry] of partNumberMap.entries()) {
            devicePartNumbers[deviceId] = {
                partNumber: entry.partNumber,
                description: entry.description,
                location: entry.location,
            }
        }

        for (const [deviceId, entry] of cablePartNumberMap.entries()) {
            devicePartNumbers[deviceId] = {
                partNumber: entry.partNumber,
                description: entry.description,
                location: entry.location,
            }
        }
    } catch (error) {
        console.error('Error extracting device part numbers from project:', error)
    }

    return devicePartNumbers
}

export async function generateDevicePartNumbersMap(projectData?: StoredProject): Promise<DevicePartNumbersMap> {
    const devices: Record<string, DevicePartNumberEntry> = {}
    const sheets: Record<string, SheetDevicePartNumbersEntry> = {}

    try {
        // Load part number library metadata
        const library = await readPartNumberLibrary()

        // Extract device-to-part-number mappings from project
        if (projectData) {
            const devicePartNumbers = extractDevicePartNumbers(projectData)

            for (const [deviceId, entry] of Object.entries(devicePartNumbers)) {
                const libraryEntry = getLibraryMetadata(library, entry.partNumber)
                const sheetName = normalizeSheetName(entry.location)
                const deviceEntry: DevicePartNumberEntry = {
                    partNumber: entry.partNumber,
                    description: entry.description || libraryEntry?.description || '',
                    category: libraryEntry?.category,
                    sheet: sheetName,
                }

                devices[deviceId] = deviceEntry

                if (!sheets[sheetName]) {
                    sheets[sheetName] = {
                        sheet: sheetName,
                        devices: {},
                    }
                }

                sheets[sheetName].devices[deviceId] = deviceEntry
            }
        }

        return {
            generatedAt: new Date().toISOString(),
            version: '1.0',
            devices,
            sheets,
        }
    } catch (error) {
        console.error('Error generating device-part-numbers map:', error)
        return {
            generatedAt: new Date().toISOString(),
            version: '1.0',
            devices: {},
        }
    }
}

export async function saveDevicePartNumbersMap(
    projectDirectory: string,
    map: DevicePartNumbersMap,
): Promise<void> {
    const stateDir = path.join(projectDirectory, 'state')
    const filePath = path.join(stateDir, 'device-part-numbers.json')

    try {
        await fs.mkdir(stateDir, { recursive: true })
        await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8')
    } catch (error) {
        console.error('Error saving device-part-numbers map:', error)
    }
}

export async function readDevicePartNumbersMap(
    projectDirectory: string,
): Promise<DevicePartNumbersMap | null> {
    const stateDir = path.join(projectDirectory, 'state')
    const filePath = path.join(stateDir, 'device-part-numbers.json')

    try {
        const raw = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(raw) as DevicePartNumbersMap
    } catch {
        return null
    }
}
