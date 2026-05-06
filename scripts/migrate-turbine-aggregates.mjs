#!/usr/bin/env node
/**
 * One-off migration: re-key TURBINE → JB70 in layout-pages-aggregates-reference.json.
 * Covers regrouped.unitTypeToBoxNumbers, regrouped.boxNumberToUnitTypes, and aggregates.unitTypes.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const APP_ROOT = process.cwd()
const AGGREGATES_PATH = path.join(APP_ROOT, 'Share', 'References', 'layout-pages-aggregates-reference.json')

const raw = await fs.readFile(AGGREGATES_PATH, 'utf-8')
const ref = JSON.parse(raw)

// --- 1. aggregates.unitTypes: merge TURBINE count into JB70 ---
{
  const list = ref.aggregates?.unitTypes ?? []
  const turbineEntry = list.find((e) => e.value === 'TURBINE')
  const jb70Entry = list.find((e) => e.value === 'JB70')
  if (turbineEntry) {
    if (jb70Entry) {
      jb70Entry.projectCount = Math.max(jb70Entry.projectCount, turbineEntry.projectCount)
    }
    const idx = list.indexOf(turbineEntry)
    list.splice(idx, 1)
    // Re-sort by projectCount desc
    list.sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))
    console.log(`[aggregates.unitTypes] TURBINE removed, JB70 projectCount updated`)
  }
}

// --- 2. regrouped.unitTypeToBoxNumbers: merge TURBINE boxNumbers into JB70 ---
{
  const list = ref.regrouped?.unitTypeToBoxNumbers ?? []
  const turbineIdx = list.findIndex((e) => e.unitType === 'TURBINE')
  const jb70 = list.find((e) => e.unitType === 'JB70')

  if (turbineIdx !== -1 && jb70) {
    const turbine = list[turbineIdx]
    const existingBoxNumbers = new Set(jb70.boxNumbers.map((b) => b.value))
    let added = 0
    for (const box of turbine.boxNumbers) {
      if (!existingBoxNumbers.has(box.value)) {
        jb70.boxNumbers.push(box)
        existingBoxNumbers.add(box.value)
        added++
      } else {
        // Merge projectCount
        const existing = jb70.boxNumbers.find((b) => b.value === box.value)
        if (existing) existing.projectCount = Math.max(existing.projectCount, box.projectCount)
      }
    }
    jb70.projectCount = Math.max(jb70.projectCount, turbine.projectCount)
    jb70.boxNumbers.sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))
    list.splice(turbineIdx, 1)
    list.sort((a, b) => (b.projectCount - a.projectCount) || a.unitType.localeCompare(b.unitType))
    console.log(`[regrouped.unitTypeToBoxNumbers] TURBINE removed, ${added} box numbers added to JB70`)
  } else if (turbineIdx !== -1) {
    console.log(`[regrouped.unitTypeToBoxNumbers] TURBINE found but JB70 missing — skipping merge`)
  } else {
    console.log(`[regrouped.unitTypeToBoxNumbers] No TURBINE entry found`)
  }
}

// --- 3. regrouped.boxNumberToUnitTypes: re-key TURBINE → JB70 in each entry's unitTypes ---
{
  let rekeyed = 0
  for (const boxEntry of ref.regrouped?.boxNumberToUnitTypes ?? []) {
    const turbineUnit = boxEntry.unitTypes?.find((u) => u.value === 'TURBINE')
    if (!turbineUnit) continue

    const jb70Unit = boxEntry.unitTypes.find((u) => u.value === 'JB70')
    if (jb70Unit) {
      jb70Unit.projectCount = Math.max(jb70Unit.projectCount, turbineUnit.projectCount)
    } else {
      boxEntry.unitTypes.push({ value: 'JB70', projectCount: turbineUnit.projectCount })
    }
    const idx = boxEntry.unitTypes.indexOf(turbineUnit)
    boxEntry.unitTypes.splice(idx, 1)
    boxEntry.unitTypes.sort((a, b) => (b.projectCount - a.projectCount) || a.value.localeCompare(b.value))
    rekeyed++
  }
  console.log(`[regrouped.boxNumberToUnitTypes] TURBINE re-keyed to JB70 in ${rekeyed} box entries`)
}

await fs.writeFile(AGGREGATES_PATH, JSON.stringify(ref, null, 2), 'utf-8')
console.log(`[migrate-turbine-aggregates] done`)
