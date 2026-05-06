"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandInput } from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import {
  createInitialTabState,
  executeAction,
  filterTabsWithQuery,
  getProjectActionTabs,
  INITIAL_BANNER_STATE,
  loadTabData,
  type ProjectActionState,
  type ProjectBannerState,
  type ProjectTabState,
} from './project-action-runtime';
import type { ProjectActionContext, ProjectActionTabId } from './project-action-registry';

export interface ProjectActionPopoverProps {
  context: ProjectActionContext;
  onNavigate?: (url: string) => void;
}

export function ProjectActionPopover({ context, onNavigate }: ProjectActionPopoverProps) {
  const tabs = useMemo(() => getProjectActionTabs(), []);
  const [activeTab, setActiveTab] = useState<ProjectActionTabId>(tabs[0]?.id ?? 'overview');
  const [query, setQuery] = useState('');
  const [bannerState, setBannerState] = useState<ProjectBannerState>(INITIAL_BANNER_STATE);
  const [tabState, setTabState] = useState<Record<ProjectActionTabId, ProjectTabState>>(() => createInitialTabState(tabs));
  const [actionState, setActionState] = useState<Record<string, ProjectActionState>>({});

  const filteredTabs = useMemo(() => filterTabsWithQuery(tabs, query), [tabs, query]);
  const visibleTabs = filteredTabs.length ? filteredTabs : tabs;
  const activeVisibleTab = visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0] ?? null;

  const handleTabChange = async (nextTabId: string) => {
    const normalized = nextTabId as ProjectActionTabId;
    setActiveTab(normalized);
    const targetTab = tabs.find((tab) => tab.id === normalized);
    if (!targetTab) return;

    setTabState((current) => ({ ...current, [normalized]: { ...current[normalized], loading: true, warning: undefined } }));
    const loaded = await loadTabData(targetTab, context);
    setTabState((current) => ({
      ...current,
      [normalized]: {
        loading: false,
        loadedAt: new Date().toISOString(),
        warning: loaded.warnings.length ? loaded.warnings.join(' · ') : undefined,
      },
    }));

    if (loaded.warnings.length) {
      setBannerState({ kind: 'warning', message: loaded.warnings.join(' · ') });
    }
  };

  const runAction = async (actionId: string) => {
    const tab = activeVisibleTab;
    if (!tab) return;
    const action = tab.cards.flatMap((card) => card.actions).find((candidate) => candidate.id === actionId);
    if (!action) return;

    setActionState((current) => ({ ...current, [actionId]: { loading: true } }));
    const result = await executeAction(action, context, { navigate: onNavigate });
    setActionState((current) => ({
      ...current,
      [actionId]: {
        loading: false,
        success: result.status === 'success' ? result.message : undefined,
        warning: result.status === 'warning' ? result.message : undefined,
      },
    }));
    setBannerState({ kind: result.status, message: result.message });
  };

  return (
    <div className="w-[460px] max-w-[92vw] space-y-3">
      <div className="rounded-xl border bg-muted/20 p-3">
        <div className="text-sm font-semibold">{context.projectName}</div>
        <div className="text-xs text-muted-foreground">Project actions and API tools</div>
      </div>

      <Command className="rounded-xl border">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search actions, cards, tabs..." />
      </Command>

      {bannerState.kind !== 'idle' ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            bannerState.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {bannerState.kind === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{bannerState.message}</span>
        </div>
      ) : null}

      <Tabs value={activeVisibleTab?.id ?? activeTab} onValueChange={(value) => void handleTabChange(value)}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeVisibleTab ? (
        <div className="space-y-2">
          {tabState[activeVisibleTab.id]?.loading ? (
            <div className="rounded-lg border p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading {activeVisibleTab.label} data...
            </div>
          ) : null}

          {tabState[activeVisibleTab.id]?.warning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {tabState[activeVisibleTab.id]?.warning}
            </div>
          ) : null}

          {activeVisibleTab.cards.map((card) => (
            <Card key={card.id} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{card.title}</CardTitle>
                {card.subtitle ? <p className="text-xs text-muted-foreground">{card.subtitle}</p> : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {card.actions.map((action) => {
                  const state = actionState[action.id];
                  return (
                    <div key={action.id} className="rounded-lg border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <action.icon className="h-3.5 w-3.5" />
                            {action.label}
                          </div>
                          {action.description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{action.description}</p> : null}
                        </div>
                        <Button size="sm" className="h-7 text-xs" onClick={() => void runAction(action.id)} disabled={state?.loading}>
                          {state?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Run'}
                        </Button>
                      </div>
                      {state?.success ? (
                        <Badge className="mt-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{state.success}</Badge>
                      ) : null}
                      {state?.warning ? (
                        <Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">{state.warning}</Badge>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-xs text-muted-foreground">No matching actions for your search.</div>
      )}
    </div>
  );
}
