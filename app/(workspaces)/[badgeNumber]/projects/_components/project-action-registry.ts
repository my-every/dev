import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ClipboardList,
  Download,
  FileSearch,
  LayoutPanelTop,
  RefreshCw,
  Settings,
  ShieldAlert,
  Workflow,
} from 'lucide-react';

export type ProjectActionTabId = 'overview' | 'schemas' | 'exports' | 'maintenance';

export type ProjectActionIntent = 'navigate' | 'api-get' | 'api-post';

export interface ProjectActionContext {
  projectId: string;
  projectName: string;
}

export interface ProjectActionDefinition {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  intent: ProjectActionIntent;
  handlerKey: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  searchTerms?: string[];
}

export interface ProjectActionCardDefinition {
  id: string;
  title: string;
  subtitle?: string;
  actions: ProjectActionDefinition[];
}

export interface ProjectActionTabDefinition {
  id: ProjectActionTabId;
  label: string;
  icon: LucideIcon;
  loaderEndpoints?: Array<{ id: string; endpoint: string }>;
  cards: ProjectActionCardDefinition[];
}

export const PROJECT_ACTION_TABS: ProjectActionTabDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Activity,
    loaderEndpoints: [
      { id: 'project', endpoint: '/api/projects/:projectId' },
      { id: 'progress', endpoint: '/api/projects/:projectId/progress' },
      { id: 'actionState', endpoint: '/api/projects/:projectId/action-state' },
      { id: 'units', endpoint: '/api/projects/:projectId/units' },
      { id: 'stageHours', endpoint: '/api/projects/:projectId/stage-hours' },
    ],
    cards: [
      {
        id: 'workspace-nav',
        title: 'Workspace Navigation',
        subtitle: 'Jump directly into the core project workspaces.',
        actions: [
          {
            id: 'open-project-details',
            label: 'Open Project Details',
            description: 'Navigate to project details workspace.',
            icon: LayoutPanelTop,
            intent: 'navigate',
            handlerKey: 'open-project-details',
            searchTerms: ['workspace', 'details'],
          },
          {
            id: 'open-legals-tab',
            label: 'Open Legals',
            description: 'Jump to legal drawing and revision flow.',
            icon: FileSearch,
            intent: 'navigate',
            handlerKey: 'open-legals-tab',
            searchTerms: ['legals', 'drawings', 'revision'],
          },
        ],
      },
    ],
  },
  {
    id: 'schemas',
    label: 'Schemas',
    icon: ClipboardList,
    loaderEndpoints: [
      { id: 'wirePrint', endpoint: '/api/projects/:projectId/wire-list-print-schemas' },
      { id: 'brandSchemas', endpoint: '/api/projects/:projectId/wire-brand-list-schemas' },
    ],
    cards: [
      {
        id: 'schema-generate',
        title: 'Schema Generation',
        subtitle: 'Generate and refresh wire + brand list schemas.',
        actions: [
          {
            id: 'generate-wire-print-schemas',
            label: 'Generate Wire Schemas',
            description: 'Generate all wire-list print schemas.',
            icon: Workflow,
            intent: 'api-post',
            handlerKey: 'generate-wire-print-schemas',
            endpoint: '/api/projects/:projectId/wire-list-print-schemas',
            method: 'POST',
            searchTerms: ['wire', 'print', 'schema', 'generate'],
          },
          {
            id: 'generate-brand-schemas',
            label: 'Generate Brand Schemas',
            description: 'Generate all branding export schemas.',
            icon: Workflow,
            intent: 'api-post',
            handlerKey: 'generate-brand-schemas',
            endpoint: '/api/projects/:projectId/wire-brand-list-schemas',
            method: 'POST',
            searchTerms: ['brand', 'schema', 'generate'],
          },
        ],
      },
    ],
  },
  {
    id: 'exports',
    label: 'Exports',
    icon: Download,
    loaderEndpoints: [
      { id: 'exports', endpoint: '/api/projects/:projectId/exports' },
      { id: 'layoutPdf', endpoint: '/api/projects/:projectId/layout-pdf' },
      { id: 'wiringExecution', endpoint: '/api/projects/:projectId/wiring-execution' },
    ],
    cards: [
      {
        id: 'export-nav',
        title: 'Export Actions',
        subtitle: 'Open export registry and downloadable outputs.',
        actions: [
          {
            id: 'open-project-exports',
            label: 'Open Project Exports',
            description: 'Open export list endpoint in a new tab.',
            icon: Download,
            intent: 'navigate',
            handlerKey: 'open-project-exports',
            searchTerms: ['exports', 'download'],
          },
        ],
      },
    ],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: Settings,
    loaderEndpoints: [
      { id: 'project', endpoint: '/api/projects/:projectId' },
    ],
    cards: [
      {
        id: 'terminal-sync',
        title: 'Terminal Intelligence',
        subtitle: 'Sync part terminal metadata from current project sheets.',
        actions: [
          {
            id: 'resync-terminals',
            label: 'Resync Part Terminals',
            description: 'Updates terminal schema + negative mapping rules.',
            icon: RefreshCw,
            intent: 'api-post',
            handlerKey: 'resync-terminals',
            endpoint: '/api/projects/:projectId/parts/resync-terminals',
            method: 'POST',
            searchTerms: ['terminal', 'sync', 'negative', 'parts'],
          },
        ],
      },
      {
        id: 'diagnostics',
        title: 'Diagnostics',
        subtitle: 'Inspect current project runtime endpoints.',
        actions: [
          {
            id: 'open-stage-hours',
            label: 'Inspect Stage Hours',
            description: 'Open stage-hour diagnostics endpoint.',
            icon: ShieldAlert,
            intent: 'navigate',
            handlerKey: 'open-stage-hours',
            searchTerms: ['stage', 'hours', 'diagnostics'],
          },
        ],
      },
    ],
  },
];

export function resolveProjectEndpoint(endpoint: string, projectId: string): string {
  return endpoint.replaceAll(':projectId', encodeURIComponent(projectId));
}
