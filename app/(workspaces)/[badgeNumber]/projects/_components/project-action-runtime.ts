"use client";

import { PROJECT_ACTION_TABS, resolveProjectEndpoint, type ProjectActionContext, type ProjectActionDefinition, type ProjectActionTabDefinition, type ProjectActionTabId } from './project-action-registry';

export type ActionResultStatus = 'success' | 'warning';

export interface ActionResult {
  status: ActionResultStatus;
  message: string;
  payload?: unknown;
}

export type ActionRuntimeOptions = {
  navigate?: (url: string) => void;
};

export function defaultNavigate(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function loadTabData(tab: ProjectActionTabDefinition, context: ProjectActionContext) {
  const payload: Record<string, unknown> = {};
  const warnings: string[] = [];

  if (!tab.loaderEndpoints?.length) {
    return { payload, warnings };
  }

  await Promise.all(
    tab.loaderEndpoints.map(async (loader) => {
      try {
        const url = resolveProjectEndpoint(loader.endpoint, context.projectId);
        const response = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!response.ok) {
          warnings.push(`${loader.id}: HTTP ${response.status}`);
          return;
        }
        payload[loader.id] = await response.json().catch(() => null);
      } catch (error) {
        warnings.push(`${loader.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  return { payload, warnings };
}

async function executeApiCall(action: ProjectActionDefinition, context: ProjectActionContext) {
  if (!action.endpoint) {
    return { status: 'warning', message: `Action ${action.label} missing endpoint.` } as ActionResult;
  }

  const url = resolveProjectEndpoint(action.endpoint, context.projectId);
  const method = action.method ?? 'GET';
  const body =
    action.handlerKey === 'generate-wire-print-schemas'
      ? { mode: 'all' }
      : action.handlerKey === 'generate-brand-schemas'
        ? { mode: 'all' }
        : undefined;

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      status: 'warning',
      message: payload?.error || `${action.label} failed (HTTP ${response.status}).`,
      payload,
    } as ActionResult;
  }

  return {
    status: 'success',
    message: `${action.label} completed successfully.`,
    payload,
  } as ActionResult;
}

function buildRouteForAction(action: ProjectActionDefinition, context: ProjectActionContext): string | null {
  switch (action.handlerKey) {
    case 'open-project-details':
      return `/projects/${encodeURIComponent(context.projectId)}`;
    case 'open-legals-tab':
      return `/projects/${encodeURIComponent(context.projectId)}?tab=legals`;
    case 'open-project-exports':
      return `/api/projects/${encodeURIComponent(context.projectId)}/exports`;
    case 'open-stage-hours':
      return `/api/projects/${encodeURIComponent(context.projectId)}/stage-hours`;
    default:
      return action.endpoint ? resolveProjectEndpoint(action.endpoint, context.projectId) : null;
  }
}

export async function executeAction(
  action: ProjectActionDefinition,
  context: ProjectActionContext,
  options: ActionRuntimeOptions = {},
): Promise<ActionResult> {
  const navigate = options.navigate ?? defaultNavigate;

  if (action.intent === 'navigate') {
    const route = buildRouteForAction(action, context);
    if (!route) {
      return { status: 'warning', message: `No route configured for ${action.label}.` };
    }
    navigate(route);
    return { status: 'success', message: `Opened ${action.label}.` };
  }

  return executeApiCall(action, context);
}

export function getProjectActionTabs(): ProjectActionTabDefinition[] {
  return PROJECT_ACTION_TABS;
}

export function filterTabsWithQuery(tabs: ProjectActionTabDefinition[], query: string): ProjectActionTabDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return tabs;

  return tabs
    .map((tab) => {
      const cards = tab.cards
        .map((card) => {
          const actions = card.actions.filter((action) => {
            const haystack = [
              action.label,
              action.description ?? '',
              ...(action.searchTerms ?? []),
              card.title,
              card.subtitle ?? '',
              tab.label,
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          });
          return { ...card, actions };
        })
        .filter((card) => card.actions.length > 0);
      return { ...tab, cards };
    })
    .filter((tab) => tab.cards.length > 0);
}

export type ProjectActionState = {
  loading: boolean;
  success?: string;
  warning?: string;
};

export type ProjectTabState = {
  loading: boolean;
  loadedAt?: string;
  warning?: string;
};

export type ProjectBannerState = {
  kind: 'idle' | 'success' | 'warning';
  message?: string;
};

export const INITIAL_BANNER_STATE: ProjectBannerState = { kind: 'idle' };

export function createInitialTabState(tabs: ProjectActionTabDefinition[]): Record<ProjectActionTabId, ProjectTabState> {
  return tabs.reduce((acc, tab) => {
    acc[tab.id] = { loading: false };
    return acc;
  }, {} as Record<ProjectActionTabId, ProjectTabState>);
}
