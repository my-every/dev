/**
 * Update external locations to use normalizedTitle from legal drawings.
 *
 * This script:
 * 1. Scans all Legal Drawings manifests to build a mapping of sheetName -> normalizedTitle
 * 2. Updates each project manifest's externalLocations to use normalizedTitle as the location label
 * 3. Optionally updates wire-list-print-schema files as well
 *
 * Usage:
 *   pnpm tsx scripts/update-external-locations-normalized-title.ts [--dry-run]
 */

import fs from 'node:fs/promises'
import path from 'node:path'

function resolveShareRoot() {
  const configured = process.env.SHARE_DIR?.trim()
  if (configured && path.isAbsolute(configured)) return configured
  return path.join(process.cwd(), 'Share')
}

interface ExternalLocationConfig {
  location: string
  wireListVisible: boolean
  brandingVisible: boolean
  crossWireVisible?: boolean
}

interface LegalAssignment {
  sheetName?: string
  normalizedTitle?: string
}

interface LegalManifest {
  id: string
  pdNumber: string
  revision?: string
  assignments?: Record<string, LegalAssignment>
}

interface ProjectManifest {
  id: string
  pdNumber: string
  assignments?: Record<string, {
    sheetName?: string
    normalizedTitle?: string
    externalLocations?: ExternalLocationConfig[]
  }>
}

/**
 * Build a mapping of uppercase sheet names to their normalizedTitle from legal drawings.
 * Key: "SHEET_NAME" (uppercase), Value: normalizedTitle
 */
async function buildNormalizedTitleMapping(shareRoot: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>()
  const legalRoot = path.join(shareRoot, 'Legal Drawings')
  
  let pdFolders: string[]
  try {
    pdFolders = await fs.readdir(legalRoot)
  } catch {
    console.error(`Legal Drawings directory not found: ${legalRoot}`)
    return mapping
  }

  for (const pdFolder of pdFolders) {
    const pdPath = path.join(legalRoot, pdFolder)
    const stat = await fs.stat(pdPath).catch(() => null)
    if (!stat?.isDirectory()) continue

    // Each PD folder contains revision folders
    let revisionFolders: string[]
    try {
      revisionFolders = await fs.readdir(pdPath)
    } catch {
      continue
    }

    for (const revFolder of revisionFolders) {
      const manifestPath = path.join(pdPath, revFolder, 'project-manifest.json')
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8')
        const manifest: LegalManifest = JSON.parse(raw)
        
        if (!manifest.assignments) continue

        for (const assignment of Object.values(manifest.assignments)) {
          const sheetName = assignment.sheetName?.trim().toUpperCase()
          const normalizedTitle = assignment.normalizedTitle?.trim()
          
          if (sheetName && normalizedTitle) {
            // Only set if not already set (first match wins, or we could prefer longer/more specific)
            if (!mapping.has(sheetName)) {
              mapping.set(sheetName, normalizedTitle)
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return mapping
}

async function findProjectManifestPaths(shareRoot: string): Promise<string[]> {
  const projectsRoot = path.join(shareRoot, 'Projects')
  let entries: string[]
  try {
    entries = await fs.readdir(projectsRoot)
  } catch {
    console.error(`Projects directory not found: ${projectsRoot}`)
    return []
  }
  const results: string[] = []
  for (const entry of entries) {
    const manifestPath = path.join(projectsRoot, entry, 'state', 'project-manifest.json')
    try {
      await fs.access(manifestPath)
      results.push(manifestPath)
    } catch {
      // no manifest for this entry
    }
  }
  return results
}

function updateExternalLocations(
  externalLocations: ExternalLocationConfig[] | undefined,
  normalizedTitleMapping: Map<string, string>
): { updated: ExternalLocationConfig[]; changeCount: number } {
  if (!externalLocations || externalLocations.length === 0) {
    return { updated: [], changeCount: 0 }
  }

  let changeCount = 0
  const updated = externalLocations.map(loc => {
    const currentLocation = loc.location?.trim().toUpperCase()
    if (!currentLocation) return loc

    // Try to find a normalizedTitle for this location
    const normalizedTitle = normalizedTitleMapping.get(currentLocation)
    if (normalizedTitle && normalizedTitle !== loc.location) {
      changeCount++
      return { ...loc, location: normalizedTitle }
    }
    return loc
  })

  return { updated, changeCount }
}

async function findPrintSchemas(shareRoot: string): Promise<string[]> {
  const projectsRoot = path.join(shareRoot, 'Projects')
  const results: string[] = []
  
  let entries: string[]
  try {
    entries = await fs.readdir(projectsRoot)
  } catch {
    return results
  }

  for (const entry of entries) {
    const schemasDir = path.join(projectsRoot, entry, 'state', 'wire-list-print-schema')
    try {
      const schemaFiles = await fs.readdir(schemasDir)
      for (const file of schemaFiles) {
        if (file.endsWith('.json')) {
          results.push(path.join(schemasDir, file))
        }
      }
    } catch {
      // No schema directory
    }
  }
  
  return results
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const shareRoot = resolveShareRoot()

  console.log(`Share root: ${shareRoot}`)
  if (dryRun) console.log('DRY RUN — no writes will be made\n')

  // Step 1: Build the normalizedTitle mapping from legal drawings
  console.log('Building normalizedTitle mapping from Legal Drawings...')
  const normalizedTitleMapping = await buildNormalizedTitleMapping(shareRoot)
  console.log(`Found ${normalizedTitleMapping.size} sheet name -> normalizedTitle mappings\n`)

  if (normalizedTitleMapping.size === 0) {
    console.log('No mappings found. Exiting.')
    return
  }

  // Print some sample mappings
  console.log('Sample mappings:')
  let sampleCount = 0
  for (const [sheetName, normalizedTitle] of normalizedTitleMapping) {
    if (sampleCount++ >= 10) break
    console.log(`  ${sheetName} -> ${normalizedTitle}`)
  }
  console.log('')

  // Step 2: Update project manifests
  const manifestPaths = await findProjectManifestPaths(shareRoot)
  console.log(`Project manifests found: ${manifestPaths.length}`)

  let manifestsUpdated = 0
  let locationsUpdated = 0
  let manifestsErrored = 0

  for (const manifestPath of manifestPaths) {
    const projectId = path.basename(path.dirname(path.dirname(manifestPath)))
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8')
      const manifest: ProjectManifest = JSON.parse(raw)

      if (!manifest.assignments || typeof manifest.assignments !== 'object') {
        continue
      }

      let projectChanges = 0
      const updatedAssignments: Record<string, unknown> = {}

      for (const [slug, assignment] of Object.entries(manifest.assignments)) {
        if (assignment.externalLocations && assignment.externalLocations.length > 0) {
          const { updated, changeCount } = updateExternalLocations(
            assignment.externalLocations,
            normalizedTitleMapping
          )
          if (changeCount > 0) {
            projectChanges += changeCount
            updatedAssignments[slug] = { ...assignment, externalLocations: updated }
          } else {
            updatedAssignments[slug] = assignment
          }
        } else {
          updatedAssignments[slug] = assignment
        }
      }

      if (projectChanges > 0) {
        const updated = { ...manifest, assignments: updatedAssignments }
        if (!dryRun) {
          await fs.writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8')
        }
        console.log(`  ${dryRun ? 'WOULD UPDATE' : 'UPDATED'} ${projectId} — ${projectChanges} locations`)
        manifestsUpdated++
        locationsUpdated += projectChanges
      }
    } catch (err) {
      console.error(`  ERROR  ${projectId}:`, err)
      manifestsErrored++
    }
  }

  console.log(`\nManifest summary:`)
  console.log(`  Updated: ${manifestsUpdated}`)
  console.log(`  Locations changed: ${locationsUpdated}`)
  console.log(`  Errored: ${manifestsErrored}`)

  // Step 3: Update print schemas (optional - they store location groups)
  const schemaPaths = await findPrintSchemas(shareRoot)
  console.log(`\nPrint schemas found: ${schemaPaths.length}`)

  let schemasUpdated = 0
  let schemasErrored = 0

  for (const schemaPath of schemaPaths) {
    const schemaFile = path.basename(schemaPath)
    const projectId = path.basename(path.dirname(path.dirname(path.dirname(schemaPath))))
    try {
      const raw = await fs.readFile(schemaPath, 'utf-8')
      const schema = JSON.parse(raw)

      // Check if schema has processedLocationGroups
      if (!schema.processedLocationGroups || !Array.isArray(schema.processedLocationGroups)) {
        continue
      }

      let schemaChanges = 0
      const updatedGroups = schema.processedLocationGroups.map((group: { location?: string; [key: string]: unknown }) => {
        const currentLocation = group.location?.trim().toUpperCase()
        if (!currentLocation) return group

        const normalizedTitle = normalizedTitleMapping.get(currentLocation)
        if (normalizedTitle && normalizedTitle !== group.location) {
          schemaChanges++
          return { ...group, location: normalizedTitle }
        }
        return group
      })

      if (schemaChanges > 0) {
        const updated = { ...schema, processedLocationGroups: updatedGroups }
        if (!dryRun) {
          await fs.writeFile(schemaPath, JSON.stringify(updated, null, 2), 'utf-8')
        }
        console.log(`  ${dryRun ? 'WOULD UPDATE' : 'UPDATED'} ${projectId}/${schemaFile} — ${schemaChanges} groups`)
        schemasUpdated++
      }
    } catch (err) {
      console.error(`  ERROR  ${projectId}/${schemaFile}:`, err)
      schemasErrored++
    }
  }

  console.log(`\nSchema summary:`)
  console.log(`  Updated: ${schemasUpdated}`)
  console.log(`  Errored: ${schemasErrored}`)

  console.log('\nDone!')
}

main().catch(console.error)
