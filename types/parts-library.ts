/**
 * Parts Library Type Definitions
 * 
 * Comprehensive types for the Part Number Library with dynamic schema support.
 * Supports category-specific detail fields, installation steps, and nested structures.
 */

// ============================================================================
// DETAIL FIELD SCHEMA TYPES
// ============================================================================

/**
 * Supported field types for dynamic detail schemas
 */
export type DetailFieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'multi-select'
    | 'boolean'
    | 'image'
    | 'image-list'
    | 'url'
    | 'installation-steps'
    | 'dos-donts'
    | 'key-value-list'
    | 'part-reference-list'

/**
 * A single field definition in a detail schema
 */
export interface DetailFieldSchema {
    /** Unique key for this field */
    key: string
    /** Display label */
    label: string
    /** Field type */
    type: DetailFieldType
    /** Field description/help text */
    description?: string
    /** Whether field is required */
    required?: boolean
    /** Default value */
    defaultValue?: unknown
    /** Placeholder text */
    placeholder?: string
    /** Options for select/multi-select */
    options?: { value: string; label: string }[]
    /** Validation rules */
    validation?: {
        min?: number
        max?: number
        pattern?: string
        patternMessage?: string
    }
    /** Group this field belongs to */
    group?: string
    /** Display order within group */
    order?: number
    /** Show this field only when condition is met */
    showWhen?: {
        field: string
        equals: unknown
    }
}

/**
 * A group of related fields
 */
export interface DetailFieldGroup {
    /** Group key */
    key: string
    /** Display label */
    label: string
    /** Group description */
    description?: string
    /** Whether group is collapsible */
    collapsible?: boolean
    /** Default collapsed state */
    defaultCollapsed?: boolean
    /** Display order */
    order?: number
}

/**
 * Complete detail schema for a category/type
 */
export interface DetailSchema {
    /** Schema version */
    version: number
    /** Schema ID */
    id: string
    /** Display name */
    name: string
    /** Description */
    description?: string
    /** Field groups */
    groups: DetailFieldGroup[]
    /** Field definitions */
    fields: DetailFieldSchema[]
}

// ============================================================================
// INSTALLATION STEP TYPES
// ============================================================================

/**
 * A single do or don't instruction
 */
export interface DoOrDont {
    /** Unique ID */
    id: string
    /** Type: do or don't */
    type: 'do' | 'dont' | 'caution' | 'safety'
    /** Description text */
    description: string
    /** Optional image */
    image?: PartImage
}

/**
 * A single installation step
 */
export interface InstallationStep {
    /** Step number */
    step: number
    /** Step title */
    title: string
    /** Detailed description */
    description: string
    /** Step image */
    image?: PartImage
    /** Dos and don'ts for this step */
    dosAndDonts?: DoOrDont[]
    /** Estimated time in minutes */
    estimatedTime?: number
    /** Required tools for this step */
    requiredTools?: string[]
    /** Safety warnings */
    warnings?: string[]
}

// ============================================================================
// PART IMAGE TYPES
// ============================================================================

/**
 * Image view types
 */
export type ImageViewType =
    | 'front'
    | 'back'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'installed'
    | 'wiring_diagram'
    | 'schematic'
    | 'icon'
    | 'layout_symbol'
    | 'blue_label'

/**
 * A part image
 */
export interface PartImage {
    /** Image source URL/path */
    src: string
    /** Alt text */
    alt?: string
    /** View type */
    viewType?: ImageViewType
    /** Caption */
    caption?: string
    /** Width in pixels */
    width?: number
    /** Height in pixels */
    height?: number
}

export type PartTerminalSide =
    | 'left'
    | 'right'
    | 'top'
    | 'bottom'
    | 'front'
    | 'rear'
    | 'inner'
    | 'outer'
    | 'unknown'

export interface PartTerminalDefinition {
    /** Terminal label as it appears on the device */
    name: string
    /** Alternate names users may see in other wire lists or drawings */
    aliases?: string[]
    /** Common wire ID/color observed for the terminal */
    wireId?: string
    /** Common wire size/gauge observed for the terminal */
    size?: string
    /** Optional physical side for routing / install order */
    side?: PartTerminalSide
    /** Optional tier marker when a block/device has stacked tiers */
    tier?: string
    /** Optional explicit order within the side/tier */
    order?: number | null
    /** Whether the terminal should produce a negative wire marker */
    isNegative?: boolean
    /** Polarity behavior for this terminal */
    polarityMode?: 'fixed-negative' | 'fixed-positive' | 'either'
    /** Optional hardware/accessory requirements keyed by name */
    hardware?: Record<string, string>
    /** Optional reusable hardware stack reference */
    hardwareStackId?: string
    /** Notes for install sequencing or nearby constraints */
    instructions?: string[]
}

export interface PartTerminalSchema {
    terminals: PartTerminalDefinition[]
    negativePatterns?: string[]
    updatedAt: string
}

// ============================================================================
// PART CATEGORIES & TYPES
// ============================================================================

/**
 * Top-level part categories
 */
export type PartCategory =
    | 'devices'
    | 'terminals'
    | 'wiring'
    | 'hardware'
    | 'tools'
    | 'consumables'
    | 'unknown'

/**
 * Category display info
 */
export const PART_CATEGORY_INFO: Record<PartCategory, { label: string; description: string }> = {
    devices: { label: 'Devices', description: 'Control devices, relays, PLCs, and electronic components' },
    terminals: { label: 'Terminals', description: 'Ring terminals, ferrules, terminal blocks, and connectors' },
    wiring: { label: 'Wiring', description: 'Wire, cable, cable management, and wire accessories' },
    hardware: { label: 'Hardware', description: 'Mounting hardware, panels, enclosures, and mechanical parts' },
    tools: { label: 'Tools', description: 'Assembly tools, crimpers, and equipment' },
    consumables: { label: 'Consumables', description: 'Labels, tape, lubricants, and disposable items' },
    unknown: { label: 'Unknown', description: 'Parts that have not been categorized' },
}

/**
 * Part types within categories
 */
export type PartType = string // Dynamic based on category

/**
 * Default part types per category
 */
export const DEFAULT_PART_TYPES: Record<PartCategory, string[]> = {
    devices: [
        'control-relays',
        'timing-relays',
        'protection-relays',
        'plc-modules',
        'safety-controllers',
        'hmi-panels',
        'power-supplies',
        'circuit-breakers',
        'contactors',
        'motor-starters',
    ],
    terminals: [
        'ring-terminals',
        'fork-terminals',
        'wire-ferrules',
        'terminal-blocks',
        'busbars',
        'din-rail-accessories',
        'splice-connectors',
    ],
    wiring: [
        'wire',
        'cable',
        'conduit',
        'wire-duct',
        'cable-ties',
        'cable-glands',
        'cable-markers',
    ],
    hardware: [
        'din-rail',
        'panel-hardware',
        'enclosures',
        'mounting-brackets',
        'fasteners',
        'grommets',
    ],
    tools: [
        'crimpers',
        'strippers',
        'cutters',
        'drivers',
        'multimeters',
        'hand-tools',
    ],
    consumables: [
        'labels',
        'heat-shrink',
        'tape',
        'lubricants',
        'cleaning-supplies',
        'safety-equipment',
    ],
    unknown: ['uncategorized'],
}

// ============================================================================
// PART RECORD
// ============================================================================

/**
 * Complete part record
 */
export interface PartRecord {
    /** Primary part number (unique identifier) */
    partNumber: string
    /** Normalized display title used across UI surfaces */
    displayTitle?: string
    /** Human-readable description */
    description: string
    /** Part category */
    category: PartCategory
    /** Part type within category */
    type: string
    
    /** Images */
    images?: {
        primary?: PartImage
        icon?: PartImage
        gallery?: PartImage[]
        layoutSymbol?: PartImage
        blueLabel?: PartImage
    }

    /** Inline/base64 photo payload or direct image URL */
    photo?: string
    
    /** Manufacturer info */
    manufacturer?: string
    manufacturerPartNumber?: string
    
    /** Alternate part numbers */
    alternatePartNumbers?: string[]
    
    /** Associated/related parts */
    associatedParts?: {
        partNumber: string
        operationship: 'requires' | 'recommended' | 'alternative' | 'accessory'
        quantity?: number
        notes?: string
    }[]
    
    /** Installation steps (primarily for devices) */
    installationSteps?: InstallationStep[]
    
    /** Reference to installation template (if using template) */
    installationTemplateId?: string
    
    /** Dynamic detail fields (category/type specific) */
    details?: Record<string, unknown>

    /** Wiring intelligence for terminal ordering, polarity, and install guidance */
    terminalSchema?: PartTerminalSchema
    
    /** Reference to details template (if using template) */
    detailsTemplateId?: string
    
    /** Tags for search */
    tags?: string[]
    
    /** Data source */
    source: 'library_csv' | 'project_reference' | 'manual_entry' | 'migrated' | 'workbook_ingest'

    /** Ingestion + review lifecycle metadata */
    lifecycle?: {
        status: 'new' | 'reviewing' | 'ready' | 'archived'
        needsTraining?: boolean
        needsImages?: boolean
        needsReviewByRole?: string
        discoveredFrom?: {
            projectId?: string
            sourceSheet?: string
            sourceLocation?: string
            uploadedBy?: string
            discoveredAt: string
        }
    }
    
    /** Timestamps */
    createdAt: string
    updatedAt: string
    
    /** Created/updated by */
    createdBy?: string
    updatedBy?: string
}

export interface PartFamilyVariant {
    partNumber: string
    label: string
    title: string
}

export interface PartFamily {
    id: string
    category: PartCategory
    type: string
    familyName: string
    familyKey: string
    representative: PartRecord
    variants: PartFamilyVariant[]
    parts: PartRecord[]
}

// ============================================================================
// PART STACKS
// ============================================================================

export type PartStackUseCase =
    | 'terminal-hardware'
    | 'training-module'
    | 'device-kit'
    | 'install-kit'
    | 'accessory-kit'
    | 'custom'

export interface PartStackItem {
    /** Stable client/server item id for sortable lists */
    id: string
    /** The referenced part number */
    partNumber: string
    /** Optional resolved category hint */
    category?: PartCategory
    /** Optional resolved type hint */
    type?: string
    /** Quantity within the stack */
    quantity?: number
    /** Sort order from the resortable UI */
    sortOrder: number
    /** Semantic role within the stack */
    role?: 'primary' | 'hardware' | 'accessory' | 'training' | 'terminal' | 'optional'
    /** Optional freeform notes */
    notes?: string
    /** Optional structured configuration for downstream workflows */
    config?: Record<string, unknown>
}

export interface PartStack {
    /** Stable stack id */
    id: string
    /** Human-readable stack name */
    name: string
    /** Description / instructions */
    description?: string
    /** Main category context; mixed when combining categories */
    category?: PartCategory | 'mixed'
    /** Main type context; mixed when combining types */
    type?: string | 'mixed'
    /** Reusable scenario tags */
    useCases?: PartStackUseCase[]
    /** Search tags */
    tags?: string[]
    /** Optional public asset references for icon/preview */
    images?: {
        icon?: PartImage
        preview?: PartImage
    }
    /** Resortable items */
    items: PartStackItem[]
    /** Origin */
    source: 'manual' | 'derived'
    createdAt: string
    updatedAt: string
    createdBy?: string
    updatedBy?: string
}

export interface PartStacksManifest {
    version: number
    updatedAt: string
    totalStacks: number
    stacks: Array<{
        id: string
        name: string
        category?: PartCategory | 'mixed'
        type?: string | 'mixed'
        useCases?: PartStackUseCase[]
        itemCount: number
        updatedAt: string
    }>
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Installation template for reusable installation steps
 * These can be applied to multiple parts sharing the same installation process
 */
export interface InstallationTemplate {
    /** Template ID (slug) */
    id: string
    /** Display name */
    name: string
    /** Description */
    description?: string
    /** Category this template applies to */
    category: PartCategory
    /** Optional type restriction */
    type?: string
    /** The installation steps */
    steps: InstallationStep[]
    /** Template version for tracking changes */
    version: number
    /** Timestamps */
    createdAt: string
    updatedAt: string
}

/**
 * Details template for reusable detail field values
 * Allows sharing common specifications across similar parts
 */
export interface DetailsTemplate {
    /** Template ID (slug) */
    id: string
    /** Display name */
    name: string
    /** Description */
    description?: string
    /** Category this template applies to */
    category: PartCategory
    /** Optional type restriction */
    type?: string
    /** Schema this template is based on */
    schemaId: string
    /** Pre-filled detail values */
    values: Record<string, unknown>
    /** Template version */
    version: number
    /** Timestamps */
    createdAt: string
    updatedAt: string
}

/**
 * Reference to a template in a part record
 */
export interface TemplateReference {
    /** Template ID */
    templateId: string
    /** Type of template */
    type: 'installation' | 'details'
    /** Whether to inherit updates from template */
    inheritUpdates?: boolean
    /** Local overrides */
    overrides?: Record<string, unknown>
}

// ============================================================================
// MANIFEST TYPES
// ============================================================================

/**
 * Root manifest at Share/parts/manifest.json
 */
export interface PartsRootManifest {
    version: number
    updatedAt: string
    categories: {
        [key in PartCategory]?: {
            count: number
            types: string[]
        }
    }
    totalParts: number
}

/**
 * Category manifest at Share/parts/<category>/manifest.json
 */
export interface PartsCategoryManifest {
    category: PartCategory
    version: number
    updatedAt: string
    types: {
        [type: string]: {
            count: number
            label: string
            description?: string
        }
    }
    /** Custom detail schema for this category */
    schema?: DetailSchema
    totalParts: number
}

/**
 * Type manifest at Share/parts/<category>/<type>/manifest.json
 */
export interface PartsTypeManifest {
    category: PartCategory
    type: string
    version: number
    updatedAt: string
    parts: {
        partNumber: string
        description: string
        updatedAt: string
    }[]
    /** Custom detail schema overrides for this type */
    schema?: DetailSchema
    totalParts: number
}

export interface PartsSearchResult {
    parts: PartRecord[]
    total: number
}

// ============================================================================
// DEFAULT SCHEMAS BY CATEGORY
// ============================================================================

/**
 * Base fields present in all parts
 */
export const BASE_DETAIL_FIELDS: DetailFieldSchema[] = [
    {
        key: 'voltageRating',
        label: 'Voltage Rating',
        type: 'text',
        group: 'electrical',
        placeholder: 'e.g., 24V DC, 120V AC',
    },
    {
        key: 'currentRating',
        label: 'Current Rating',
        type: 'text',
        group: 'electrical',
        placeholder: 'e.g., 10A, 5mA',
    },
    {
        key: 'operatingTemp',
        label: 'Operating Temperature',
        type: 'text',
        group: 'environmental',
        placeholder: 'e.g., -20C to +60C',
    },
    {
        key: 'ipRating',
        label: 'IP Rating',
        type: 'text',
        group: 'environmental',
        placeholder: 'e.g., IP65, IP20',
    },
]

/**
 * Device-specific detail fields
 */
export const DEVICE_DETAIL_SCHEMA: DetailSchema = {
    version: 1,
    id: 'device-details',
    name: 'Device Details',
    description: 'Detail fields for control devices and electronic components',
    groups: [
        { key: 'electrical', label: 'Electrical Specifications', order: 1 },
        { key: 'physical', label: 'Physical Specifications', order: 2 },
        { key: 'symbols', label: 'Symbols & References', order: 3 },
        { key: 'installation', label: 'Installation', order: 4, collapsible: true },
    ],
    fields: [
        ...BASE_DETAIL_FIELDS,
        {
            key: 'coilVoltage',
            label: 'Coil Voltage',
            type: 'text',
            group: 'electrical',
            placeholder: 'e.g., 24V DC',
        },
        {
            key: 'contactConfiguration',
            label: 'Contact Configuration',
            type: 'text',
            group: 'electrical',
            placeholder: 'e.g., 2NO+2NC, DPDT',
        },
        {
            key: 'mountType',
            label: 'Mount Type',
            type: 'select',
            group: 'physical',
            options: [
                { value: 'din_rail', label: 'DIN Rail' },
                { value: 'panel_mount', label: 'Panel Mount' },
                { value: 'socket', label: 'Socket' },
                { value: 'pcb', label: 'PCB Mount' },
            ],
        },
        {
            key: 'dimensions',
            label: 'Dimensions (WxHxD)',
            type: 'text',
            group: 'physical',
            placeholder: 'e.g., 22.5 x 82.5 x 55 mm',
        },
        {
            key: 'layoutSymbol',
            label: 'Layout Symbol',
            type: 'image',
            group: 'symbols',
            description: 'Schematic/layout symbol for this device',
        },
        {
            key: 'blueLabelRef',
            label: 'Blue Label Reference',
            type: 'text',
            group: 'symbols',
            description: 'Reference to blue label identifier',
        },
        {
            key: 'devicePrefixes',
            label: 'Device Prefixes',
            type: 'multi-select',
            group: 'symbols',
            description: 'Typical device ID prefixes (e.g., KA, CR)',
            options: [
                { value: 'KA', label: 'KA - Control Relay' },
                { value: 'CR', label: 'CR - Control Relay' },
                { value: 'KT', label: 'KT - Timing Relay' },
                { value: 'K', label: 'K - Contactor' },
                { value: 'Q', label: 'Q - Circuit Breaker' },
                { value: 'F', label: 'F - Fuse' },
            ],
        },
        {
            key: 'installationSteps',
            label: 'Installation Steps',
            type: 'installation-steps',
            group: 'installation',
            description: 'Step-by-step installation instructions with images and dos/don\'ts',
        },
    ],
}

/**
 * Terminal-specific detail fields
 */
export const TERMINAL_DETAIL_SCHEMA: DetailSchema = {
    version: 1,
    id: 'terminal-details',
    name: 'Terminal Details',
    description: 'Detail fields for terminals and connectors',
    groups: [
        { key: 'electrical', label: 'Electrical Specifications', order: 1 },
        { key: 'wire', label: 'Wire Specifications', order: 2 },
        { key: 'physical', label: 'Physical Specifications', order: 3 },
        { key: 'crimping', label: 'Crimping Requirements', order: 4, collapsible: true },
    ],
    fields: [
        ...BASE_DETAIL_FIELDS,
        {
            key: 'wireGauges',
            label: 'Wire Gauges (AWG)',
            type: 'multi-select',
            group: 'wire',
            options: [
                { value: '22', label: '22 AWG' },
                { value: '20', label: '20 AWG' },
                { value: '18', label: '18 AWG' },
                { value: '16', label: '16 AWG' },
                { value: '14', label: '14 AWG' },
                { value: '12', label: '12 AWG' },
                { value: '10', label: '10 AWG' },
                { value: '8', label: '8 AWG' },
                { value: '6', label: '6 AWG' },
                { value: '4', label: '4 AWG' },
                { value: '2', label: '2 AWG' },
                { value: '1', label: '1 AWG' },
                { value: '1/0', label: '1/0 AWG' },
            ],
        },
        {
            key: 'studSize',
            label: 'Stud Size',
            type: 'text',
            group: 'physical',
            placeholder: 'e.g., #10, 1/4"',
        },
        {
            key: 'barrelType',
            label: 'Barrel Type',
            type: 'select',
            group: 'physical',
            options: [
                { value: 'brazed', label: 'Brazed Seam' },
                { value: 'seamless', label: 'Seamless' },
                { value: 'flared', label: 'Flared' },
            ],
        },
        {
            key: 'insulationType',
            label: 'Insulation Type',
            type: 'select',
            group: 'physical',
            options: [
                { value: 'none', label: 'Non-Insulated' },
                { value: 'vinyl', label: 'Vinyl Insulated' },
                { value: 'nylon', label: 'Nylon Insulated' },
                { value: 'heat_shrink', label: 'Heat Shrink' },
            ],
        },
        {
            key: 'crimpTool',
            label: 'Recommended Crimp Tool',
            type: 'text',
            group: 'crimping',
        },
        {
            key: 'crimpDie',
            label: 'Crimp Die Size',
            type: 'text',
            group: 'crimping',
        },
    ],
}

/**
 * Hardware-specific detail fields
 */
export const HARDWARE_DETAIL_SCHEMA: DetailSchema = {
    version: 1,
    id: 'hardware-details',
    name: 'Hardware Details',
    description: 'Detail fields for mounting hardware and mechanical parts',
    groups: [
        { key: 'physical', label: 'Physical Specifications', order: 1 },
        { key: 'material', label: 'Material & Finish', order: 2 },
        { key: 'mounting', label: 'Mounting Info', order: 3 },
    ],
    fields: [
        {
            key: 'dimensions',
            label: 'Dimensions',
            type: 'text',
            group: 'physical',
            placeholder: 'e.g., 35mm x 7.5mm',
        },
        {
            key: 'material',
            label: 'Material',
            type: 'select',
            group: 'material',
            options: [
                { value: 'steel', label: 'Steel' },
                { value: 'stainless', label: 'Stainless Steel' },
                { value: 'aluminum', label: 'Aluminum' },
                { value: 'plastic', label: 'Plastic' },
                { value: 'nylon', label: 'Nylon' },
            ],
        },
        {
            key: 'finish',
            label: 'Finish',
            type: 'select',
            group: 'material',
            options: [
                { value: 'zinc', label: 'Zinc Plated' },
                { value: 'galvanized', label: 'Galvanized' },
                { value: 'passivated', label: 'Passivated' },
                { value: 'powder_coat', label: 'Powder Coated' },
                { value: 'none', label: 'None' },
            ],
        },
        {
            key: 'mountingHoles',
            label: 'Mounting Holes',
            type: 'text',
            group: 'mounting',
            placeholder: 'e.g., 2x M4, 4x #10',
        },
    ],
}

/**
 * Get default schema for a category
 */
export function getDefaultSchemaForCategory(category: PartCategory): DetailSchema | undefined {
    switch (category) {
        case 'devices':
            return DEVICE_DETAIL_SCHEMA
        case 'terminals':
            return TERMINAL_DETAIL_SCHEMA
        case 'hardware':
            return HARDWARE_DETAIL_SCHEMA
        default:
            return undefined
    }
}

// ============================================================================
// CATEGORY MAPPING FROM OLD SYSTEM
// ============================================================================

/**
 * Map old PartCategory to new category/type structure
 */
export const LEGACY_CATEGORY_MAPPING: Record<string, { category: PartCategory; type: string }> = {
    'Grounding & Busbars': { category: 'terminals', type: 'busbars' },
    'Wire Ferrules': { category: 'terminals', type: 'wire-ferrules' },
    'Terminal Blocks & Accessories': { category: 'terminals', type: 'terminal-blocks' },
    'Ring Terminals': { category: 'terminals', type: 'ring-terminals' },
    'Fork Terminals': { category: 'terminals', type: 'fork-terminals' },
    'DIN Rail & Mounting': { category: 'hardware', type: 'din-rail' },
    'Passive Components': { category: 'devices', type: 'passive-components' },
    'Diodes & Suppression': { category: 'devices', type: 'suppression' },
    'Measurement & Shunts': { category: 'devices', type: 'measurement' },
    'Control Relays': { category: 'devices', type: 'control-relays' },
    'Relay Sockets': { category: 'devices', type: 'relay-sockets' },
    'Timing Relays': { category: 'devices', type: 'timing-relays' },
    'Protection Relays': { category: 'devices', type: 'protection-relays' },
    'Circuit Protection': { category: 'devices', type: 'circuit-breakers' },
    'Control Power': { category: 'devices', type: 'power-supplies' },
    'Power Conversion': { category: 'devices', type: 'power-conversion' },
    'Operator Controls': { category: 'devices', type: 'operator-controls' },
    'Pilot Lights & Indicators': { category: 'devices', type: 'indicators' },
    'Panel Lighting': { category: 'devices', type: 'panel-lighting' },
    'Alarm Devices': { category: 'devices', type: 'alarm-devices' },
    'Panel Hardware': { category: 'hardware', type: 'panel-hardware' },
    'Cable Management': { category: 'wiring', type: 'cable-management' },
    'Wire Management': { category: 'wiring', type: 'wire-management' },
    'Wire Duct & Panduit': { category: 'wiring', type: 'wire-duct' },
    'HMI & Operator Interface': { category: 'devices', type: 'hmi-panels' },
    'Industrial Computing': { category: 'devices', type: 'computing' },
    'Industrial Networking': { category: 'devices', type: 'networking' },
    'Gateway & Protocol Conversion': { category: 'devices', type: 'gateways' },
    'Time Synchronization': { category: 'devices', type: 'time-sync' },
    'Counters & Timers': { category: 'devices', type: 'counters' },
    'PLC Control Platform': { category: 'devices', type: 'plc-modules' },
    'PLC Rack Hardware': { category: 'devices', type: 'plc-racks' },
    'PLC Communication Modules': { category: 'devices', type: 'plc-comm' },
    'Safety Control System': { category: 'devices', type: 'safety-controllers' },
    'Control Modules': { category: 'devices', type: 'control-modules' },
    'Signal Conditioning': { category: 'devices', type: 'signal-conditioning' },
    'Distributed I/O': { category: 'devices', type: 'distributed-io' },
    'Condition Monitoring I/O': { category: 'devices', type: 'condition-monitoring' },
    'Unknown': { category: 'unknown', type: 'uncategorized' },
}
