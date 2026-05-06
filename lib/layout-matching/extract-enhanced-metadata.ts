/**
 * Enhanced PDF Metadata Extraction
 * 
 * Extends the base PDF parsing to extract additional valuable metadata
 * from layout drawings including title block info, dimensions, annotations,
 * and structural operationships.
 */

// ============================================================================
// Enhanced Metadata Types
// ============================================================================

/**
 * Title block information typically found in engineering drawings.
 */
export interface TitleBlockMetadata {
  drawingNumber?: string;
  drawingTitle?: string;
  revision?: string;
  revisionDate?: string;
  projectNumber?: string;
  projectName?: string;
  customerName?: string;
  sheetNumber?: number;
  totalSheets?: number;
  scale?: string;
  drawnBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  dateDrawn?: string;
  dateChecked?: string;
  dateApproved?: string;
  department?: string;
  plantCode?: string;
}

/**
 * Enclosure/panel physical dimensions.
 */
export interface EnclosureDimensions {
  widthInches?: number;
  heightInches?: number;
  depthInches?: number;
  orientation: 'portrait' | 'landscape';
  nemaRating?: string;
  material?: string;
}

/**
 * Terminal strip/block reference.
 */
export interface TerminalStripReference {
  id: string;
  label: string;
  terminalCount?: number;
  position?: { x: number; y: number };
  railId?: string;
  pageNumber: number;
}

/**
 * Wire/cable annotation found on the drawing.
 */
export interface WireAnnotation {
  fromDevice?: string;
  toDevice?: string;
  wireNumber?: string;
  wireColor?: string;
  wireGauge?: string;
  cableType?: string;
  length?: string;
  pageNumber: number;
  lineNumber: number;
}

/**
 * Component callout/label.
 */
export interface ComponentCallout {
  deviceId: string;
  label?: string;
  description?: string;
  partNumber?: string;
  manufacturer?: string;
  position?: { x: number; y: number };
  pageNumber: number;
}

/**
 * Cross-reference to another drawing/sheet.
 */
export interface CrossReference {
  referenceType: 'wire' | 'signal' | 'device' | 'sheet';
  fromSheet?: string;
  toSheet?: string;
  fromDevice?: string;
  toDevice?: string;
  wireNumber?: string;
  zone?: string;
  pageNumber: number;
}

/**
 * Zone/area designation on the drawing.
 */
export interface DrawingZone {
  zoneId: string;
  label: string;
  bounds?: { x: number; y: number; width: number; height: number };
  pageNumber: number;
}

/**
 * Complete enhanced metadata for a PDF page.
 */
export interface EnhancedPageMetadata {
  pageNumber: number;
  titleBlock: TitleBlockMetadata;
  enclosure?: EnclosureDimensions;
  terminalStrips: TerminalStripReference[];
  wireAnnotations: WireAnnotation[];
  componentCallouts: ComponentCallout[];
  crossReferences: CrossReference[];
  zones: DrawingZone[];
  revisionHistory: RevisionEntry[];
  notes: DrawingNote[];
  billOfMaterials: BOMEntry[];
}

/**
 * Revision history entry.
 */
export interface RevisionEntry {
  revision: string;
  date?: string;
  description: string;
  author?: string;
}

/**
 * Drawing note/annotation.
 */
export interface DrawingNote {
  noteNumber?: number;
  text: string;
  category?: 'general' | 'warning' | 'specification' | 'installation';
  pageNumber: number;
}

/**
 * Bill of materials entry.
 */
export interface BOMEntry {
  itemNumber: number;
  partNumber: string;
  description: string;
  quantity: number;
  manufacturer?: string;
  reference?: string;
}

/**
 * Summary of all enhanced metadata across pages.
 */
export interface EnhancedMetadataSummary {
  projectInfo: {
    projectNumber?: string;
    projectName?: string;
    customerName?: string;
    totalSheets: number;
    revisions: string[];
    latestRevision?: string;
    latestRevisionDate?: string;
  };
  physicalSummary: {
    enclosureCount: number;
    totalRails: number;
    totalPanducts: number;
    uniqueEnclosureSizes: string[];
  };
  deviceSummary: {
    totalDevices: number;
    devicesByFamily: Record<string, number>;
    terminalStripCount: number;
  };
  wiringSummary: {
    totalWireAnnotations: number;
    uniqueWireColors: string[];
    uniqueGauges: string[];
    crossReferenceCount: number;
  };
  qualityMetrics: {
    pagesWithTitleBlock: number;
    pagesWithBOM: number;
    pagesWithRevisionHistory: number;
    completenessScore: number; // 0-100
  };
}

// ============================================================================
// Regex Patterns for Enhanced Extraction
// ============================================================================

/**
 * Pattern to match drawing numbers like "DWG-380-001" or "380-EL-001"
 */
const DRAWING_NUMBER_PATTERN = /\b(DWG|DRG|DRAWING)?[-\s]?(\d{3,}[-][A-Z]{1,3}[-]\d{2,}|\d{3,}[-]\d{2,}[-]\d{2,})\b/i;

/**
 * Pattern to match revision indicators like "REV A", "REV: 0.5", "R3"
 */
const REVISION_PATTERN = /\b(?:REV(?:ISION)?|R)\s*[:.]?\s*([A-Z0-9]+(?:\.\d+)?)\b/i;

/**
 * Pattern to match dates in various formats
 */
const DATE_PATTERN = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{1,2},?\s*\d{2,4})\b/i;

/**
 * Pattern to match scale indicators like "1:10", "SCALE: NTS", "1/4" = 1'"
 */
const SCALE_PATTERN = /\bSCALE\s*[:.]?\s*(NTS|NOT\s*TO\s*SCALE|\d+\s*[:/]\s*\d+|[\d/]+["']\s*=\s*[\d/]+["']?)/i;

/**
 * Pattern to match NEMA ratings like "NEMA 4X", "NEMA 12"
 */
const NEMA_PATTERN = /\bNEMA\s*(\d+X?)\b/i;

/**
 * Pattern to match terminal block references like "TB1", "TB-A", "XT-01"
 */
const TERMINAL_STRIP_PATTERN = /\b(TB|XT|TERM)[-\s]?([A-Z0-9]+)\b/gi;

/**
 * Pattern to match wire colors like "BLK", "WHT", "RED/BLK"
 */
const WIRE_COLOR_PATTERN = /\b(BLK|WHT|RED|BLU|GRN|YEL|ORN|VIO|BRN|GRY|PNK|TAN|WHT\/BLK|BLK\/RED|BLU\/WHT)\b/gi;

/**
 * Pattern to match wire gauges like "14 AWG", "#18", "18GA"
 */
const WIRE_GAUGE_PATTERN = /\b(?:#)?(\d{1,2})\s*(?:AWG|GA(?:UGE)?)\b/gi;

/**
 * Pattern to match dimension callouts like "24.00", "36"" or "24 IN"
 */
const DIMENSION_PATTERN = /\b(\d+(?:\.\d+)?)\s*(?:["'"]|IN(?:CH(?:ES)?)?|MM|CM)?\b/gi;

/**
 * Pattern to match cross-references like "SEE DWG 123", "REF: SHEET 4"
 */
const CROSS_REF_PATTERN = /\b(?:SEE|REF(?:ERENCE)?|REFER\s*TO)\s*[:.]?\s*(DWG|SHEET|PAGE)?\s*[-#]?\s*(\d+[-A-Z0-9]*)\b/gi;

/**
 * Pattern to match zone designations like "ZONE A", "AREA 1", "SECTION B"
 */
const ZONE_PATTERN = /\b(ZONE|AREA|SECTION|REGION)\s*[:.]?\s*([A-Z0-9]+)\b/gi;

/**
 * Pattern to match personnel initials in title block (2-3 caps, often with date)
 */
const INITIALS_PATTERN = /\b([A-Z]{2,3})\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/;

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract title block metadata from PDF text lines.
 * 
 * @pseudocode
 * 1. Scan lines for known title block keywords (DRAWN BY, CHECKED, APPROVED, etc.)
 * 2. Look for patterns near bottom-right of page (typical title block location)
 * 3. Extract drawing number, revision, dates, and personnel
 * 4. Parse project info if found
 * 5. Return structured TitleBlockMetadata
 */
export function extractTitleBlockMetadata(lines: string[], pageNumber: number): TitleBlockMetadata {
  const metadata: TitleBlockMetadata = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    const nextLine = lines[i + 1]?.trim() || '';
    
    // Drawing number
    const drawingMatch = line.match(DRAWING_NUMBER_PATTERN);
    if (drawingMatch) {
      metadata.drawingNumber = drawingMatch[2];
    }
    
    // Revision
    const revMatch = line.match(REVISION_PATTERN);
    if (revMatch) {
      metadata.revision = revMatch[1];
    }
    
    // Scale
    const scaleMatch = line.match(SCALE_PATTERN);
    if (scaleMatch) {
      metadata.scale = scaleMatch[1];
    }
    
    // Personnel fields
    if (line.includes('DRAWN') || line.includes('DWN')) {
      const initialsMatch = nextLine.match(INITIALS_PATTERN);
      if (initialsMatch) {
        metadata.drawnBy = initialsMatch[1];
        metadata.dateDrawn = initialsMatch[2];
      } else if (nextLine.match(/^[A-Z]{2,4}$/)) {
        metadata.drawnBy = nextLine;
      }
    }
    
    if (line.includes('CHECK') || line.includes('CHK')) {
      const initialsMatch = nextLine.match(INITIALS_PATTERN);
      if (initialsMatch) {
        metadata.checkedBy = initialsMatch[1];
        metadata.dateChecked = initialsMatch[2];
      } else if (nextLine.match(/^[A-Z]{2,4}$/)) {
        metadata.checkedBy = nextLine;
      }
    }
    
    if (line.includes('APPROV') || line.includes('APR')) {
      const initialsMatch = nextLine.match(INITIALS_PATTERN);
      if (initialsMatch) {
        metadata.approvedBy = initialsMatch[1];
        metadata.dateApproved = initialsMatch[2];
      } else if (nextLine.match(/^[A-Z]{2,4}$/)) {
        metadata.approvedBy = nextLine;
      }
    }
    
    // Project number
    if (line.includes('PROJECT') || line.includes('PROJ')) {
      const projMatch = nextLine.match(/\b([A-Z0-9]{2,}\d+[A-Z0-9]*)\b/);
      if (projMatch) {
        metadata.projectNumber = projMatch[1];
      }
    }
    
    // Customer name
    if (line.includes('CUSTOMER') || line.includes('CLIENT') || line.includes('FOR:')) {
      if (nextLine && nextLine.length > 2 && !nextLine.match(/^\d+$/)) {
        metadata.customerName = nextLine;
      }
    }
    
    // Date patterns
    const dateMatch = line.match(DATE_PATTERN);
    if (dateMatch && !metadata.revisionDate) {
      metadata.revisionDate = dateMatch[1];
    }
  }
  
  return metadata;
}

/**
 * Extract enclosure dimensions from PDF text.
 * 
 * @pseudocode
 * 1. Look for dimension patterns near enclosure keywords
 * 2. Parse width x height x depth format
 * 3. Extract NEMA rating if present
 * 4. Determine orientation from dimensions
 * 5. Return EnclosureDimensions
 */
export function extractEnclosureDimensions(lines: string[]): EnclosureDimensions | undefined {
  let widthInches: number | undefined;
  let heightInches: number | undefined;
  let depthInches: number | undefined;
  let nemaRating: string | undefined;
  
  for (const line of lines) {
    const upper = line.toUpperCase();
    
    // NEMA rating
    const nemaMatch = upper.match(NEMA_PATTERN);
    if (nemaMatch) {
      nemaRating = `NEMA ${nemaMatch[1]}`;
    }
    
    // Dimension patterns like "24 x 36 x 8" or "24"W x 36"H x 8"D"
    const dimMatch = upper.match(/(\d+(?:\.\d+)?)\s*["']?\s*[WX]\s*(\d+(?:\.\d+)?)\s*["']?\s*[HX]\s*(\d+(?:\.\d+)?)/);
    if (dimMatch) {
      widthInches = parseFloat(dimMatch[1]);
      heightInches = parseFloat(dimMatch[2]);
      depthInches = parseFloat(dimMatch[3]);
    }
    
    // Alternative: "WIDTH: 24", "HEIGHT: 36"
    if (upper.includes('WIDTH') || upper.includes('WD')) {
      const wMatch = upper.match(/(?:WIDTH|WD)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      if (wMatch) widthInches = parseFloat(wMatch[1]);
    }
    if (upper.includes('HEIGHT') || upper.includes('HT')) {
      const hMatch = upper.match(/(?:HEIGHT|HT)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      if (hMatch) heightInches = parseFloat(hMatch[1]);
    }
    if (upper.includes('DEPTH') || upper.includes('DP')) {
      const dMatch = upper.match(/(?:DEPTH|DP)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      if (dMatch) depthInches = parseFloat(dMatch[1]);
    }
  }
  
  if (widthInches || heightInches) {
    return {
      widthInches,
      heightInches,
      depthInches,
      orientation: (widthInches && heightInches && widthInches > heightInches) ? 'landscape' : 'portrait',
      nemaRating,
    };
  }
  
  return undefined;
}

/**
 * Extract terminal strip references from PDF text.
 * 
 * @pseudocode
 * 1. Scan for TB/XT/TERM patterns
 * 2. Extract label and any associated count
 * 3. Try to associate with nearby rail references
 * 4. Return array of TerminalStripReference
 */
export function extractTerminalStrips(lines: string[], pageNumber: number): TerminalStripReference[] {
  const strips: TerminalStripReference[] = [];
  const seen = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    const regex = new RegExp(TERMINAL_STRIP_PATTERN.source, 'gi');
    
    while ((match = regex.exec(line)) !== null) {
      const prefix = match[1].toUpperCase();
      const id = match[2].toUpperCase();
      const label = `${prefix}${id}`;
      
      if (!seen.has(label)) {
        seen.add(label);
        
        // Try to find terminal count (e.g., "TB1 (20 PT)" or "20 POSITION")
        let terminalCount: number | undefined;
        const countMatch = line.match(/(\d+)\s*(?:PT|POS(?:ITION)?|TERM(?:INAL)?S?)/i);
        if (countMatch) {
          terminalCount = parseInt(countMatch[1]);
        }
        
        strips.push({
          id: `${prefix}${id}`,
          label,
          terminalCount,
          pageNumber,
        });
      }
    }
  }
  
  return strips;
}

/**
 * Extract wire annotations from PDF text.
 * 
 * @pseudocode
 * 1. Scan for wire number patterns
 * 2. Look for associated color codes
 * 3. Extract gauge information
 * 4. Try to find from/to device references
 * 5. Return array of WireAnnotation
 */
export function extractWireAnnotations(lines: string[], pageNumber: number): WireAnnotation[] {
  const annotations: WireAnnotation[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    
    // Look for wire identifiers (e.g., "W1", "WIRE-101", "101BLK")
    const wireMatch = upper.match(/\b(?:W|WIRE[-\s]?)(\d{1,4})\b/);
    if (!wireMatch) continue;
    
    const wireNumber = wireMatch[1];
    const annotation: WireAnnotation = {
      wireNumber,
      pageNumber,
      lineNumber: i,
    };
    
    // Extract color
    const colorMatch = upper.match(WIRE_COLOR_PATTERN);
    if (colorMatch) {
      annotation.wireColor = colorMatch[0];
    }
    
    // Extract gauge
    const gaugeMatch = upper.match(WIRE_GAUGE_PATTERN);
    if (gaugeMatch) {
      annotation.wireGauge = `${gaugeMatch[1]} AWG`;
    }
    
    // Look for device references on same line
    const deviceMatches = upper.match(/\b([A-Z]{2}\d{4})\b/g);
    if (deviceMatches && deviceMatches.length >= 2) {
      annotation.fromDevice = deviceMatches[0];
      annotation.toDevice = deviceMatches[1];
    }
    
    annotations.push(annotation);
  }
  
  return annotations;
}

/**
 * Extract cross-references to other drawings/sheets.
 * 
 * @pseudocode
 * 1. Scan for "SEE DWG", "REF SHEET" patterns
 * 2. Parse target drawing/sheet number
 * 3. Try to determine reference type (wire, device, signal)
 * 4. Return array of CrossReference
 */
export function extractCrossReferences(lines: string[], pageNumber: number): CrossReference[] {
  const refs: CrossReference[] = [];
  
  for (const line of lines) {
    const upper = line.toUpperCase();
    let match;
    const regex = new RegExp(CROSS_REF_PATTERN.source, 'gi');
    
    while ((match = regex.exec(upper)) !== null) {
      const refType = match[1]?.toLowerCase() || 'sheet';
      const target = match[2];
      
      refs.push({
        referenceType: refType === 'dwg' ? 'sheet' : 'sheet',
        toSheet: target,
        pageNumber,
      });
    }
  }
  
  return refs;
}

/**
 * Extract revision history entries.
 * 
 * @pseudocode
 * 1. Look for revision table patterns
 * 2. Parse revision letter/number, date, description, author
 * 3. Return array sorted by revision order
 */
export function extractRevisionHistory(lines: string[]): RevisionEntry[] {
  const entries: RevisionEntry[] = [];
  let inRevisionBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const upper = line.toUpperCase();
    
    // Detect start of revision block
    if (upper.includes('REVISION') || upper.includes('REV HISTORY')) {
      inRevisionBlock = true;
      continue;
    }
    
    if (inRevisionBlock) {
      // Look for revision entries like "A  01/15/24  INITIAL RELEASE  JD"
      const revMatch = line.match(/^([A-Z0-9]+)\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})?\s*(.+?)(?:\s+([A-Z]{2,4}))?$/);
      if (revMatch) {
        entries.push({
          revision: revMatch[1],
          date: revMatch[2],
          description: revMatch[3].trim(),
          author: revMatch[4],
        });
      }
      
      // Exit revision block on empty line or new section
      if (line === '' || upper.match(/^[A-Z]{4,}/)) {
        inRevisionBlock = false;
      }
    }
  }
  
  return entries;
}

/**
 * Extract drawing notes.
 * 
 * @pseudocode
 * 1. Look for NOTES section or numbered notes
 * 2. Parse note text and categorize
 * 3. Return array of DrawingNote
 */
export function extractDrawingNotes(lines: string[], pageNumber: number): DrawingNote[] {
  const notes: DrawingNote[] = [];
  let inNotesSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    
    // Detect notes section
    if (upper.match(/^NOTES?:?\s*$/)) {
      inNotesSection = true;
      continue;
    }
    
    // Look for numbered notes
    const numberedMatch = trimmed.match(/^(\d+)[.)\s]+(.+)$/);
    if (numberedMatch) {
      const text = numberedMatch[2];
      let category: DrawingNote['category'] = 'general';
      
      if (upper.includes('WARNING') || upper.includes('CAUTION')) {
        category = 'warning';
      } else if (upper.includes('INSTALL')) {
        category = 'installation';
      } else if (upper.includes('SPEC') || upper.includes('REQUIRE')) {
        category = 'specification';
      }
      
      notes.push({
        noteNumber: parseInt(numberedMatch[1]),
        text,
        category,
        pageNumber,
      });
    } else if (inNotesSection && trimmed && !upper.match(/^[A-Z]{4,}/)) {
      notes.push({
        text: trimmed,
        category: 'general',
        pageNumber,
      });
    }
    
    // Exit notes section
    if (inNotesSection && trimmed === '') {
      inNotesSection = false;
    }
  }
  
  return notes;
}

/**
 * Extract bill of materials entries.
 * 
 * @pseudocode
 * 1. Look for BOM/PARTS LIST section
 * 2. Parse item number, part number, description, quantity
 * 3. Extract manufacturer if present
 * 4. Return array of BOMEntry
 */
export function extractBillOfMaterials(lines: string[]): BOMEntry[] {
  const entries: BOMEntry[] = [];
  let inBOMSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    
    // Detect BOM section
    if (upper.match(/BILL\s*OF\s*MATERIALS?|PARTS?\s*LIST|BOM/)) {
      inBOMSection = true;
      continue;
    }
    
    if (inBOMSection) {
      // Parse BOM row: ITEM QTY PART-NO DESCRIPTION
      const bomMatch = trimmed.match(/^(\d+)\s+(\d+)\s+([A-Z0-9][-A-Z0-9]+)\s+(.+)$/i);
      if (bomMatch) {
        entries.push({
          itemNumber: parseInt(bomMatch[1]),
          quantity: parseInt(bomMatch[2]),
          partNumber: bomMatch[3],
          description: bomMatch[4],
        });
      }
      
      // Alternative format: ITEM PART-NO QTY DESCRIPTION
      const altMatch = trimmed.match(/^(\d+)\s+([A-Z0-9][-A-Z0-9]+)\s+(\d+)\s+(.+)$/i);
      if (altMatch) {
        entries.push({
          itemNumber: parseInt(altMatch[1]),
          partNumber: altMatch[2],
          quantity: parseInt(altMatch[3]),
          description: altMatch[4],
        });
      }
      
      // Exit BOM section
      if (trimmed === '' && entries.length > 0) {
        inBOMSection = false;
      }
    }
  }
  
  return entries;
}

/**
 * Extract zone designations from PDF text.
 */
export function extractZones(lines: string[], pageNumber: number): DrawingZone[] {
  const zones: DrawingZone[] = [];
  const seen = new Set<string>();
  
  for (const line of lines) {
    let match;
    const regex = new RegExp(ZONE_PATTERN.source, 'gi');
    
    while ((match = regex.exec(line)) !== null) {
      const zoneType = match[1].toUpperCase();
      const zoneId = match[2].toUpperCase();
      const label = `${zoneType} ${zoneId}`;
      
      if (!seen.has(label)) {
        seen.add(label);
        zones.push({
          zoneId: `${zoneType[0]}${zoneId}`,
          label,
          pageNumber,
        });
      }
    }
  }
  
  return zones;
}

// ============================================================================
// Master Extraction Function
// ============================================================================

/**
 * Extract all enhanced metadata from PDF text lines.
 * 
 * This function orchestrates all individual extractors and combines
 * their results into a complete EnhancedPageMetadata object.
 */
export function extractEnhancedMetadata(
  lines: string[],
  pageNumber: number
): EnhancedPageMetadata {
  return {
    pageNumber,
    titleBlock: extractTitleBlockMetadata(lines, pageNumber),
    enclosure: extractEnclosureDimensions(lines),
    terminalStrips: extractTerminalStrips(lines, pageNumber),
    wireAnnotations: extractWireAnnotations(lines, pageNumber),
    componentCallouts: [], // Would need position data from PDF rendering
    crossReferences: extractCrossReferences(lines, pageNumber),
    zones: extractZones(lines, pageNumber),
    revisionHistory: extractRevisionHistory(lines),
    notes: extractDrawingNotes(lines, pageNumber),
    billOfMaterials: extractBillOfMaterials(lines),
  };
}

/**
 * Generate a summary of enhanced metadata across all pages.
 */
export function generateEnhancedSummary(
  pages: EnhancedPageMetadata[]
): EnhancedMetadataSummary {
  const allRevisions = new Set<string>();
  const allColors = new Set<string>();
  const allGauges = new Set<string>();
  const enclosureSizes = new Set<string>();
  const devicesByFamily: Record<string, number> = {};
  
  let pagesWithTitleBlock = 0;
  let pagesWithBOM = 0;
  let pagesWithRevision = 0;
  let terminalStripCount = 0;
  
  for (const page of pages) {
    // Title block stats
    if (page.titleBlock.drawingNumber || page.titleBlock.revision) {
      pagesWithTitleBlock++;
    }
    if (page.titleBlock.revision) {
      allRevisions.add(page.titleBlock.revision);
    }
    
    // BOM stats
    if (page.billOfMaterials.length > 0) {
      pagesWithBOM++;
    }
    
    // Revision history
    if (page.revisionHistory.length > 0) {
      pagesWithRevision++;
      for (const entry of page.revisionHistory) {
        allRevisions.add(entry.revision);
      }
    }
    
    // Wire annotations
    for (const wire of page.wireAnnotations) {
      if (wire.wireColor) allColors.add(wire.wireColor);
      if (wire.wireGauge) allGauges.add(wire.wireGauge);
    }
    
    // Terminal strips
    terminalStripCount += page.terminalStrips.length;
    
    // Enclosure sizes
    if (page.enclosure) {
      const sizeLabel = `${page.enclosure.widthInches || '?'}x${page.enclosure.heightInches || '?'}x${page.enclosure.depthInches || '?'}`;
      enclosureSizes.add(sizeLabel);
    }
  }
  
  // Sort revisions
  const sortedRevisions = Array.from(allRevisions).sort();
  const latestRevision = sortedRevisions[sortedRevisions.length - 1];
  
  // Calculate completeness score
  const hasProject = pages.some(p => p.titleBlock.projectNumber);
  const hasTitleBlocks = pagesWithTitleBlock > pages.length * 0.5;
  const hasRevisions = sortedRevisions.length > 0;
  const hasBOM = pagesWithBOM > 0;
  const completenessScore = [hasProject, hasTitleBlocks, hasRevisions, hasBOM]
    .filter(Boolean).length * 25;
  
  return {
    projectInfo: {
      projectNumber: pages.find(p => p.titleBlock.projectNumber)?.titleBlock.projectNumber,
      projectName: pages.find(p => p.titleBlock.projectName)?.titleBlock.projectName,
      customerName: pages.find(p => p.titleBlock.customerName)?.titleBlock.customerName,
      totalSheets: pages.length,
      revisions: sortedRevisions,
      latestRevision,
      latestRevisionDate: pages.find(p => p.titleBlock.revision === latestRevision)?.titleBlock.revisionDate,
    },
    physicalSummary: {
      enclosureCount: pages.filter(p => p.enclosure).length,
      totalRails: 0, // From base extraction
      totalPanducts: 0, // From base extraction
      uniqueEnclosureSizes: Array.from(enclosureSizes),
    },
    deviceSummary: {
      totalDevices: 0, // From base extraction
      devicesByFamily,
      terminalStripCount,
    },
    wiringSummary: {
      totalWireAnnotations: pages.reduce((sum, p) => sum + p.wireAnnotations.length, 0),
      uniqueWireColors: Array.from(allColors),
      uniqueGauges: Array.from(allGauges),
      crossReferenceCount: pages.reduce((sum, p) => sum + p.crossReferences.length, 0),
    },
    qualityMetrics: {
      pagesWithTitleBlock,
      pagesWithBOM,
      pagesWithRevisionHistory: pagesWithRevision,
      completenessScore,
    },
  };
}
