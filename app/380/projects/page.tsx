"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderSearch, LogOut, Settings } from "lucide-react";

import { D380Logo } from "@/components/projects/layout/logo";
import { RevisionScanWorkflow } from "@/components/revision/revision-scan-workflow";
import { MultiSheetReviewModal } from "@/components/wire-list/multi-sheet-review-modal";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

interface SavedPaths {
  legalDrawingsPath: string | null;
  brandListPath: string | null;
}

export default function ProjectsRevisionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, signOut } = useSession();
  const [multiSheetReviewOpen, setMultiSheetReviewOpen] = useState(false);
  const [reviewProjectId, setReviewProjectId] = useState<string | null>(null);
  const [savedPaths, setSavedPaths] = useState<SavedPaths>({ legalDrawingsPath: null, brandListPath: null });
  const [savedPathsLoaded, setSavedPathsLoaded] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Redirect unauthenticated users back to the login page
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/380");
    }
  }, [isLoading, isAuthenticated, router]);

  // Load saved source paths from runtime settings
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/runtime/path-settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { legalDrawingsPath?: string | null; brandListPath?: string | null };
        setSavedPaths({
          legalDrawingsPath: data.legalDrawingsPath ?? null,
          brandListPath: data.brandListPath ?? null,
        });
      } catch {
        // Use component defaults
      } finally {
        setSavedPathsLoaded(true);
      }
    };
    void load();
  }, []);

  function handleOpenMultiSheetReview(projectId?: string | null) {
    setReviewProjectId(projectId ?? null);
    setMultiSheetReviewOpen(true);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/380");
  }

  // While checking auth show nothing (avoids layout flash)
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <D380Logo size="sm" />
          <div>
            <div className="text-sm font-semibold tracking-tight">D380</div>
            <div className="text-[11px] text-muted-foreground">Revision review</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {user.initials ?? "?"}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium">{user.preferredName || user.legalName}</div>
                <div className="text-[10px] text-muted-foreground">Badge {user.badge}</div>
              </div>
            </div>
          )}
          <Button asChild type="button" variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Link href="/startup">
              <Settings className="size-3.5" />
              Paths
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-lg font-semibold">Revision Scan</h1>
          <p className="text-sm text-muted-foreground">
            Scan legal and brand source folders, review candidates, and generate wire-list schemas.
          </p>
        </div>

        {savedPathsLoaded && (
          <RevisionScanWorkflow
            renderInline
            defaultLegalSourceRoot={savedPaths.legalDrawingsPath}
            defaultBrandSourceRoot={savedPaths.brandListPath}
            onScanComplete={() => setHasScanned(true)}
            onOpenMultiSheetReview={handleOpenMultiSheetReview}
          />
        )}

        {/* Empty state – shown until the user has run at least one scan+generate */}
        {!hasScanned && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderSearch className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No scan results yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Click <span className="font-medium text-foreground">Check for Revisions</span> above to scan
                the configured source folders and discover revision candidates.
              </p>
            </div>
            {(!savedPaths.legalDrawingsPath && !savedPaths.brandListPath) && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link href="/startup">
                  <Settings className="size-3.5" />
                  Configure source paths first
                </Link>
              </Button>
            )}
          </div>
        )}
      </main>

      {/* ── Multi-sheet review modal ─────────────────────────────────────── */}
      {reviewProjectId && (
        <MultiSheetReviewModal
          projectId={reviewProjectId}
          open={multiSheetReviewOpen}
          onOpenChange={setMultiSheetReviewOpen}
          showTrigger={false}
        />
      )}
    </div>
  );
}
