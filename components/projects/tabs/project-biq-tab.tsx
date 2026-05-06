"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ClipboardList, Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhotoUploadGallery, type PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import { EmptyTabState, StatItem } from "@/components/projects/tabs/project-tab-helpers";
import type { ProjectTabProps } from "@/components/projects/tabs/project-tab-types";

interface BiqPhotoStateResponse {
  data?: {
    photos?: PhotoGalleryItem[];
  };
}

export function ProjectBiqTab({ project, onProjectRefresh, onNavigateToTab }: ProjectTabProps) {
  const [photos, setPhotos] = useState<PhotoGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/state/biq-photos`, {
        cache: "no-store",
      });

      if (response.status === 404) {
        setPhotos([]);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load BIQ photos");
      }

      const payload = (await response.json()) as BiqPhotoStateResponse;
      setPhotos(Array.isArray(payload.data?.photos) ? payload.data?.photos : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load BIQ photos");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const persistPhotos = useCallback(
    async (nextPhotos: PhotoGalleryItem[]) => {
      setPhotos(nextPhotos);
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/state/biq-photos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdNumber: project.pdNumber,
            projectName: project.name,
            photos: nextPhotos,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save BIQ photos");
        }

        await onProjectRefresh?.();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save BIQ photos");
      } finally {
        setSaving(false);
      }
    },
    [onProjectRefresh, project.id, project.name, project.pdNumber],
  );

  const latestPhotoLabel = useMemo(() => {
    if (photos.length === 0) return "No uploads yet";
    const newestTimestamp = photos.reduce((latest, photo) => {
      const current = new Date(photo.uploadedAt).getTime();
      return current > latest ? current : latest;
    }, 0);
    return newestTimestamp > 0 ? new Date(newestTimestamp).toLocaleDateString() : "No uploads yet";
  }, [photos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading BIQ photos...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <StatItem icon={Camera} label="Photos" value={String(photos.length)} />
        <StatItem icon={ClipboardList} label="Latest Upload" value={latestPhotoLabel} color={project.color} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <Badge variant="dot" className="h-5 px-1.5 text-[10px]">
          BIQ
        </Badge>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Upload inspection and quality photos here. Images save directly into project state so the BIQ role can continue later.
        </p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigateToTab?.("overview")}>
          Open Overview
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">BIQ Photos</h4>
            <p className="mt-1 text-xs text-muted-foreground">Keep quality evidence attached to the project with minimal steps.</p>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <Badge variant="dot" className="h-5 gap-1 px-1.5 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </Badge>
            ) : null}
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void loadPhotos()} aria-label="Refresh BIQ photos">
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}

        {photos.length === 0 ? (
          <EmptyTabState
            icon={Camera}
            title="No BIQ Photos Yet"
            description="Upload photos once inspection begins. The gallery is persisted in project state and can be reused in the aside, a modal, or a full details page."
          />
        ) : null}

        <PhotoUploadGallery
          images={photos}
          onChange={(nextPhotos) => void persistPhotos(nextPhotos)}
          defaultUploadTags={["biq", project.pdNumber]}
          className={photos.length === 0 ? "mt-2" : ""}
        />
      </div>
    </div>
  );
}
