/**
 * Component Documentation Configuration
 * 
 * Data model for all documented components.
 * This file serves as the authoritative source for component metadata.
 */

export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  category?: "data" | "config" | "callback" | "feature";
  default?: string;
}

export interface ComponentDoc {
  id: string;
  name: string;
  filePath: string;
  category: string;
  shortDescription: string;
  description: string;
  priority: "high" | "medium" | "low";
  architectureRole: string;
  props: PropDoc[];
  hooks: string[];
  utilities: string[];
  parents: string[];
  children: string[];
  motionDetails?: string;
  demoComponent?: React.ComponentType<any>;
  usageExample?: string;
}

export const COMPONENT_DOCS: ComponentDoc[] = [
  {
    id: "semantic-wire-list",
    name: "SemanticWireList",
    filePath: "/components/wire-list/semantic-wire-list.tsx",
    category: "Wire List / Table Core",
    shortDescription: "Main table orchestration component with TanStack/Headless UI table integration",
    description: "The core wire list table component that renders semantic wire data with full feature support. Handles row grouping by location, column visibility, filtering, workflow state management, and interactive cells for checkboxes, comments, and wire length calculations.",
    priority: "high",
    architectureRole: "Primary table orchestration - renders all wire list data with semantic grouping and real-time workflow updates",
    props: [
      {
        name: "rows",
        type: "SemanticWireListRow[]",
        required: true,
        description: "Array of wire list rows to render",
        category: "data",
      },
      {
        name: "metadata",
        type: "SheetMetadataInfo",
        required: true,
        description: "Sheet metadata containing project info",
        category: "data",
      },
      {
        name: "featureConfig",
        type: "WireListFeatureConfig",
        required: false,
        description: "Enable/disable table features like checkboxes, comments, grouping",
        category: "config",
      },
      {
        name: "activeRowId",
        type: "string | null",
        required: false,
        description: "Row ID to highlight as active (from sidebar nav)",
        category: "config",
      },
      {
        name: "diagnostics",
        type: "WireListParserDiagnostics",
        required: false,
        description: "Parser diagnostic data for debugging",
        category: "data",
      },
    ],
    hooks: [
      "useWireListFilters",
      "useWireListLocationFilter",
      "useWireListScrollspy",
      "useRowWorkflowState",
      "useIsMobile",
    ],
    utilities: [
      "getUniqueLocations()",
      "buildRowGroups()",
      "computeWireLength()",
      "normalizeDeviceId()",
    ],
    parents: ["SemanticWireListWithSidebar", "SheetDetailPage"],
    children: ["WireListTable", "WireListCells", "LocationTabs"],
    motionDetails: "Staggered row entrance with Framer Motion, smooth transitions on data updates, hover scale effects on interactive cells",
    usageExample: `
<SemanticWireList
  rows={rows}
  metadata={metadata}
  featureConfig={{
    showCheckboxColumns: true,
    groupByLocation: true,
    stickyGroupHeaders: true,
  }}
  activeRowId={activeRowId}
/>
    `,
  },
  {
    id: "unified-upload-card",
    name: "UnifiedUploadCard",
    filePath: "/components/projects/unified-upload-card.tsx",
    category: "Upload & Project Assets",
    shortDescription: "Primary entry point for file uploads with drag-drop and file explorer support",
    description: "Handles both Excel workbook and optional layout PDF uploads. Features drag-and-drop zone, file validation, progress tracking with visual feedback, and seamless integration with project creation workflow.",
    priority: "high",
    architectureRole: "Entry point for user interaction - receives files, validates formats, and triggers project creation",
    props: [
      {
        name: "onExcelUpload",
        type: "(file: File, rows: ParsedSheetData[]) => Promise<void>",
        required: true,
        description: "Callback when Excel file is successfully parsed",
        category: "callback",
      },
      {
        name: "onLayoutUpload",
        type: "(file: File) => Promise<void>",
        required: false,
        description: "Callback when optional layout PDF is uploaded",
        category: "callback",
      },
      {
        name: "isProcessing",
        type: "boolean",
        required: false,
        description: "Disable interactions during processing",
        category: "config",
      },
    ],
    hooks: ["useRef", "useState"],
    utilities: [
      "parseExcelWorkbook()",
      "validateFileType()",
      "extractPdfText()",
    ],
    parents: ["ProjectsPage"],
    children: [],
    motionDetails: "Drag-over highlight with spring animation, file progress indicator with linear progress bar",
    usageExample: `
<UnifiedUploadCard
  onExcelUpload={async (file, rows) => {
    await createProject(rows);
  }}
  onLayoutUpload={async (file) => {
    await uploadLayoutPdf(file);
  }}
/>
    `,
  },
  {
    id: "layout-preview-modal",
    name: "LayoutPreviewModal",
    filePath: "/components/projects/layout-preview-modal.tsx",
    category: "Upload & Project Assets",
    shortDescription: "Interactive PDF layout viewer with pan, zoom, and touch gesture support",
    description: "Displays uploaded PDF layout pages with advanced interaction capabilities. Supports pinch-to-zoom, pan gestures, page navigation, and page-to-sheet matching preview with motion-animated overlays.",
    priority: "high",
    architectureRole: "Layout preview and matching verification - allows users to preview PDFs and confirm matches before saving",
    props: [
      {
        name: "isOpen",
        type: "boolean",
        required: true,
        description: "Control modal visibility",
        category: "config",
      },
      {
        name: "pages",
        type: "LayoutPagePreview[]",
        required: true,
        description: "Array of rendered PDF pages with metadata",
        category: "data",
      },
      {
        name: "onClose",
        type: "() => void",
        required: true,
        description: "Callback when modal is closed",
        category: "callback",
      },
      {
        name: "matches",
        type: "SheetLayoutMatch[]",
        required: false,
        description: "Sheet-to-page matching results for preview",
        category: "data",
      },
    ],
    hooks: ["useGesture", "useState", "useRef"],
    utilities: [
      "calculateZoomBounds()",
      "constrainPan()",
    ],
    parents: ["ProjectsPage", "LayoutPreviewCard"],
    children: [],
    motionDetails: "Modal entrance with backdrop fade, pan/zoom gestures with Framer Motion, smooth page transitions, overlay animations for matches",
    usageExample: `
<LayoutPreviewModal
  isOpen={modalOpen}
  pages={previewPages}
  onClose={() => setModalOpen(false)}
  matches={sheetMatches}
/>
    `,
  },
  {
    id: "original-wire-list-sidebar",
    name: "OriginalWireListSidebar",
    filePath: "/components/original-wire-list-sidebar/original-wire-list-sidebar.tsx",
    category: "Wire List Navigation",
    shortDescription: "Responsive drawer/side panel for navigating original extracted wire list",
    description: "Comparison and navigation layer showing original extracted wire list rows. Includes search, column visibility toggles, filter by match state, and scrollspy functionality. Renders as side panel on desktop, full-screen drawer on mobile.",
    priority: "high",
    architectureRole: "Navigation and verification layer - allows users to verify extracted data matches the original and navigate via sidebar",
    props: [
      {
        name: "originalRows",
        type: "SemanticWireListRow[]",
        required: true,
        description: "Original extracted wire list rows",
        category: "data",
      },
      {
        name: "visibleEnhancedRowIds",
        type: "Set<string>",
        required: true,
        description: "IDs of currently visible rows in main table",
        category: "data",
      },
      {
        name: "onScrollToRow",
        type: "(rowId: string) => void",
        required: true,
        description: "Callback to scroll main table to row",
        category: "callback",
      },
      {
        name: "collapsed",
        type: "boolean",
        required: false,
        description: "Control collapsed state",
        category: "config",
      },
    ],
    hooks: [
      "useOriginalWireListSidebar",
      "useOriginalWireListScrollspy",
      "useOriginalWireListRecent",
      "useIsMobile",
    ],
    utilities: [
      "compareRows()",
      "buildSheetLabelMap()",
      "matchPageByLabels()",
    ],
    parents: ["SemanticWireListWithSidebar"],
    children: ["SidebarSection", "SidebarItem", "SidebarSearch"],
    motionDetails: "Mobile drawer with backdrop, scroll-into-view for active items, staggered section entrance, hover animations on sidebar items",
    usageExample: `
<OriginalWireListSidebar
  originalRows={originalRows}
  visibleEnhancedRowIds={visibleIds}
  onScrollToRow={handleScrollToRow}
  collapsed={sidebarCollapsed}
/>
    `,
  },
  {
    id: "project-sheet-card",
    name: "ProjectSheetCard",
    filePath: "/components/projects/project-sheet-card.tsx",
    category: "Project Management",
    shortDescription: "Card component displaying individual sheet preview with metadata and actions",
    description: "Shows sheet preview with sample rows, statistics (row count, columns), and action buttons. Includes staggered animation on load and interactive hover effects.",
    priority: "medium",
    architectureRole: "Sheet selection and preview - allows users to browse and select sheets before viewing details",
    props: [
      {
        name: "sheet",
        type: "ParsedWorkbookSheet",
        required: true,
        description: "Sheet data including name, kind, and sample rows",
        category: "data",
      },
      {
        name: "onClick",
        type: "() => void",
        required: true,
        description: "Callback when card is clicked",
        category: "callback",
      },
      {
        name: "isSelected",
        type: "boolean",
        required: false,
        description: "Visual highlight for selected sheet",
        category: "config",
      },
    ],
    hooks: ["useState"],
    utilities: ["getSheetKindLabel()"],
    parents: ["ProjectDetailPage"],
    children: [],
    motionDetails: "Staggered entrance from grid, hover scale and shadow lift, border pulse on selection",
    usageExample: `
<ProjectSheetCard
  sheet={sheetData}
  onClick={() => navigateToSheet(sheetData.id)}
  isSelected={selectedSheetId === sheetData.id}
/>
    `,
  },
  {
    id: "branding-workflow-toolbar",
    name: "BrandingWorkflowToolbar",
    filePath: "/components/branding/branding-workflow-toolbar.tsx",
    category: "Workflow & UI",
    shortDescription: "Floating toolbar for branding identification workflow with motion-animated popover",
    description: "Displays branding identification options in a floating toolbar with Floating UI positioning. Includes category filters, count displays, and motion-animated popover that follows scroll.",
    priority: "medium",
    architectureRole: "Workflow action panel - surfaces branding identification options in fixed/floating position",
    props: [
      {
        name: "categories",
        type: "string[]",
        required: true,
        description: "Available branding categories",
        category: "data",
      },
      {
        name: "selectedCategory",
        type: "string",
        required: true,
        description: "Currently selected category",
        category: "config",
      },
      {
        name: "onCategorySelect",
        type: "(category: string) => void",
        required: true,
        description: "Callback when category is selected",
        category: "callback",
      },
      {
        name: "counts",
        type: "Record<string, number>",
        required: true,
        description: "Count of items per category",
        category: "data",
      },
    ],
    hooks: ["useFloating", "useIsMobile"],
    utilities: [],
    parents: ["SheetDetailPage"],
    children: [],
    motionDetails: "Floating popover with backdrop, button hover scale effects, entrance animation on mount",
    usageExample: `
<BrandingWorkflowToolbar
  categories={["Connector", "Relay", "Switch"]}
  selectedCategory={selected}
  onCategorySelect={setSelected}
  counts={categoryCounts}
/>
    `,
  },
  {
    id: "filter-components",
    name: "Filter Components (Identification, Gauge, Prefix, etc.)",
    filePath: "/components/wire-list/[identification|gauge|prefix]-filter-dropdown.tsx",
    category: "Filters & Search",
    shortDescription: "Reusable filter dropdown components for table columns",
    description: "Family of filter dropdown components for different column types. Each handles option extraction, filtering logic, and visual feedback. Includes search within filter options.",
    priority: "medium",
    architectureRole: "Column filtering UI - provides user interface for filtering by specific column values",
    props: [
      {
        name: "value",
        type: "string | string[]",
        required: true,
        description: "Currently selected filter value(s)",
        category: "config",
      },
      {
        name: "onChange",
        type: "(value: string | string[]) => void",
        required: true,
        description: "Callback when filter value changes",
        category: "callback",
      },
      {
        name: "options",
        type: "FilterOption[]",
        required: true,
        description: "Available filter options with counts",
        category: "data",
      },
      {
        name: "isMulti",
        type: "boolean",
        required: false,
        description: "Allow multiple selections",
        category: "config",
        default: "false",
      },
    ],
    hooks: ["useState", "useMemo"],
    utilities: ["extractColumnValues()", "countMatches()"],
    parents: ["WireListToolbar"],
    children: [],
    motionDetails: "Dropdown menu with fade entrance, search input with focus highlight",
    usageExample: `
<GaugeFilterDropdown
  value={gaugeFilter}
  onChange={setGaugeFilter}
  options={gaugeOptions}
/>
    `,
  },
];

export const COMPONENT_CATEGORIES = [
  { id: "wire-list", label: "Wire List / Table Core", color: "bg-blue-500" },
  { id: "upload", label: "Upload & Project Assets", color: "bg-purple-500" },
  { id: "project", label: "Project Management", color: "bg-green-500" },
  { id: "workflow", label: "Workflow & UI", color: "bg-amber-500" },
  { id: "filters", label: "Filters & Search", color: "bg-pink-500" },
  { id: "navigation", label: "Wire List Navigation", color: "bg-cyan-500" },
];

export function getComponentDoc(componentId: string): ComponentDoc | undefined {
  return COMPONENT_DOCS.find(doc => doc.id === componentId);
}

export function getComponentsByCategory(category: string): ComponentDoc[] {
  return COMPONENT_DOCS.filter(doc => doc.category.toLowerCase().includes(category.toLowerCase()));
}

export function getComponentsByPriority(priority: "high" | "medium" | "low"): ComponentDoc[] {
  return COMPONENT_DOCS.filter(doc => doc.priority === priority);
}
