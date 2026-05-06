/**
 * SWS Auto-Detection
 * 
 * Automatically detects the appropriate SWS type based on:
 * - Drawing title
 * - Panel/box/console identifiers
 * - Enclosure type
 * - Keywords in the assignment context
 */

import type { SwsTemplateId, SwsTemplateDefinition } from '@/types/d380-sws'
import { SWS_TEMPLATE_REGISTRY } from './sws-template-registry'

// ============================================================================
// DETECTION CONTEXT
// ============================================================================

export interface SwsDetectionContext {
  /** Drawing title from layout PDF / coversheet */
  drawingTitle?: string

  /** Panel name (e.g., "PNL A", "PNL B") */
  panelName?: string

  /** Box identifier */
  boxName?: string

  /** Console identifier */
  consoleName?: string

  /** Number of bays (for consoles) */
  bays?: number

  /** Enclosure type if known */
  enclosureType?: 'BOX' | 'CONSOLE' | 'SKID'

  /** Assignment stage */
  stage?: 'BUILD_UP' | 'WIRING' | 'BOX_BUILD' | 'CROSS_WIRING' | 'PANEL_HANG'

  /** SWS-IPV ID if available from packet */
  swsIpvId?: string

  /** Additional keywords from context */
  keywords?: string[]
}

export interface SwsDetectionResult {
  /** Detected SWS type */
  detectedType: SwsTemplateId

  /** Confidence level */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'

  /** Score (higher is better) */
  score: number

  /** Reasons for the detection */
  reasons: string[]

  /** Alternative candidates in order of score */
  alternatives: SwsDetectionCandidate[]
}

export interface SwsDetectionCandidate {
  type: SwsTemplateId
  template: SwsTemplateDefinition
  score: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  matchedPatterns: string[]
}

// ============================================================================
// AUTO-DETECTION LOGIC
// ============================================================================

/**
 * Detect the most appropriate SWS type for the given context.
 */
export function detectSwsType(context: SwsDetectionContext): SwsDetectionResult {
  const candidates: SwsDetectionCandidate[] = []

  // Check each template
  for (const [swsType, template] of Object.entries(SWS_TEMPLATE_REGISTRY)) {
    const candidate = evaluateTemplate(template, context)
    if (candidate.score > 0) {
      candidates.push(candidate)
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  // Get the best match
  const best = candidates[0]

  if (!best) {
    // Default to PANEL_BUILD_WIRE if no match
    return {
      detectedType: 'PANEL_BUILD_WIRE',
      confidence: 'LOW',
      score: 0,
      reasons: ['No patterns matched, defaulting to Panel Build/Wire'],
      alternatives: [],
    }
  }

  return {
    detectedType: best.type,
    confidence: best.confidence,
    score: best.score,
    reasons: best.matchedPatterns,
    alternatives: candidates.slice(1),
  }
}

/**
 * Evaluate a template against the detection context.
 */
function evaluateTemplate(
  template: SwsTemplateDefinition,
  context: SwsDetectionContext
): SwsDetectionCandidate {
  let score = 0
  const matchedPatterns: string[] = []
  let highestConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'

  // Check SWS-IPV ID match (highest priority)
  if (context.swsIpvId && template.swsIpvId.includes(context.swsIpvId)) {
    score += 100
    matchedPatterns.push(`SWS-IPV ID match: ${context.swsIpvId}`)
    highestConfidence = 'HIGH'
  }

  // Check detection patterns
  for (const pattern of template.detectionPatterns) {
    let matched = false

    switch (pattern.type) {
      case 'DRAWING_TITLE':
        if (context.drawingTitle && pattern.pattern.test(context.drawingTitle)) {
          matched = true
          matchedPatterns.push(`Drawing title matched: ${context.drawingTitle}`)
        }
        break

      case 'PANEL_NAME':
        if (context.panelName && pattern.pattern.test(context.panelName)) {
          matched = true
          matchedPatterns.push(`Panel name matched: ${context.panelName}`)
        }
        break

      case 'ENCLOSURE_TYPE':
        if (context.enclosureType && pattern.pattern.test(context.enclosureType)) {
          matched = true
          matchedPatterns.push(`Enclosure type matched: ${context.enclosureType}`)
        }
        // Also check boxName/consoleName
        if (context.boxName && pattern.pattern.test('BOX')) {
          matched = true
          matchedPatterns.push(`Box context detected: ${context.boxName}`)
        }
        if (context.consoleName && pattern.pattern.test('CONSOLE')) {
          matched = true
          matchedPatterns.push(`Console context detected: ${context.consoleName}`)
        }
        break

      case 'KEYWORD':
        // Check drawing title for keywords
        if (context.drawingTitle) {
          for (const keyword of pattern.keywords || []) {
            if (context.drawingTitle.toUpperCase().includes(keyword)) {
              matched = true
              matchedPatterns.push(`Keyword "${keyword}" found in drawing title`)
            }
          }
        }
        // Check additional keywords
        if (context.keywords) {
          for (const keyword of pattern.keywords || []) {
            if (context.keywords.some(k => k.toUpperCase().includes(keyword))) {
              matched = true
              matchedPatterns.push(`Keyword "${keyword}" found in context`)
            }
          }
        }
        break
    }

    if (matched) {
      score += pattern.priority * getConfidenceMultiplier(pattern.confidence)
      if (compareConfidence(pattern.confidence, highestConfidence) > 0) {
        highestConfidence = pattern.confidence
      }
    }
  }

  // Check stage scope alignment
  if (context.stage && template.stageScopes.includes(context.stage as any)) {
    score += 10
    matchedPatterns.push(`Stage scope aligned: ${context.stage}`)
  }

  // Category-based heuristics
  if (context.boxName && !context.consoleName) {
    if (template.category === 'BOX') {
      score += 15
      matchedPatterns.push('Box context prioritizes BOX category')
    }
  }

  if (context.consoleName && !context.boxName) {
    if (template.category === 'CONSOLE') {
      score += 15
      matchedPatterns.push('Console context prioritizes CONSOLE category')
    }
  }

  // Cross-wiring stage detection
  if (context.stage === 'CROSS_WIRING') {
    if (template.category === 'CROSS_WIRE') {
      score += 25
      matchedPatterns.push('Cross-wiring stage prioritizes CROSS_WIRE templates')
    }
  }

  return {
    type: template.id,
    template,
    score,
    confidence: highestConfidence,
    matchedPatterns,
  }
}

function getConfidenceMultiplier(confidence: 'HIGH' | 'MEDIUM' | 'LOW'): number {
  switch (confidence) {
    case 'HIGH': return 3
    case 'MEDIUM': return 2
    case 'LOW': return 1
  }
}

function compareConfidence(a: 'HIGH' | 'MEDIUM' | 'LOW', b: 'HIGH' | 'MEDIUM' | 'LOW'): number {
  const order = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  return order[a] - order[b]
}

// ============================================================================
// DETECTION FROM DRAWING TITLE
// ============================================================================

/**
 * Detect SWS type from a drawing title string.
 * This is the primary detection method used when parsing layout PDFs.
 */
export function detectSwsTypeFromDrawingTitle(drawingTitle: string): SwsDetectionResult {
  return detectSwsType({ drawingTitle })
}

/**
 * Detect enclosure type from drawing title.
 */
export function detectEnclosureTypeFromTitle(drawingTitle: string): 'BOX' | 'CONSOLE' | 'SKID' | 'UNKNOWN' {
  const normalized = drawingTitle.toUpperCase()

  if (normalized.includes('CONSOLE') || normalized.includes('CON ')) {
    return 'CONSOLE'
  }
  if (normalized.includes('BOX') || normalized.includes('ENCLOSURE')) {
    return 'BOX'
  }
  if (normalized.includes('SKID')) {
    return 'SKID'
  }

  return 'UNKNOWN'
}

// ============================================================================
// TEAM LEAD SELECTION SUPPORT
// ============================================================================

export interface SwsSelectionOption {
  type: SwsTemplateId
  name: string
  shortLabel: string
  description: string
  isRecommended: boolean
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  reasons?: string[]
}

/**
 * Get SWS selection options for Team Lead, with detected type marked as recommended.
 */
export function getSwsSelectionOptions(context: SwsDetectionContext): SwsSelectionOption[] {
  const detection = detectSwsType(context)

  return Object.values(SWS_TEMPLATE_REGISTRY).map(template => ({
    type: template.id,
    name: template.name,
    shortLabel: template.shortLabel,
    description: template.description,
    isRecommended: template.id === detection.detectedType,
    confidence: template.id === detection.detectedType ? detection.confidence : undefined,
    reasons: template.id === detection.detectedType ? detection.reasons : undefined,
  }))
}

/**
 * Validate Team Lead's SWS selection against detected type.
 */
export function validateSwsSelection(
  selectedType: SwsTemplateId,
  context: SwsDetectionContext
): { isValid: boolean; warning?: string } {
  const detection = detectSwsType(context)

  if (selectedType === detection.detectedType) {
    return { isValid: true }
  }

  // Check if selected type is in alternatives
  const isAlternative = detection.alternatives.some(alt => alt.type === selectedType)

  if (!isAlternative && detection.confidence === 'HIGH') {
    return {
      isValid: true,
      warning: `Selected "${selectedType}" differs from auto-detected "${detection.detectedType}" (${detection.confidence} confidence). Please verify this is correct.`,
    }
  }

  return { isValid: true }
}
