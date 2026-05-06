import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface LegalDrawingsFileVersion {
  revision: string
  baseRevision: string
  isModified: boolean
  modificationNumber?: number
}

function formatProjectName(rawName: string) {
  return rawName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase())
}

export function extractProjectNumberFromLegalFolder(folderName: string) {
  const match = folderName.trim().match(/^([A-Z0-9]{3,10})/i)
  return match?.[1]?.toUpperCase() ?? folderName.trim().toUpperCase()
}

export function getProjectNameFromLegalFolder(folderName: string) {
  const pdNumber = extractProjectNumberFromLegalFolder(folderName)
  const remainder = folderName.slice(pdNumber.length).replace(/^[-_\s]+/, '')
  return remainder ? formatProjectName(remainder) : pdNumber
}

export async function resolveLegalProjectFilesDirectory(legalDrawingsRoot: string, folderName: string) {
  const projectFolderPath = path.join(legalDrawingsRoot, folderName)
  const electricalDirectory = path.join(projectFolderPath, 'Electrical')

  try {
    const stats = await fs.stat(electricalDirectory)
    if (stats.isDirectory()) {
      return electricalDirectory
    }
  } catch {
    // Fall back to the project folder when Electrical is absent.
  }

  return projectFolderPath
}

export function parseLegalDrawingsFileVersion(fileName: string): LegalDrawingsFileVersion {
  const modifiedMatch = fileName.match(/[_\- ]([A-Z]?\d+(?:\.\d+)?|[A-Z]\.\d+)(?:[_-]M[._-]?(\d+))?(?=\.[^.]+$)/i)

  if (!modifiedMatch) {
    return {
      revision: 'Imported',
      baseRevision: 'Imported',
      isModified: false,
    }
  }

  const baseRevision = (modifiedMatch[1] ?? 'Imported').toUpperCase()
  const modificationNumber = modifiedMatch[2] ? Number.parseInt(modifiedMatch[2], 10) : undefined
  const isModified = Number.isInteger(modificationNumber)

  return {
    revision: isModified ? `${baseRevision} M.${modificationNumber}` : baseRevision,
    baseRevision,
    isModified,
    modificationNumber,
  }
}

export function compareLegalDrawingsFileVersions(
  left: LegalDrawingsFileVersion,
  right: LegalDrawingsFileVersion,
) {
  const baseCompare = left.baseRevision.localeCompare(right.baseRevision, undefined, {
    numeric: true,
    sensitivity: 'base',
  })

  if (baseCompare !== 0) {
    return baseCompare
  }

  return (left.modificationNumber ?? -1) - (right.modificationNumber ?? -1)
}