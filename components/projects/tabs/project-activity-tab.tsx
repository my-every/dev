"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  Camera,
  ClipboardList,
  FileUp,
  Loader2,
  Route,
} from "lucide-react";

import { ActivityTimeline } from "@/components/activity/activity-timeline";
import type { PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import {
  buildProjectLifecycleSteps,
  type ProjectActionStateSummary,
} from "@/components/projects/project-lifecycle-stepper";
import { PROJECT_ACTIVITY_QUICK_ACTIONS } from "@/components/projects/project-quick-action-config";
import { ProjectQuickActions } from "@/components/projects/project-quick-actions";
import { EmptyTabState } from "@/components/projects/tabs/project-tab-helpers";
import type {
  ProjectTabId,
  ProjectTabProps,
} from "@/components/projects/tabs/project-tab-types";
import type { ActivityEntry } from "@/types/activity";

interface BiqPhotoStateResponse {
  data?: {
    photos?: PhotoGalleryItem[];
  };
}

interface ProjectActivityResponse {
  projectId: string;
  activities: ActivityEntry[];
  total: number;
}

interface ProjectActivityTabProps extends ProjectTabProps {
  timelineOnly?: boolean;
}

export function ProjectActivityTab({
  project,
  onNavigateToTab,
  timelineOnly = false,
}: ProjectActivityTabProps) {
  const params = useParams<{ badgeNumber?: string }>();
  const currentBadge =
    typeof params?.badgeNumber === "string" ? params.badgeNumber : undefined;
  const [summary, setSummary] = useState<ProjectActionStateSummary | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoGalleryItem[]>([]);
  const [realActivities, setRealActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);

    fetch(`/api/projects/${encodeURIComponent(project.id)}/action-state`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { summary?: ProjectActionStateSummary } | null) => {
        if (!cancelled) {
          setSummary(payload?.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${encodeURIComponent(project.id)}/state/biq-photos`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: BiqPhotoStateResponse | null) => {
        if (!cancelled) {
          setPhotos(
            Array.isArray(payload?.data?.photos) ? payload.data.photos : [],
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhotos([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Fetch real activity entries from the project activity API
  useEffect(() => {
    let cancelled = false;
    setActivitiesLoading(true);

    fetch(`/api/projects/${encodeURIComponent(project.id)}/activity?limit=200`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ProjectActivityResponse | null) => {
        if (!cancelled) {
          setRealActivities(payload?.activities ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRealActivities([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setActivitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Refresh handler for the timeline
  const handleRefresh = useCallback(async () => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(project.id)}/activity?limit=200`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const payload: ProjectActivityResponse = await response.json();
      setRealActivities(payload.activities ?? []);
    }
  }, [project.id]);

  const activities = useMemo<ActivityEntry[]>(() => {
    // Start with real activities fetched from API
    const entries: ActivityEntry[] = [...realActivities];
    
    // Create a set of existing activity IDs to avoid duplicates
    const existingIds = new Set(entries.map((e) => e.id));
    
    // Add synthetic PROJECT_CREATED if not already in real activities
    const hasProjectCreated = entries.some((e) => e.action === "PROJECT_CREATED");
    if (!hasProjectCreated) {
      const createdAt = project.createdAt || new Date().toISOString();
      entries.push({
        id: `${project.id}-created`,
        timestamp: createdAt,
        action: "PROJECT_CREATED",
        projectId: project.id,
        performedBy: currentBadge ?? "system",
        result: "success",
        metadata: {
          projectId: project.id,
          projectName: project.name,
          pdNumber: project.pdNumber,
          description: "Project planning record created.",
        },
      });
    }

    // Add lifecycle step activities (only if not already tracked)
    const lifecycleSteps = buildProjectLifecycleSteps(project, summary);
    lifecycleSteps.forEach((step) => {
      const actualId = `${project.id}-${step.id}-actual`;
      const pendingId = `${project.id}-${step.id}-pending`;
      
      if (step.actualDate && !existingIds.has(actualId)) {
        entries.push({
          id: actualId,
          timestamp: step.actualDate.toISOString(),
          action: "COMPLETED",
          projectId: project.id,
          stage: step.label,
          performedBy: currentBadge ?? "system",
          result: "success",
          metadata: {
            projectId: project.id,
            projectName: project.name,
            pdNumber: project.pdNumber,
            description: `${step.label} completed.`,
          },
        });
        return;
      }

      if ((step.status === "available" || step.status === "overdue") && !existingIds.has(pendingId)) {
        entries.push({
          id: pendingId,
          timestamp: (step.plannedDate ?? new Date()).toISOString(),
          action: "STARTED",
          projectId: project.id,
          stage: step.label,
          performedBy: currentBadge ?? "system",
          result: "pending",
          metadata: {
            projectId: project.id,
            projectName: project.name,
            pdNumber: project.pdNumber,
            description: step.description,
          },
        });
      }
    });

    // Add BIQ photos activity if photos exist and not already tracked
    const biqPhotosId = `${project.id}-biq-photos`;
    if (photos.length > 0 && !existingIds.has(biqPhotosId)) {
      const newestPhotoTimestamp = photos.reduce((latest, photo) => {
        const current = new Date(photo.uploadedAt).getTime();
        return current > latest ? current : latest;
      }, 0);
      entries.push({
        id: biqPhotosId,
        timestamp:
          newestPhotoTimestamp > 0
            ? new Date(newestPhotoTimestamp).toISOString()
            : new Date().toISOString(),
        action: "SETTINGS_CHANGED",
        projectId: project.id,
        stage: "BIQ",
        performedBy: currentBadge ?? "system",
        result: "success",
        metadata: {
          projectId: project.id,
          projectName: project.name,
          pdNumber: project.pdNumber,
          description: `${photos.length} BIQ photo${photos.length === 1 ? "" : "s"} uploaded.`,
          photos,
        },
      });
    }

    return entries.sort(
      (left, right) =>
        new Date(right.timestamp).getTime() -
        new Date(left.timestamp).getTime(),
    );
  }, [currentBadge, photos, project, realActivities, summary]);

  const isLoading = summaryLoading || activitiesLoading;

  if (isLoading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyTabState
        icon={Activity}
        title="No Activity Yet"
        description="This project will begin showing lifecycle, upload, and BIQ events as soon as work starts."
      />
    );
  }

  return (
    <div className="flex flex-col items-center flex-1 gap-3">
      {!timelineOnly ? (
        <ProjectQuickActions
          className="max-w-md rounded-2xl"
          actions={PROJECT_ACTIVITY_QUICK_ACTIONS}
          eventCount={activities.length}
          onAction={(tabId) => onNavigateToTab?.(tabId)}
        />
      ) : null}

      <ActivityTimeline
        activities={activities}
        loading={isLoading}
        error={null}
        maxItems={80}
        compact={false}
        showStats
        allowFiltering
        allowSearch
        showComments={true}
        showNestedActivities={true}
        currentBadge={currentBadge}
        projectId={project.id}
        onRefresh={handleRefresh}
        className="p-0"
        containerClassName="px-0 py-1"
      />
    </div>
  );
}
