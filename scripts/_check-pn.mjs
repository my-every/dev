import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const d = require('./Share/References/layout-unit-box-panel-reference.json')
const units = d.mappings.unitTypeToBoxNumber

const jb70 = units.find(u => u.unitType === 'JB70')
const jb70Parts = new Set(jb70.partNumbers)

console.log('=== 2BAY assignments vs JB70 part pool ===')
const bay2 = units.find(u => u.unitType === '2BAY')
for (const a of bay2.assignments) {
  if (!a.partNumbers.length) continue
  const overlap = a.partNumbers.filter(pn => jb70Parts.has(pn))
  const pct = Math.round(overlap.length / a.partNumbers.length * 100)
  console.log(pct + '% (' + overlap.length + '/' + a.partNumbers.length + ')  ' + a.value)
}

console.log()
console.log('=== All units: assignments with high JB70 overlap (>50%) ===')
for (const unit of units) {
  if (unit.unitType === 'JB70') continue
  for (const a of unit.assignments) {
    if (!a.partNumbers.length) continue
    const overlap = a.partNumbers.filter(pn => jb70Parts.has(pn))
    const pct = overlap.length / a.partNumbers.length
    if (pct >= 0.5) {
      console.log(Math.round(pct*100) + '% ' + unit.unitType + '/' + a.value + ' (' + overlap.length + '/' + a.partNumbers.length + ')')
    }
  }
}
