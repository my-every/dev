#!/usr/bin/env node
/**
 * One-off migration: merge the phantom TURBINE unit type into JB70.
 *
 * TURBINE is a product type descriptor, not a physical enclosure.
 * All TURBINE-named sheets belong to JB70. This script:
 *   1. Merges TURBINE assignments into JB70 (deduplicating by value)
 *   2. Merges TURBINE alternateBoxes into JB70 (deduplicating by boxNumber)
 *   3. Merges TURBINE partNumbers into JB70 (deduplicating)
 *   4. Re-keys brandingLengthReference.entries from TURBINE → JB70
 *   5. Removes the TURBINE entry from unitTypeToBoxNumber
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const APP_ROOT = process.cwd()
const REFERENCE_PATH = path.join(APP_ROOT, 'Share', 'References', 'layout-unit-box-panel-reference.json')

const raw = await fs.readFile(REFERENCE_PATH, 'utf-8')
const ref = JSON.parse(raw)

const units = ref.mappings?.unitTypeToBoxNumber
if (!Array.isArray(units)) {
  console.error('No unitTypeToBoxNumber array found')
  process.exit(1)
}

const turbineIdx = units.findIndex((u) => u.unitType === 'TURBINE')
const jb70Idx = units.findIndex((u) => u.unitType === 'JB70')

if (turbineIdx === -1) {
  console.log('No TURBINE entry found — nothing to migrate.')
  process.exit(0)
}
if (jb70Idx === -1) {
  console.error('No JB70 entry found — cannot merge.')
  process.exit(1)
}

const turbine = units[turbineIdx]
const jb70 = units[jb70Idx]

// --- Merge assignments ---
const existingAssignmentValues = new Set(jb70.assignments.map((a) => a.value))
let addedAssignments = 0
for (const assignment of turbine.assignments ?? []) {
  if (!existingAssignmentValues.has(assignment.value)) {
    jb70.assignments.push(assignment)
    existingAssignmentValues.add(assignment.value)
    addedAssignments++
  } else {
    // Merge brandingLengths if JB70's entry is empty
    const jb70Assignment = jb70.assignments.find((a) => a.value === assignment.value)
    if (jb70Assignment && (!jb70Assignment.brandingLengths || jb70Assignment.brandingLengths.length === 0)
        && assignment.brandingLengths?.length > 0) {
      jb70Assignment.brandingLengths = assignment.brandingLengths
    }
    // Merge partNumbers
    if (jb70Assignment && Array.isArray(assignment.partNumbers)) {
      const existingPNs = new Set(jb70Assignment.partNumbers)
      for (const pn of assignment.partNumbers) {
        if (!existingPNs.has(pn)) {
          jb70Assignment.partNumbers.push(pn)
          existingPNs.add(pn)
        }
      }
    }
  }
}

// --- Merge alternateBoxes ---
const existingBoxNumbers = new Set([jb70.boxNumber, ...(jb70.alternateBoxes ?? []).map((b) => b.boxNumber)])
let addedBoxes = 0
for (const box of turbine.alternateBoxes ?? []) {
  if (!existingBoxNumbers.has(box.boxNumber)) {
    jb70.alternateBoxes.push(box)
    existingBoxNumbers.add(box.boxNumber)
    addedBoxes++
  }
}

// Also add TURBINE's canonical box if it's a real box number (not UNITBOX:*)
if (turbine.boxNumber && !turbine.boxNumber.startsWith('UNITBOX:') && !existingBoxNumbers.has(turbine.boxNumber)) {
  jb70.alternateBoxes.push({ boxNumber: turbine.boxNumber, projectCount: turbine.projectCount })
  addedBoxes++
}

// --- Merge partNumbers ---
const existingPNs = new Set(jb70.partNumbers)
let addedPNs = 0
for (const pn of turbine.partNumbers ?? []) {
  if (!existingPNs.has(pn)) {
    jb70.partNumbers.push(pn)
    existingPNs.add(pn)
    addedPNs++
  }
}
jb70.partNumbers.sort()

// --- Re-key brandingLengthReference entries ---
let rekeyedEntries = 0
for (const entry of ref.brandingLengthReference?.entries ?? []) {
  if (entry.unitType === 'TURBINE') {
    entry.unitType = 'JB70'
    rekeyedEntries++
  }
}

// --- Remove TURBINE from unitTypeToBoxNumber ---
units.splice(turbineIdx, 1)

await fs.writeFile(REFERENCE_PATH, JSON.stringify(ref, null, 2), 'utf-8')

console.log(`[migrate-turbine-to-jb70] done`)
console.log(`  assignments added to JB70: ${addedAssignments}`)
console.log(`  alternate boxes added to JB70: ${addedBoxes}`)
console.log(`  part numbers added to JB70: ${addedPNs}`)
console.log(`  brandingLengthReference entries re-keyed TURBINE→JB70: ${rekeyedEntries}`)
console.log(`  TURBINE entry removed from unitTypeToBoxNumber`)
