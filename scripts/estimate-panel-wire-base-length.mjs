/**
 * estimate-panel-wire-base-length.mjs
 *
 * Uses blue-labels.json (device sequence + GR rail-end markers) combined with
 * layout-pages.json (rail lengths, physical device x-positions) to estimate
 * the base wire length between any two devices on the same sheet.
 *
 * Mental model
 * ─────────────
 * Blue-label columns list devices in assembly order: left column top→bottom,
 * then middle column top→bottom, etc. A GR-prefixed tag marks the end of each
 * DIN rail.  The resulting rail segments (split at every GR) map 1-to-1 with
 * the physical rails shown in layout-pages.
 *
 * Wire routing through a panel:
 *   • Horizontal run: along cable duct above each DIN rail (left ↔ right).
 *   • Vertical run: down the vertical cable duct between rails when crossing
 *     from one rail to another.
 *
 * For a same-rail pair  → base = |posA – posB|
 * For a cross-rail pair → base = (posA → right edge of rail A)
 *                               + sum of full rail lengths skipped
 *                               + (left edge of rail B → posB)
 *                         This is the *minimum* path (no back-tracking).
 *                         The *maximum* path is the reverse direction around
 *                         all rails.
 *                               + vertical drop between rail levels
 *                               + (left end of rail B → posB)        ← right duct
 *       OR                      (posA → left end of rail A)
 *                               + vertical drop
 *                               + (posB from left end of rail B)      ← left duct
 *         Whichever is shorter is the min; the other is the max.
 *
 * Device positions inside a rail are derived from:
 *   1. Actual x-coordinates from layout-pages when the device is placed there.
 *   2. Linear interpolation between the nearest neighbour devices that ARE
 *      in layout-pages, when a device only appears in blue-labels.
 *
 * Usage
 * ──────
 *   node scripts/estimate-panel-wire-base-length.mjs \
 *     --project "4K002" --revision "A.2" \
 *     --sheet "(SHT 5) PANEL A^JB70" \
 *     --from AU0090 --to KA0130
 *
 *   Or, for a full device-position dump of a sheet:
 *   node scripts/estimate-panel-wire-base-length.mjs \
 *     --project "4K002" --revision "A.2" \
 *     --sheet "(SHT 13) BOP CTRL^JB74" \
 *     --dump
 */

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

// ─── Argument parsing ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    project:        { type: 'string' },
    revision:       { type: 'string' },
    sheet:          { type: 'string' },
    from:           { type: 'string' },
    to:             { type: 'string' },
    dump:           { type: 'boolean', default: false },
    'wire-brand-list': { type: 'string' }, // path to a wire-brand-list JSON file
  },
  strict: false,
})

const SHARE_DIR = path.resolve(
  new URL('.', import.meta.url).pathname,
  '../Share/Legal Drawings'
)

// ─── Rail length parser ──────────────────────────────────────────────────────

/**
 * Parse the numeric rail length (inches) from a rail label string.
 * Handles formats like:
 *   "54.0\" Rail"   → 54
 *   "RAIL 51\""     → 51
 *   "14.25\" RAIL"  → 14.25
 */
function parseRailLengthIn(label) {
  const m = label.match(/(\d+\.?\d*)["']/)
  return m ? parseFloat(m[1]) : null
}

// ─── Core builder ────────────────────────────────────────────────────────────

/**
 * Build a complete device-position map for a single sheet column.
 *
 * @param {string[]} blDevices - ordered device tags from one blue-label column
 * @param {object[]} lpRailGroups - railGroups array from the matching layout-pages page
 * @returns {Map<string, {railIndex: number, railLabel: string, railLengthIn: number, posIn: number}>}
 */
function buildDevicePositionMap(blDevices, lpRailGroups, lpPanducts = []) {
  // ── 1. Split blue-label sequence at GR markers ───────────────────────────
  //    Each segment ends with (and includes) the GR device.
  //    Trailing devices after the last GR form one final segment.
  const blRailSegments = []
  let segment = []
  for (const tag of blDevices) {
    segment.push(tag)
    if (tag.startsWith('GR')) {
      blRailSegments.push(segment)
      segment = []
    }
  }
  if (segment.length) blRailSegments.push(segment)

  // ── 2. Build layout-pages lookup: tag → {railIndex, xNorm, railLengthIn} ─
  //    xNorm = distance from the leftmost device on that rail (pixels)
  //    We'll convert to inches using the scale derived from the rail label.
  const lpTagData = new Map() // tag → { railIdx, xRaw, railLengthIn }
  for (let ri = 0; ri < lpRailGroups.length; ri++) {
    const rg = lpRailGroups[ri]
    const railLengthIn = parseRailLengthIn(rg.railLabel)
    const devices = rg.devices ?? []
    if (devices.length === 0) continue

    const xs = devices.map(d => d.x)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const xSpanPx = xMax - xMin

    // Scale factor: px → inches
    // If only 1 device, we can't derive scale from positions alone — use
    // label length with that single device placed at position 0.
    const pxToIn = (railLengthIn && xSpanPx > 0)
      ? railLengthIn / xSpanPx
      : 1 // fallback: treat px as inches (only matters for 1-device rails)

    for (const d of devices) {
      lpTagData.set(d.tag, {
        railIdx: ri,
        posIn: (d.x - xMin) * pxToIn,
        railLengthIn: railLengthIn ?? 0,
      })
    }
  }

  // ── 3. Match each BL segment to a layout-pages rail ─────────────────────
  //    Strategy: find the LP rail that shares the most tags with this segment.
  //    Fallback: match by segment order.
  function bestMatchRail(segTags) {
    let best = -1, bestCount = -1
    for (let ri = 0; ri < lpRailGroups.length; ri++) {
      const lpTags = new Set((lpRailGroups[ri].devices ?? []).map(d => d.tag))
      const count = segTags.filter(t => lpTags.has(t)).length
      if (count > bestCount) { bestCount = count; best = ri }
    }
    return best
  }

  const segToRailIdx = blRailSegments.map((seg, si) => {
    const matched = bestMatchRail(seg)
    return matched >= 0 ? matched : si // fallback to segment order
  })

  // When multiple BL segments all map to the SAME LP rail (e.g. only 1 LP rail
  // exists but BL has 3 GR-split segments), collapse them so all devices share
  // the same railIndex.  This prevents false "cross-rail" routing.
  const uniqueLPRails = new Set(segToRailIdx)
  const collapsedSegToRailIdx = uniqueLPRails.size < blRailSegments.length
    ? segToRailIdx.map(ri => ri) // use LP rail index directly as the railIndex
    : segToRailIdx.map((_, si) => si) // each BL segment is a separate rail

  // ── 4. Assign positions to every device ─────────────────────────────────
  const positionMap = new Map() // tag → {...}

  for (let si = 0; si < blRailSegments.length; si++) {
    const seg = blRailSegments[si]
    const ri = collapsedSegToRailIdx[si]
    const rg = lpRailGroups[ri]
    const railLengthIn = (rg ? parseRailLengthIn(rg.railLabel) : null) ?? 0
    const railLabel = rg?.railLabel ?? `segment ${si}`

    // Collect known positions for devices in this segment that exist in layout-pages
    // knownPositions[k] = posIn for seg[k] if available, else undefined
    const knownPositions = seg.map(tag => {
      const d = lpTagData.get(tag)
      if (!d || d.railIdx !== ri) return undefined
      return d.posIn
    })

    // Interpolate unknown positions between known anchors
    // Edge cases: if no known positions, distribute evenly across rail length.
    const resolvedPositions = interpolatePositions(knownPositions, railLengthIn, seg.length)

    for (let k = 0; k < seg.length; k++) {
      positionMap.set(seg[k], {
        railIndex: ri,  // use the collapsed LP rail index (not BL segment index)
        railLabel,
        railLengthIn,
        posIn: resolvedPositions[k],
        interpolated: knownPositions[k] === undefined,
      })
    }
  }

  // ── 5. Build complete LP rail length map (all rails, even empty ones) ─────
  const lpRailLengthMap = new Map() // lpRailIndex → railLengthIn
  for (let ri = 0; ri < lpRailGroups.length; ri++) {
    const len = parseRailLengthIn(lpRailGroups[ri].railLabel) ?? 0
    lpRailLengthMap.set(ri, len)
  }

  // ── 6. Derive horizontal scale factor (px → in) from widest placed rail ──
  //    Assumes uniform x/y scale in the CAD drawing.
  let hScaleNum = null, hScalePx = 0
  for (let ri = 0; ri < lpRailGroups.length; ri++) {
    const rg = lpRailGroups[ri]
    const len = parseRailLengthIn(rg.railLabel)
    const spanPx = (rg.spanXEnd ?? 0) - (rg.spanXStart ?? 0)
    if (len && spanPx > hScalePx) { hScaleNum = len / spanPx; hScalePx = spanPx }
  }

  // ── 7. Match each LP rail to its nearest adjacent panduct ─────────────────
  function parsePanductLengthIn(label) {
    const m = label?.match(/(\d+\.?\d*)[xX](\d+\.?\d*)[xX](\d+\.?\d*)/)
    return m ? parseFloat(m[3]) : null
  }
  const railPanductMap = new Map() // lpRailIndex → { label, lengthIn, y, ... } | null
  for (let ri = 0; ri < lpRailGroups.length; ri++) {
    const rg = lpRailGroups[ri]
    if (!rg.railY) { railPanductMap.set(ri, null); continue }
    let best = null, bestDist = Infinity
    for (const pd of lpPanducts) {
      if (pd.y == null) continue
      const dist = Math.abs(pd.y - rg.railY)
      if (dist < bestDist) { bestDist = dist; best = pd }
    }
    railPanductMap.set(ri, best ? {
      label: best.label,
      lengthIn: parsePanductLengthIn(best.label),
      y: best.y,
      corridorTop: best.corridorTop,
      corridorBottom: best.corridorBottom,
    } : null)
  }

  // ── 8. Compute vertical drop between each consecutive LP rail pair ─────────
  //    Prefer panduct-y difference; fall back to railY difference.
  //    Convert px → inches using hScaleNum (uniform scale assumption).
  const railDropMap = new Map() // lpRailIndex → verticalDropIn to lpRailIndex+1
  const sortedByY = [...lpRailGroups.keys()].sort(
    (a, b) => (lpRailGroups[a].railY ?? 0) - (lpRailGroups[b].railY ?? 0)
  )
  for (let si = 0; si < sortedByY.length - 1; si++) {
    const riA = sortedByY[si]
    const riB = sortedByY[si + 1]
    const rgA = lpRailGroups[riA], rgB = lpRailGroups[riB]
    const pdA = railPanductMap.get(riA), pdB = railPanductMap.get(riB)
    const yA = pdA?.y ?? rgA.railY ?? 0
    const yB = pdB?.y ?? rgB.railY ?? 0
    const dropIn = hScaleNum ? Math.abs(yB - yA) * hScaleNum : 0
    // Map by the SMALLER rail index so routeDistance can sum ri1..ri2-1
    railDropMap.set(Math.min(riA, riB), dropIn)
  }

  return { positionMap, lpRailLengthMap, railDropMap, railPanductMap }
}

/**
 * Fill in undefined positions via linear interpolation between known anchors.
 * Unknown positions at the start are extrapolated backward from the first anchor.
 * Unknown positions at the end are extrapolated forward from the last anchor.
 * If NO known positions exist, devices are distributed evenly over totalLength.
 */
function interpolatePositions(known, totalLengthIn, count) {
  const result = [...known]

  // If nothing is known, spread evenly
  const allUnknown = known.every(v => v === undefined)
  if (allUnknown) {
    const step = count > 1 ? totalLengthIn / (count - 1) : 0
    return result.map((_, i) => i * step)
  }

  // Find first and last known indices
  const firstKnown = result.findIndex(v => v !== undefined)
  const lastKnown = result.map((v,i) => v !== undefined ? i : -1).filter(i => i >= 0).at(-1)

  // Forward fill from first known anchor to last known anchor (linear interp)
  let leftIdx = firstKnown
  for (let i = firstKnown + 1; i <= lastKnown; i++) {
    if (result[i] !== undefined) {
      // Fill gap from leftIdx+1 to i-1
      const steps = i - leftIdx
      const valLeft = result[leftIdx]
      const valRight = result[i]
      for (let j = leftIdx + 1; j < i; j++) {
        result[j] = valLeft + (valRight - valLeft) * ((j - leftIdx) / steps)
      }
      leftIdx = i
    }
  }

  // Extrapolate before first known: estimate average step from first known pair
  if (firstKnown > 0) {
    // Use the spacing between first two known positions as the unit step
    let step = 0
    for (let i = firstKnown + 1; i < result.length; i++) {
      if (result[i] !== undefined && i > firstKnown) {
        step = (result[i] - result[firstKnown]) / (i - firstKnown)
        break
      }
    }
    if (step <= 0) step = totalLengthIn / count
    for (let i = firstKnown - 1; i >= 0; i--) {
      result[i] = Math.max(0, result[i + 1] - step)
    }
  }

  // Extrapolate after last known
  if (lastKnown < count - 1) {
    let step = 0
    for (let i = lastKnown - 1; i >= 0; i--) {
      if (result[i] !== undefined && i < lastKnown) {
        step = (result[lastKnown] - result[i]) / (lastKnown - i)
        break
      }
    }
    if (step <= 0) step = totalLengthIn / count
    for (let i = lastKnown + 1; i < count; i++) {
      result[i] = Math.min(totalLengthIn, result[i - 1] + step)
    }
  }

  return result
}

// ─── Route distance calculator ───────────────────────────────────────────────

/**
 * Compute the min and max base wire path length (inches) between two devices.
 *
 * Min path: travel from fromDevice toward the toDevice, crossing rails in the
 *           shortest direction through the cable duct.
 * Max path: travel the long way around (opposite direction around all rails).
 *
 * @param {string} fromTag
 * @param {string} toTag
 * @param {Map} positionMap - output of buildDevicePositionMap
 * @returns {{ minIn: number, maxIn: number, path: string }}
 */
function routeDistance(fromTag, toTag, positionMap, lpRailLengthMap, railDropMap) {
  const a = positionMap.get(fromTag)
  const b = positionMap.get(toTag)
  if (!a) throw new Error(`Device not found in position map: ${fromTag}`)
  if (!b) throw new Error(`Device not found in position map: ${toTag}`)

  if (a.railIndex === b.railIndex) {
    const dist = Math.abs(a.posIn - b.posIn)
    return {
      minIn: dist,
      maxIn: dist,
      path: `same rail (${a.railLabel})`,
    }
  }

  // Order so ri1 < ri2
  const [ri1, d1, tag1, ri2, d2, tag2] =
    a.railIndex < b.railIndex
      ? [a.railIndex, a, fromTag, b.railIndex, b, toTag]
      : [b.railIndex, b, toTag, a.railIndex, a, fromTag]

  // Build full rail length map: prefer lpRailLengthMap (includes empty LP rails),
  // fall back to what's present in the position map.
  const rails = lpRailLengthMap ?? (() => {
    const m = new Map()
    for (const v of positionMap.values()) {
      if (!m.has(v.railIndex)) m.set(v.railIndex, v.railLengthIn)
    }
    return m
  })()
  const sortedRails = [...rails.entries()].sort((a, b) => a[0] - b[0])

  // Sum vertical drops from ri1 to ri2 (using consecutive-rail drop map)
  let totalVerticalDropIn = 0
  for (let ri = ri1; ri < ri2; ri++) {
    totalVerticalDropIn += railDropMap?.get(ri) ?? 0
  }

  // Route A (right duct):  device → right end of rail ri1
  //                        → drop vertically to ri2 level
  //                        → right end of rail ri2 → device
  const routeA = (d1.railLengthIn - d1.posIn) + totalVerticalDropIn + (d2.railLengthIn - d2.posIn)

  // Route B (left duct):   device → left end of rail ri1
  //                        → drop vertically to ri2 level
  //                        → left end of rail ri2 → device
  const routeB = d1.posIn + totalVerticalDropIn + d2.posIn

  const minIn = Math.min(routeA, routeB)
  const maxIn = Math.max(routeA, routeB)
  const shortRoute = routeA <= routeB ? 'right duct' : 'left duct'
  const dropNote = totalVerticalDropIn > 0 ? `${totalVerticalDropIn.toFixed(1)}" drop` : 'no drop data'

  return {
    minIn,
    maxIn,
    shortRoute,
    verticalDropIn: totalVerticalDropIn,
    path: `${tag1}(rail ${ri1} @${d1.posIn.toFixed(1)}"/${d1.railLengthIn}") → [${dropNote}] → ${tag2}(rail ${ri2} @${d2.posIn.toFixed(1)}"/${d2.railLengthIn}")`,
  }
}

    // Route A (right duct):  device → right end of rail ri1
    //                        → drop vertically to ri2 level
    //                        → right end of rail ri2 → device
    const routeA = (d1.railLengthIn - d1.posIn) + totalVerticalDropIn + (d2.railLengthIn - d2.posIn)

    // Route B (left duct):   device → left end of rail ri1
    //                        → drop vertically to ri2 level
    //                        → left end of rail ri2 → device
    const routeB = d1.posIn + totalVerticalDropIn + d2.posIn

    const minIn = Math.min(routeA, routeB)
    const maxIn = Math.max(routeA, routeB)
    const shortRoute = routeA <= routeB ? 'right duct' : 'left duct'
    const dropNote = totalVerticalDropIn > 0 ? `${totalVerticalDropIn.toFixed(1)}" drop` : 'no drop data'

    return {
      minIn,
      maxIn,
      shortRoute,
      verticalDropIn: totalVerticalDropIn,
      path: `${tag1}(rail ${ri1} @${d1.posIn.toFixed(1)}"/${d1.railLengthIn}") → [${dropNote}] → ${tag2}(rail ${ri2} @${d2.posIn.toFixed(1)}"/${d2.railLengthIn}")`,
      // Sum vertical drops from ri1 to ri2 (using consecutive-rail drop map)
      let totalVerticalDropIn = 0
      for (let ri = ri1; ri < ri2; ri++) {
        totalVerticalDropIn += railDropMap?.get(ri) ?? 0
      }

      // Route A (right duct):  device → right end of rail ri1
      //                        → drop vertically to ri2 level
      //                        → right end of rail ri2 → device
      const routeA = (d1.railLengthIn - d1.posIn) + totalVerticalDropIn + (d2.railLengthIn - d2.posIn)

      // Route B (left duct):   device → left end of rail ri1
      //                        → drop vertically to ri2 level
      //                        → left end of rail ri2 → device
      const routeB = d1.posIn + totalVerticalDropIn + d2.posIn

      const minIn = Math.min(routeA, routeB)
      const maxIn = Math.max(routeA, routeB)
      const shortRoute = routeA <= routeB ? 'right duct' : 'left duct'
      const dropNote = totalVerticalDropIn > 0 ? `${totalVerticalDropIn.toFixed(1)}" drop` : 'no drop data'

      return {
        minIn,
        maxIn,
        shortRoute,
        verticalDropIn: totalVerticalDropIn,
        path: `${tag1}(rail ${ri1} @${d1.posIn.toFixed(1)}"/${d1.railLengthIn}") → [${dropNote}] → ${tag2}(rail ${ri2} @${d2.posIn.toFixed(1)}"/${d2.railLengthIn}")`,
      }
    }
    }
  }
}

// ─── Sheet resolver: blue-labels column → layout-pages page ─────────────────

function loadSheetData(projectDir, sheetHeader) {
  const blPath = path.join(projectDir, 'sheets', 'blue-labels.json')
  const lpPath = path.join(projectDir, 'layout-pages.json')

  if (!fs.existsSync(blPath)) throw new Error(`blue-labels.json not found at ${blPath}`)
  if (!fs.existsSync(lpPath)) throw new Error(`layout-pages.json not found at ${lpPath}`)

  const bl = JSON.parse(fs.readFileSync(blPath, 'utf8'))
  const lp = JSON.parse(fs.readFileSync(lpPath, 'utf8'))

  // Find column
  const header = bl.headers.find(h => h === sheetHeader)
  if (!header) {
    throw new Error(
      `Sheet "${sheetHeader}" not found.\nAvailable: ${bl.headers.join(', ')}`
    )
  }
  const blDevices = bl.rawRows.map(r => r[header]).filter(Boolean)

  // Extract sheet number from header like "(SHT 5) PANEL A^JB70"
  const sht = parseInt(sheetHeader.match(/SHT\s+(\d+)/i)?.[1])
  const lpPage = lp.pages.find(p => p.pageNumber === sht)
  if (!lpPage) {
    throw new Error(`layout-pages page ${sht} not found (header: ${sheetHeader})`)
  }

  return { blDevices, lpRailGroups: lpPage.railGroups ?? [], pageTitle: lpPage.title }
  return { blDevices, lpRailGroups: lpPage.railGroups ?? [], lpPanducts: lpPage.panducts ?? [], pageTitle: lpPage.title }
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

async function main() {
  const project = args.project
  const revision = args.revision
  const sheet = args.sheet
  const wblPath = args['wire-brand-list']

  // ── Wire-brand-list bulk mode ─────────────────────────────────────────────
  if (wblPath) {
    const wbl = JSON.parse(fs.readFileSync(wblPath, 'utf8'))

    // Derive project/revision from the file if not provided
    const proj = project ?? wbl.projectInfo?.projectNumber
    const rev  = revision ?? wbl.projectInfo?.revision
    if (!proj || !rev) {
      console.error('Cannot determine project/revision. Pass --project and --revision or ensure projectInfo in the JSON.')
      process.exit(1)
    }

    const projectDir = path.join(SHARE_DIR, proj, rev)

    // Find the blue-label sheet header that matches this wire-brand-list's sheet name.
    // wbl.importHints.canonicalSheetName = e.g. "BOP CTRL^JB74"
    const canonical = wbl.importHints?.canonicalSheetName
    if (!canonical) {
      console.error('wire-brand-list is missing importHints.canonicalSheetName')
      process.exit(1)
    }

    // Resolve the full blue-labels header (includes sheet number: "(SHT 13) BOP CTRL^JB74")
    const blRaw = JSON.parse(fs.readFileSync(path.join(projectDir, 'sheets', 'blue-labels.json'), 'utf8'))
    const blHeader = blRaw.headers.find(h => h.includes(canonical.replace('^', ',')))
                  ?? blRaw.headers.find(h => h.replace(/\^/g, ',').includes(canonical.replace('^', ',')))
                  ?? blRaw.headers.find(h => h.includes(wbl.sheetName))

    if (!blHeader) {
      // Fallback: ask user to pick
      console.error(`Could not auto-match canonical name "${canonical}" to a blue-label column.`)
      console.error('Available columns:', blRaw.headers.join(', '))
      process.exit(1)
    }

    // Build position map once for this sheet
    const { blDevices, lpRailGroups, pageTitle } = loadSheetData(projectDir, blHeader)
    const { positionMap: posMap, lpRailLengthMap } = buildDevicePositionMap(blDevices, lpRailGroups)

    console.log(`\nProject:  ${proj}/${rev}`)
    console.log(`Sheet:    ${blHeader}`)
    console.log(`Page:     ${pageTitle}`)
    console.log(`BL devices: ${blDevices.length}  |  LP rails: ${lpRailGroups.length}`)
    console.log(`Wire rows:  ${wbl.totalRows}`)
    // Build position map once for this sheet
    const { blDevices, lpRailGroups, lpPanducts, pageTitle } = loadSheetData(projectDir, blHeader)
    const { positionMap: posMap, lpRailLengthMap, railDropMap, railPanductMap } =
      buildDevicePositionMap(blDevices, lpRailGroups, lpPanducts)

    console.log(`\nProject:  ${proj}/${rev}`)
    console.log(`Sheet:    ${blHeader}`)
    console.log(`Page:     ${pageTitle}`)
    console.log(`BL devices: ${blDevices.length}  |  LP rails: ${lpRailGroups.length}  |  Panducts: ${lpPanducts.length}`)
    // Show per-rail panduct adjacency and vertical drops
    for (let ri = 0; ri < lpRailGroups.length; ri++) {
      const pd = railPanductMap.get(ri)
      const drop = railDropMap.get(ri)
      const pdStr = pd ? `  panduct: ${pd.label} (${pd.lengthIn ?? '?'}")` : '  panduct: none'
      const dropStr = drop != null ? `  drop→next: ${drop.toFixed(1)}"` : ''
      console.log(`  Rail ${ri}: ${lpRailGroups[ri].railLabel}${pdStr}${dropStr}`)
    }
    console.log(`Wire rows:  ${wbl.totalRows}`)

    // Flatten all rows
    const rows = wbl.prefixGroups.flatMap(g => g.bundles.flatMap(b => b.rows))

    // Column widths
    const COL = { from: 18, to: 18, wireNo: 16, gauge: 6, listed: 7, min: 7, max: 7, delta: 8, note: 0 }
    const pad = (s, n) => String(s ?? '').padEnd(n)
    const lpad = (s, n) => String(s ?? '').padStart(n)

    const header = [
      pad('From Device', COL.from),
      pad('To Device', COL.to),
      pad('Wire No.', COL.wireNo),
      pad('Gauge', COL.gauge),
      lpad('Listed"', COL.listed),
      lpad('Min"', COL.min),
      lpad('Max"', COL.max),
      lpad('Delta"', COL.delta),
      'Note',
    ].join('  ')
    console.log('\n' + '─'.repeat(header.length))
    console.log(header)
    console.log('─'.repeat(header.length))

    let sameRailCount = 0, crossRailCount = 0, skippedCount = 0

    for (const row of rows) {
      // Extract base tag (strip terminal: "AF0183:COM" → "AF0183")
      const fromTag = row.fromDeviceId?.split(':')[0]
      const toTag   = row.toDeviceId?.split(':')[0]

      // Skip cross-location rows (toLocation different from this sheet's location)
      const rowLocNorm = row.toLocation?.replace(/\^/g, ',').replace(/\s/g, '') ?? ''
      const sheetLocNorm = canonical.replace(/\^/g, ',').replace(/\s/g, '')
      if (rowLocNorm !== sheetLocNorm) {
        skippedCount++
        continue
      }

      // Skip if either device is not in the position map
      if (!posMap.has(fromTag) || !posMap.has(toTag)) {
        const missing = [!posMap.has(fromTag) && fromTag, !posMap.has(toTag) && toTag].filter(Boolean)
        console.log(
          pad(row.fromDeviceId, COL.from) + '  ' +
          pad(row.toDeviceId, COL.to) + '  ' +
          pad(row.wireNo, COL.wireNo) + '  ' +
          pad(row.gaugeSize, COL.gauge) + '  ' +
          lpad(row.length, COL.listed) + '  ' +
          lpad('—', COL.min) + '  ' +
          lpad('—', COL.max) + '  ' +
          lpad('—', COL.delta) + '  ' +
          `SKIP: ${missing.join(', ')} not in position map`
        )
        skippedCount++
        continue
      }

      let result
      try {
        result = routeDistance(fromTag, toTag, posMap, lpRailLengthMap)
        result = routeDistance(fromTag, toTag, posMap, lpRailLengthMap, railDropMap)
      } catch (e) {
        console.log(pad(row.fromDeviceId, COL.from) + '  ' + pad(row.toDeviceId, COL.to) + '  ERROR: ' + e.message)
        skippedCount++
        continue
      }

      const isSame = result.path.startsWith('same rail')
      if (isSame) sameRailCount++; else crossRailCount++

      const listedIn = row.length
      const minIn    = result.minIn
      const maxIn    = result.maxIn
      const delta    = listedIn - minIn // how much padding the listed length adds over min

      const note = isSame
        ? `same rail (${posMap.get(fromTag).railLabel})`
        : result.shortRoute

      console.log([
        pad(row.fromDeviceId, COL.from),
        pad(row.toDeviceId, COL.to),
        pad(row.wireNo, COL.wireNo),
        pad(row.gaugeSize, COL.gauge),
        lpad(listedIn.toFixed(0), COL.listed),
        lpad(minIn.toFixed(1), COL.min),
        lpad(maxIn.toFixed(1), COL.max),
        lpad(delta.toFixed(1), COL.delta),
        note,
      ].join('  '))
    }

    console.log('─'.repeat(header.length))
    console.log(`Same-rail: ${sameRailCount}  Cross-rail: ${crossRailCount}  Skipped: ${skippedCount}`)
    return
  }

  // ── Single-sheet / dump / point-to-point modes ────────────────────────────
  if (!project || !revision || !sheet) {
    console.error('Usage:')
    console.error('  node estimate-panel-wire-base-length.mjs --wire-brand-list <path>')
    console.error('  node estimate-panel-wire-base-length.mjs --project 4K002 --revision A.2 --sheet "(SHT 5) PANEL A^JB70" [--from TAG --to TAG | --dump]')
    process.exit(1)
  }

  const projectDir = path.join(SHARE_DIR, project, revision)
  const { blDevices, lpRailGroups, pageTitle } = loadSheetData(projectDir, sheet)

  console.log(`\nProject: ${project}/${revision}`)
  console.log(`Sheet:   ${sheet}`)
  console.log(`Page:    ${pageTitle}`)
    const projectDir = path.join(SHARE_DIR, project, revision)
    const { blDevices, lpRailGroups, lpPanducts, pageTitle } = loadSheetData(projectDir, sheet)

    console.log(`\nProject: ${project}/${revision}`)
    console.log(`Sheet:   ${sheet}`)
    console.log(`Page:    ${pageTitle}`)
    console.log(`BL devices: ${blDevices.length}  |  LP rails: ${lpRailGroups.length}  |  Panducts: ${lpPanducts.length}`)

    const { positionMap: posMap, lpRailLengthMap, railDropMap, railPanductMap } =
      buildDevicePositionMap(blDevices, lpRailGroups, lpPanducts)
  console.log(`BL devices: ${blDevices.length}  |  LP rails: ${lpRailGroups.length}`)

  const { positionMap: posMap, lpRailLengthMap } = buildDevicePositionMap(blDevices, lpRailGroups)

  if (args.dump) {
    console.log('\n─── Device Position Map ────────────────────────────────────────────────')
    let curRail = -1
    for (const tag of blDevices) {
      const d = posMap.get(tag)
      if (!d) continue
      if (d.railIndex !== curRail) {
        curRail = d.railIndex
        console.log(`\n  Rail ${d.railIndex}: ${d.railLabel} (${d.railLengthIn}")`)
      }
      const interp = d.interpolated ? ' [interpolated]' : ''
      console.log(`    ${tag.padEnd(12)} ${d.posIn.toFixed(2).padStart(7)}"${interp}`)
    }
    return
  }

  const from = args.from
  const to = args.to
  if (!from || !to) {
    console.error('Provide --from TAG and --to TAG, or use --dump')
    process.exit(1)
  }

  const result = routeDistance(from, to, posMap, lpRailLengthMap)
  console.log(`\n─── Wire base length: ${from} → ${to} ───`)
  console.log(`  Path:      ${result.path}`)
  console.log(`  Short via: ${result.shortRoute}`)
  console.log(`  Min:       ${result.minIn.toFixed(2)}" (${(result.minIn / 12).toFixed(2)} ft)`)
  console.log(`  Max:       ${result.maxIn.toFixed(2)}" (${(result.maxIn / 12).toFixed(2)} ft)`)
  console.log(`  Midpoint:  ${((result.minIn + result.maxIn) / 2).toFixed(2)}"`)
  const result = routeDistance(from, to, posMap, lpRailLengthMap, railDropMap)
  console.log(`\n─── Wire base length: ${from} → ${to} ───`)
  console.log(`  Path:      ${result.path}`)
  console.log(`  Short via: ${result.shortRoute}`)
  if (result.verticalDropIn > 0)
    console.log(`  Vertical:  ${result.verticalDropIn.toFixed(2)}" (between rail levels)`)
  console.log(`  Min:       ${result.minIn.toFixed(2)}" (${(result.minIn / 12).toFixed(2)} ft)`)
  console.log(`  Max:       ${result.maxIn.toFixed(2)}" (${(result.maxIn / 12).toFixed(2)} ft)`)
  console.log(`  Midpoint:  ${((result.minIn + result.maxIn) / 2).toFixed(2)}"`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
