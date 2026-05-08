/**
 * Backfill manifest promoted fields for all projects.
 *
 * Reads every project-manifest.json under Share/Projects and promotes
 * nested fields to the top level of each assignment node. This is a pure
 * JSON transformation — it does not invoke server-only enrichment pipelines.
 *
 * Fields promoted:
 *   - normalizedTitle  (from layout.primaryPage.normalizedTitle)
 *   - panelNumber      (from layout.primaryPage.panelNumber)
 *   - boxNumber        (from layout.primaryPage.boxNumber)
 *   - priorityLevel    (from priority.level)
 *   - assignedBadge    (from boardAssignment.assignedBadge)
 *   - workflowStatus   (from boardAssignment.workflowStatus)
 *
 * Usage:
 *   pnpm tsx scripts/backfill-manifest-promoted-fields.ts [--dry-run]
 */

import fs from 'node:fs/promises'
import path from 'node:path'

function resolveShareRoot() {
  const configured = process.env.SHARE_DIR?.trim()
  if (configured && path.isAbsolute(configured)) return configured
  return path.join(process.cwd(), 'Share')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function promoteAssignmentFields(assignment: any): any {
  const primaryPage = assignment.layout?.primaryPage ?? null
  const boardAssignment = assignment.boardAssignment ?? null
  return {
    ...assignment,
    normalizedTitle: primaryPage?.normalizedTitle ?? assignment.normalizedTitle ?? undefined,
    panelNumber: primaryPage?.panelNumber ?? assignment.panelNumber ?? null,
    boxNumber: primaryPage?.boxNumber ?? assignment.boxNumber ?? null,
    priorityLevel: assignment.priority?.level ?? assignment.priorityLevel ?? undefined,
    assignedBadge: boardAssignment?.assignedBadge ?? assignment.assignedBadge ?? null,
    workflowStatus: boardAssignment?.workflowStatus ?? assignment.workflowStatus ?? null,
  }
}

async function findManifestPaths(shareRoot: string): Promise<string[]> {
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

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const shareRoot = resolveShareRoot()

  const manifestPaths = await findManifestPaths(shareRoot)
  console.log(`Share root: ${shareRoot}`)
  console.log(`Manifests found: ${manifestPaths.length}`)
  if (dryRun) console.log('DRY RUN — no writes will be made\n')

  let enriched = 0
  let skipped = 0
  let errored = 0

  for (const manifestPath of manifestPaths) {
    const projectId = path.basename(path.dirname(path.dirname(manifestPath)))
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw)

      if (!manifest.assignments || typeof manifest.assignments !== 'object') {
        console.warn(`  SKIP  ${projectId} — no assignments`)
        skipped++
        continue
      }

      const updatedAssignments: Record<string, unknown> = {}
      for (const [slug, assignment] of Object.entries(manifest.assignments)) {
        updatedAssignments[slug] = promoteAssignmentFields(assignment)
      }

      const updated = { ...manifest, assignments: updatedAssignments }

      if (!dryRun) {
        await fs.writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8')
      }

      // Sample output for first assignment
      const firstSlug = Object.keys(updatedAssignments)[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = firstSlug ? (updatedAssignments[firstSlug] as any) : null
      const sample = first
        ? `priorityLevel=${first.priorityLevel ?? '—'} assignedBadge=${first.assignedBadge ?? '—'} panelNumber=${first.panelNumber ?? '—'}`
        : 'no assignments'
      console.log(`  OK    ${projectId.padEnd(20, ' ')} ${sample}`)
      enriched++
    } catch (err) {
      console.error(`  ERROR ${projectId} — ${err instanceof Error ? err.message : String(err)}`)
      errored++
    }
  }

  console.log(`\nDone. enriched=${enriched} skipped=${skipped} errored=${errored}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exitCode = 1
})
