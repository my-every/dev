"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FolderOpen, Loader2, Save } from "lucide-react";

import { D380Logo } from "@/components/projects/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppRuntime } from "@/components/providers/app-runtime-provider";

interface PathSettings {
  legalDrawingsPath: string;
  brandListPath: string;
  shareDirectory: string;
}

const DEFAULT_PATHS: PathSettings = {
  legalDrawingsPath: String.raw`S:\Legal Drawings`,
  brandListPath: String.raw`S:\#Depts\380\6SIGMABRANDLIST\BRANDING\Projects Folder`,
  shareDirectory: "",
};

export function PathSettingsForm() {
  const router = useRouter();
  const { isElectron, chooseWorkspaceRoot, isSelectingWorkspace } = useAppRuntime();

  const [paths, setPaths] = useState<PathSettings>(DEFAULT_PATHS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [pathRes, shareDirRes] = await Promise.all([
          fetch("/api/runtime/path-settings", { cache: "no-store" }),
          fetch("/api/runtime/share-directory", { cache: "no-store" }),
        ]);

        const pathData = pathRes.ok
          ? (await pathRes.json() as { legalDrawingsPath?: string | null; brandListPath?: string | null })
          : {};
        const shareDirData = shareDirRes.ok
          ? (await shareDirRes.json() as { shareDirectory?: string })
          : {};

        setPaths({
          legalDrawingsPath: pathData.legalDrawingsPath || DEFAULT_PATHS.legalDrawingsPath,
          brandListPath: pathData.brandListPath || DEFAULT_PATHS.brandListPath,
          shareDirectory: shareDirData.shareDirectory || DEFAULT_PATHS.shareDirectory,
        });
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const [pathRes, shareDirRes] = await Promise.all([
        fetch("/api/runtime/path-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalDrawingsPath: paths.legalDrawingsPath.trim() || null,
            brandListPath: paths.brandListPath.trim() || null,
          }),
        }),
        fetch("/api/runtime/share-directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareDirectory: paths.shareDirectory.trim() || null }),
        }),
      ]);

      if (!pathRes.ok || !shareDirRes.ok) {
        throw new Error("Failed to save one or more settings.");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const browsePath = useCallback(async (field: keyof PathSettings) => {
    if (!isElectron) return;
    const selected = await chooseWorkspaceRoot();
    if (selected) {
      setPaths((prev) => ({ ...prev, [field]: selected }));
    }
  }, [isElectron, chooseWorkspaceRoot]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <D380Logo size="sm" />
          <div>
            <div className="text-sm font-semibold tracking-tight">D380</div>
            <div className="text-[11px] text-muted-foreground">Path settings</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-lg font-semibold">Path Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure the default source and output folders used by the revision scanner and export tools.
              </p>
            </div>

            <Separator />

            {/* Legal Drawings */}
            <PathField
              id="legal-drawings-path"
              label="Legal Drawings Root"
              description="Root folder containing P#_ProjectName sub-folders with legal drawing files."
              value={paths.legalDrawingsPath}
              onChange={(v) => setPaths((p) => ({ ...p, legalDrawingsPath: v }))}
              onBrowse={isElectron ? () => void browsePath("legalDrawingsPath") : undefined}
              isBrowsing={isSelectingWorkspace}
            />

            <Separator />

            {/* Brand List */}
            <PathField
              id="brand-list-path"
              label="Branding List Root"
              description="Root folder containing brand list spreadsheets used during wire-list review."
              value={paths.brandListPath}
              onChange={(v) => setPaths((p) => ({ ...p, brandListPath: v }))}
              onBrowse={isElectron ? () => void browsePath("brandListPath") : undefined}
              isBrowsing={isSelectingWorkspace}
            />

            <Separator />

            {/* Share / Exports */}
            <PathField
              id="share-directory"
              label="Share / Exports Directory"
              description="Root folder for user data, project files, and generated wire-list exports."
              value={paths.shareDirectory}
              onChange={(v) => setPaths((p) => ({ ...p, shareDirectory: v }))}
              onBrowse={isElectron ? () => void browsePath("shareDirectory") : undefined}
              isBrowsing={isSelectingWorkspace}
            />

            <Separator />

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              type="button"
              className="w-full gap-2"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {isSaving ? "Saving…" : saved ? "Saved" : "Save Settings"}
            </Button>

            {saved && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => router.push("/380/projects")}
              >
                Go to 380 Projects
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PathField({
  id,
  label,
  description,
  value,
  onChange,
  onBrowse,
  isBrowsing,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onBrowse?: () => void;
  isBrowsing?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/absolute/path/to/folder"
          className="flex-1 rounded-xl font-mono text-xs"
        />
        {onBrowse && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={onBrowse}
            disabled={isBrowsing}
          >
            <FolderOpen className="mr-1.5 size-3.5" />
            {isBrowsing ? "…" : "Browse"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
