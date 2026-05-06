import { readFileSync } from 'fs'

const assignRef = JSON.parse(readFileSync('Share/References/layout-assignment-reference.json', 'utf8'))
const unitRef = JSON.parse(readFileSync('Share/References/layout-unit-box-panel-reference.json', 'utf8'))

const knownUnits = new Set(unitRef.mappings.unitTypeToBoxNumber.map(r => r.unitType))
const sortedUnits = [...knownUnits].sort((a, b) => b.length - a.length)

function extractUnitFromLocation(loc) {
  const upper = loc.toUpperCase()
  let bestMatch = null
  let bestIndex = -1
  for (const u of sortedUnits) {
    // Find last occurrence position so "TURBINE PANEL A JB70" -> JB70 wins over TURBINE
    const re = new RegExp(`(^|\\s)(${u})(\\s|$)`, 'g')
    let m
    while ((m = re.exec(upper)) !== null) {
      if (m.index > bestIndex) {
        bestIndex = m.index
        bestMatch = u
      }
    }
  }
  return bestMatch
}

const violationsMap = {}
let sameCount = 0
const unknownMap = {}

for (const proj of Object.values(assignRef.projects)) {
  const byUnit = proj.assignmentsByUnitType || {}
  for (const [unitType, sideMap] of Object.entries(byUnit)) {
    for (const [, assignMap] of Object.entries(sideMap)) {
      for (const [, assignment] of Object.entries(assignMap)) {
        if (!assignment || !assignment.externalLocations) continue
        for (const loc of assignment.externalLocations) {
          if (!loc) continue
          const eu = extractUnitFromLocation(loc)
          if (!eu) {
            unknownMap[loc] = (unknownMap[loc] || 0) + 1
          } else if (eu === unitType) {
            sameCount++
          } else {
            const key = `${unitType} -> ${eu}`
            if (!violationsMap[key]) violationsMap[key] = { count: 0, samples: new Set() }
            violationsMap[key].count++
            violationsMap[key].samples.add(loc)
          }
        }
      }
    }
  }
}

const totalV = Object.values(violationsMap).reduce((s, v) => s + v.count, 0)
const totalUnknown = Object.values(unknownMap).reduce((s, v) => s + v, 0)

console.log(`Same-unit refs (fine): ${sameCount}`)
console.log(`Unknown unit refs (no unit recognized): ${totalUnknown}`)
console.log(`Cross-unit violations: ${totalV}`)

console.log('\nViolation groups (unitType -> crossedUnit: count):')
Object.entries(violationsMap)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([k, v]) => {
    console.log(`  ${k}: ${v.count}`)
    ;[...v.samples].slice(0, 3).forEach(s => console.log(`    "${s}"`))
  })

console.log('\nUnknown external locations (top 30 by frequency):')
Object.entries(unknownMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([k, v]) => console.log(`  "${k}": ${v}`))

// Summary: which mappings are likely incorrect
console.log('\n--- MAPPING QUALITY ASSESSMENT ---')
if (totalV === 0) {
  console.log('No cross-unit violations detected. All assignments appear correctly mapped.')
} else {
  console.log(`${totalV} cross-unit location references detected.`)
  console.log('These indicate either:')
  console.log('  1) A misclassified assignment (assigned to wrong unitType)')
  console.log('  2) A multi-unit wiring harness that legitimately crosses units')
  console.log('  3) A location string that was recognized as the wrong unit type')
}

console.log(`\n${totalUnknown} external locations with no recognized unit type.`)
console.log('These could be valid location names or unrecognized unit types.')
