import { readFileSync } from 'fs'

const unitRef = JSON.parse(readFileSync('Share/References/layout-unit-box-panel-reference.json', 'utf8'))

const allRows = unitRef.mappings.unitTypeToBoxNumber
const knownUnits = new Set(allRows.map(r => r.unitType))
// Sort longest first so "JB1123" matches before "JB1"
const sortedUnits = [...knownUnits].sort((a, b) => b.length - a.length)

// Extract ALL unit type tokens found in a title (not just one)
function extractUnitsFromTitle(title) {
  const upper = title.toUpperCase()
  const found = new Set()
  for (const u of sortedUnits) {
    const re = new RegExp(`(^|\\s)${u}(\\s|$)`)
    if (re.test(upper)) found.add(u)
  }
  return found
}

const issues = {
  crossUnit: [],    // title contains a DIFFERENT unit type token
  noToken: [],      // title has no unit type token (ambiguous)
  correct: 0,
}

for (const row of allRows) {
  for (const t of row.assignments || []) {
    const detectedUnits = extractUnitsFromTitle(t.value)
    {
      const panelNumbersStr = (t.panelNumbers || []).map(p => p.value).join(', ')

      if (detectedUnits.size === 0) {
        issues.noToken.push({
          unitType: row.unitType,
          boxNumber: row.boxNumber,
          panelNumbers: panelNumbersStr,
          title: t.value,
          projectCount: t.projectCount,
        })
      } else if (!detectedUnits.has(row.unitType)) {
        // Title has unit tokens but NONE of them match the parent unit type
        issues.crossUnit.push({
          unitType: row.unitType,
          boxNumber: row.boxNumber,
          panelNumbers: panelNumbersStr,
          title: t.value,
          detectedUnits: [...detectedUnits],
          projectCount: t.projectCount,
        })
      } else if (detectedUnits.size > 1) {
        // Title correctly includes own unit type BUT ALSO another unit type token
        const otherUnits = [...detectedUnits].filter(u => u !== row.unitType)
        issues.crossUnit.push({
          unitType: row.unitType,
          boxNumber: row.boxNumber,
          panelNumbers: panelNumbersStr,
          title: t.value,
          detectedUnits: [...detectedUnits],
          otherUnits,
          note: 'multi-unit title (own unit present)',
          projectCount: t.projectCount,
        })
      } else {
        issues.correct++
      }
    }
  }
}

// Sort cross-unit issues by projectCount desc (more common = more impactful)
issues.crossUnit.sort((a, b) => b.projectCount - a.projectCount)
issues.noToken.sort((a, b) => b.projectCount - a.projectCount)

console.log('=== layout-unit-box-panel-reference validation ===\n')
console.log(`Total unitTypes: ${allRows.length}`)
console.log(`Titles correctly bearing own unit token: ${issues.correct}`)
console.log(`Titles with WRONG/NO unit match (cross-unit): ${issues.crossUnit.length}`)
console.log(`Titles with NO unit token (ambiguous): ${issues.noToken.length}`)

if (issues.crossUnit.length > 0) {
  console.log('\n--- Cross-unit title violations (title references a different unit type) ---')
  for (const v of issues.crossUnit) {
    const note = v.note ? ` [${v.note}]` : ''
    const crossed = v.otherUnits ? v.otherUnits.join(',') : v.detectedUnits.join(',')
    console.log(`  [${v.unitType}] "${v.title}" -> detected: ${crossed}${note} (${v.projectCount}x, panels: ${v.panelNumbers})`)
  }
}

if (issues.noToken.length > 0) {
  console.log('\n--- Ambiguous titles (no unit type token in title) ---')
  // Group by unitType
  const byUnit = {}
  for (const v of issues.noToken) {
    if (!byUnit[v.unitType]) byUnit[v.unitType] = []
    byUnit[v.unitType].push(v)
  }
  for (const [unitType, entries] of Object.entries(byUnit)) {
    console.log(`\n  [${unitType}]`)
    for (const e of entries) {
      console.log(`    "${e.title}" (${e.projectCount}x, panels: ${e.panelNumbers})`)
    }
  }
}

console.log('\n=== Summary ===')
console.log(`${issues.correct} correct, ${issues.crossUnit.length} cross-unit violations, ${issues.noToken.length} ambiguous (no token)`)
