# Project Creation and Listing API Verification Guide

This document outlines the process for verifying project creation from the `/{badgeNumber}/schedule` route and understanding how projects are retrieved and listed.

---

## Table of Contents

1. [Project Creation Flow](#project-creation-flow)
2. [API Endpoints](#api-endpoints)
3. [Data Structures](#data-structures)
4. [Verification Process](#verification-process)
5. [Frontend Data Presentation](#frontend-data-presentation)

---

## Project Creation Flow

### Overview

When a user initiates project creation from the Schedule workspace (`/{badgeNumber}/schedule`), the following flow occurs:

```
User Action (Schedule Page)
    │
    ▼
ScheduleContent Component
    │
    ├── Select Legal Package (from /api/legal-drawings)
    │
    ├── Fill Project Details (name, unit, LWC type, color)
    │
    ▼
POST /api/legal-drawings/instantiate
    │
    ▼
createProjectFromLegalSource() in lib/legal-drawings/library.ts
    │
    ├── Validate legal source exists
    ├── Generate project ID
    ├── Create project folder in Share/Projects/
    ├── Seed state from legal revision
    ├── Create project-manifest.json
    │
    ▼
Return ProjectManifest
    │
    ▼
onProjectCreated callback → Navigate to project
```

### Trigger Points

1. **Schedule Page** (`app/(workspaces)/[badgeNumber]/schedule/page.tsx`)
   - Loads legal projects from `/api/legal-drawings`
   - Displays `ScheduleContent` component with project selection

2. **Schedule Content** (`schedule/_components/schedule-content.tsx`)
   - Provides UI for selecting a legal package
   - Form fields: Project Name, Unit Number, LWC Type, Revision, Color
   - Calls `POST /api/legal-drawings/instantiate` on submit

---

## API Endpoints

### 1. GET /api/legal-drawings

**Purpose**: Retrieve available legal drawing packages for project creation

**Request**: No parameters required

**Response Format**:
```typescript
interface LegalDrawingsLibraryManifest {
  generatedAt: string;              // ISO timestamp
  sourceRoot?: string | null;       // Source directory path
  projects: LegalProjectRecord[];   // Array of legal projects
}
```

**Example Response**:
```json
{
  "generatedAt": "2026-04-30T18:00:00.000Z",
  "projects": [
    {
      "pdNumber": "4N671",
      "folderName": "4N671 - S60-86",
      "latestRevision": "M.4",
      "projectNameHint": "S60-86",
      "hasWorkbook": true,
      "hasLayout": true,
      "revisions": [...]
    }
  ]
}
```

### 2. POST /api/legal-drawings/instantiate

**Purpose**: Create a new project instance from a legal source

**Request Body**:
```typescript
interface CreateProjectFromLegalSourceInput {
  pdNumber: string;                    // Required: Legal PD number
  revision: string;                    // Required: Revision identifier
  name: string;                        // Required: Project display name
  unitNumber?: string | null;          // Optional: Unit number
  lwcType?: string | null;             // Optional: LWC type (ONSKID, NEW_FLEX, etc.)
  dueDate?: string | null;             // Optional: ISO date string
  planConlayDate?: string | null;      // Optional: ConLay target date
  planConassyDate?: string | null;     // Optional: ConAssy target date
  shipDate?: string | null;            // Optional: Ship date
  color?: string | null;               // Optional: Project color (hex)
}
```

**Example Request**:
```json
{
  "pdNumber": "4N671",
  "revision": "M.4",
  "name": "S60-86",
  "unitNumber": "1",
  "lwcType": "ONSKID",
  "color": "#ffcc61"
}
```

**Response Format**:
```typescript
interface InstantiateResponse {
  manifest?: ProjectManifest;  // Created project manifest
  error?: string;              // Error message if failed
}
```

**Success Response (200)**:
```json
{
  "manifest": {
    "id": "s60-86-unit-1",
    "name": "S60-86",
    "pdNumber": "4N671",
    "unitNumber": "1",
    "revision": "M.4",
    "lwcType": "ONSKID",
    "color": "#ffcc61",
    "sheets": [...],
    "assignments": {...}
  }
}
```

**Error Response (500)**:
```json
{
  "error": "Legal revision 4N671/M.4 is missing project-manifest.json"
}
```

### 3. GET /api/projects

**Purpose**: List all created project instances

**Request**: No parameters required

**Response Format**:
```typescript
interface ProjectsResponse {
  manifests: ProjectManifest[];
}
```

**Filtering Logic** (Frontend):
- Projects are sorted by `pdNumber` ascending
- Secondary sort by `unitNumber` ascending
- Schedule page filters by `dueMonth` for monthly views

---

## Data Structures

### LegalProjectRecord

Represents a legal drawing package available for instantiation:

```typescript
interface LegalProjectRecord {
  pdNumber: string;                    // Unique project identifier (e.g., "4N671")
  folderName: string;                  // Source folder name
  latestRevision: string | null;       // Most recent revision
  projectNameHint?: string;            // Suggested project name
  projectName?: string | null;         // Override name if set
  dueDate?: string | null;             // Target due date
  dueMonth?: string | null;            // Target month (YYYY-MM)
  planConlayDate?: string | null;      // ConLay planning date
  planConassyDate?: string | null;     // ConAssy planning date
  shipDate?: string | null;            // Ship date
  lwcType?: string | null;             // LWC type classification
  color?: string | null;               // Display color
  hasWorkbook: boolean;                // UCP workbook available
  hasLayout: boolean;                  // Layout PDF available
  revisions: LegalRevisionRecord[];    // Available revisions
}
```

### ProjectManifest

Represents a created project instance:

```typescript
interface ProjectManifest {
  id: string;                          // Unique project ID (slug)
  name: string;                        // Display name
  pdNumber: string;                    // Legal PD number
  unitNumber?: string;                 // Unit identifier
  revision: string;                    // Active revision
  lwcType?: string;                    // LWC type
  color?: string;                      // Display color
  dueDate?: string;                    // Due date
  planConlayDate?: string;             // ConLay date
  planConassyDate?: string;            // ConAssy date
  shipDate?: string;                   // Ship date
  sheets: SheetSummary[];              // Workbook sheets
  assignments: Record<string, AssignmentSummary>; // Work assignments
  // ... additional fields
}
```

### ScheduleProjectItem

Frontend representation for schedule display:

```typescript
interface ScheduleProjectItem {
  id: string;                          // Legal PD or project ID
  pdNumber: string;                    // PD number
  name: string;                        // Display name
  revision?: string;                   // Revision
  dueDate?: string;                    // Due date
  dueMonth?: string;                   // Target month
  lwcType?: string;                    // LWC type
  color?: string;                      // Color
  hasWorkbook: boolean;                // Has UCP
  hasLayout: boolean;                  // Has layout
  isInstantiated: boolean;             // Has project instance
  projectId?: string;                  // Project ID if instantiated
}
```

---

## Verification Process

### Backend Verification Steps

#### Step 1: Verify Legal Source Availability

```bash
# Check legal drawings API response
curl -X GET http://localhost:3000/api/legal-drawings | jq '.projects | length'
```

Expected: Number of available legal packages

#### Step 2: Verify Project Creation

```bash
# Create project via API
curl -X POST http://localhost:3000/api/legal-drawings/instantiate \
  -H "Content-Type: application/json" \
  -d '{
    "pdNumber": "4N671",
    "revision": "M.4",
    "name": "Test Project",
    "unitNumber": "1"
  }' | jq '.'
```

**Verification Checks**:
- Response status is 200
- `manifest.id` is generated and unique
- `manifest.pdNumber` matches input
- `manifest.name` matches input
- `manifest.sheets` array is populated
- `manifest.assignments` object has entries

#### Step 3: Verify Project Persistence

```bash
# List all projects
curl -X GET http://localhost:3000/api/projects | jq '.manifests[] | select(.pdNumber == "4N671")'
```

**Verification Checks**:
- Created project appears in list
- All fields persisted correctly
- Project folder created at `Share/Projects/{projectFolder}/`

#### Step 4: Verify File Structure

```
Share/Projects/{pdNumber}-{name}/
├── state/
│   ├── project-manifest.json    # Main manifest
│   ├── upload-props.json        # Workbook metadata
│   ├── sheets/                  # Sheet schemas
│   │   ├── {sheet-slug}.json
│   │   └── ...
│   ├── wire-brand-list/         # Brand schemas
│   ├── wire-list-print-schema/  # Print schemas
│   └── layout-pages/            # Layout page data
└── workbook/                    # Original files (if copied)
```

### Frontend Verification Steps

#### Step 1: Navigate to Schedule Page

```
URL: /{badgeNumber}/schedule
```

**Verify**:
- Legal packages load in left panel
- "Create Project" and "Create Unit" buttons visible
- Project selection shows PD number, revision, LWC type

#### Step 2: Initiate Project Creation

1. Select a legal package from the list
2. Click "Create Project" or "Create Unit"
3. Fill required fields (name, unit number if applicable)
4. Select optional fields (LWC type, color)
5. Click "Create"

**Verify During Creation**:
- Loading state shows while creating
- No console errors
- Network tab shows POST to `/api/legal-drawings/instantiate`

#### Step 3: Verify Post-Creation

**Verify**:
- `onProjectCreated` callback fired with project ID
- Navigation to new project page (if configured)
- Project appears in `/api/projects` listing
- Schedule page refreshes to show new project

### Browser DevTools Verification

#### Network Tab Inspection

1. Filter by "Fetch/XHR"
2. Look for:
   - `GET /api/legal-drawings` (initial load)
   - `POST /api/legal-drawings/instantiate` (creation)
   - `GET /api/projects` (refresh after creation)

#### Request/Response Validation

For `POST /api/legal-drawings/instantiate`:

**Request Headers**:
```
Content-Type: application/json
```

**Request Payload** (verify all fields present):
```json
{
  "pdNumber": "string",
  "revision": "string",
  "name": "string",
  "unitNumber": "string|null",
  "lwcType": "string|null",
  "color": "string|null"
}
```

**Response** (verify structure):
```json
{
  "manifest": {
    "id": "string",
    "name": "string",
    "pdNumber": "string",
    "sheets": [],
    "assignments": {}
  }
}
```

---

## Frontend Data Presentation

### Schedule Page Data Flow

```
Schedule Page Load
    │
    ├── useEffect: loadProjects()
    │   ├── GET /api/projects → setProjects(manifests)
    │   └── GET /api/legal-drawings → setLegalProjects(projects)
    │
    ├── useMemo: scheduleItems
    │   └── Merge legal + instantiated into ScheduleProjectItem[]
    │
    └── Render ScheduleContent
        ├── Project selection list (left)
        ├── Creation form (center)
        └── Preview/details (right)
```

### Monthly Filtering Logic

The schedule page filters projects by month:

```typescript
const projectsForMonth = useMemo(() => {
  const targetMonth = selectedMonth; // Format: "YYYY-MM"
  
  return scheduleItems.filter(item => {
    // Match by dueMonth field
    if (item.dueMonth === targetMonth) return true;
    
    // Match by dueDate month extraction
    if (item.dueDate) {
      const itemMonth = item.dueDate.slice(0, 7); // "YYYY-MM"
      return itemMonth === targetMonth;
    }
    
    return false;
  });
}, [scheduleItems, selectedMonth]);
```

### Project Card Display

Each project in the schedule shows:
- Project icon with color
- PD number badge
- LWC type badge (with dot indicator for type color)
- Revision badge
- Due date (if set)
- Creation status (instantiated vs available)

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Legal revision not found" | Missing revision folder | Sync legal drawings library |
| "Missing project-manifest.json" | Revision not built | Run rebuild files |
| "Failed to create project" | Disk/permission error | Check Share directory permissions |
| Empty projects list | No projects created | Create first project from schedule |

### Debugging Tips

1. **Check Console Logs**: Look for `[v0]` prefixed logs
2. **Verify API Responses**: Use Network tab to inspect payloads
3. **Check File System**: Verify `Share/Projects/` structure
4. **Validate Manifest**: Read `project-manifest.json` directly

---

## Summary

The project creation flow from the schedule route involves:

1. **Loading** legal packages via `GET /api/legal-drawings`
2. **Selecting** a legal source and filling project details
3. **Creating** via `POST /api/legal-drawings/instantiate`
4. **Verifying** creation through API response and file system
5. **Displaying** in project listings via `GET /api/projects`

The system maintains data integrity by:
- Seeding project state from legal revision files
- Generating unique project IDs
- Persisting all metadata in `project-manifest.json`
- Supporting incremental updates via manifest enrichment
