"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, RotateCcw, ShieldCheck } from "lucide-react";

import { D380Logo } from "@/components/projects/layout/logo";
import { PinChangeDialog } from "@/components/profile/pin-change-dialog";
import { WorkflowTimeline, type WorkflowTimelineStep } from "@/components/ui/workflow-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

// ── Constants ─────────────────────────────────────────────────────────────────

const D380_WORKFLOW_STEPS: WorkflowTimelineStep[] = [
  {
    number: "01",
    tag: "Projects",
    heading: "Track active builds",
    description: "Manage revisions, monitor execution readiness, and keep every project on schedule.",
    progress: 78,
    progressLabel: "12 active projects",
  },
  {
    number: "02",
    tag: "Schedule",
    heading: "Coordinate shifts",
    description: "Plan slot assignments, review timelines, and keep the team synchronized across priorities.",
    progress: 60,
    progressLabel: "8 shifts scheduled",
  },
  {
    number: "03",
    tag: "Parts",
    heading: "Look up inventory",
    description: "Search part numbers, check stock status, and cross-reference terminal mapping instantly.",
    progress: 45,
    progressLabel: "143 parts indexed",
  },
];

const ALLOWED_DESTINATIONS = new Set(["projects", "schedule", "parts"]);

function normalizeBadge(value: string) {
  return value.trim().replace(/\D/g, "");
}

function normalizePin(value: string) {
  return value.trim().replace(/\D/g, "").slice(0, 4);
}

function resolveDestination(value: string | null) {
  return value && ALLOWED_DESTINATIONS.has(value) ? value : "projects";
}

// ── Main content ──────────────────────────────────────────────────────────────

function AppLauncherContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, signIn, signOut } = useSession();
  const [badge, setBadge] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinResetBadge, setPinResetBadge] = useState<string | null>(null);

  const destination = useMemo(
    () => resolveDestination(searchParams.get("to")),
    [searchParams],
  );
  const activeBadge = user?.badge ?? normalizeBadge(badge);
  const launchHref = activeBadge ? `/${activeBadge}/${destination}` : "/380";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextBadge = normalizeBadge(badge);
    const nextPin = normalizePin(pin);
    if (!nextBadge || nextPin.length !== 4) {
      setError("Enter a badge number and a 4-digit PIN.");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(nextBadge, nextPin);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Sign in failed.");
      return;
    }

    if (result.requiresPinChange) {
      setPinResetBadge(nextBadge);
      return;
    }

    router.push(`/${nextBadge}/${destination}`);
  }

  // ── Sign-in panel content ──────────────────────────────────────────────────

  const signedInPanel = isAuthenticated && activeBadge ? (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-muted p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <span className="text-sm font-bold text-accent-foreground">{user?.initials ?? "?"}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {user?.preferredName || user?.legalName}
            </div>
            <div className="text-xs text-muted-foreground">
              Badge {user?.badge}
              {user?.role ? ` · ${user.role}` : ""}
            </div>
          </div>
        </div>
      </div>

      <Button asChild className="w-full rounded-xl bg-background text-foreground hover:bg-background">
        <Link href={launchHref}>
          <LogIn className="mr-1.5 size-3.5" />
          Continue to {destination}
        </Link>
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full rounded-xl border border-border bg-transparent text-foreground hover:bg-muted"
        onClick={() => {
          void signOut();
          setBadge("");
          setPin("");
        }}
      >
        <RotateCcw className="mr-1.5 size-3.5" />
        Switch user
      </Button>
    </div>
  ) : (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <div className="space-y-1.5">
        <Label htmlFor="badge" className="text-xs text-muted-foreground">Badge Number</Label>
        <Input
          id="badge"
          inputMode="numeric"
          autoComplete="username"
          value={badge}
          placeholder="e.g. 1001"
          onChange={(e) => setBadge(normalizeBadge(e.target.value))}
          className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin" className="text-xs text-muted-foreground">PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          placeholder="4-digit PIN"
          onChange={(e) => setPin(normalizePin(e.target.value))}
          className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={isSubmitting || isLoading}
        className="w-full rounded-xl bg-background text-foreground hover:bg-background"
      >
        {isSubmitting ? "Signing in…" : "Sign in and continue"}
      </Button>
    </form>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* PIN reset required after first login */}
      {pinResetBadge && (
        <PinChangeDialog
          open
          required
          badge={pinResetBadge}
          onOpenChange={(open) => {
            if (!open) {
              setPinResetBadge(null);
              router.push(`/${pinResetBadge}/${destination}`);
            }
          }}
        />
      )}

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden  p-6">
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,_var(--muted)_1px,_transparent_1px),linear-gradient(to_bottom,_var(--muted)_1px,_transparent_1px)] bg-[length:32px_32px]"
          style={{
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
            maskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
          }}
        />
        <div className="relative z-10 w-full max-w-[70vw] min-h-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl/40">
          <div className="flex h-full ">

            {/* Left: feature cards */}
            <div className="flex flex-1 flex-col p-8">

              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <D380Logo size="sm" />
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-foreground">D380</div>
                    <div className="text-[11px] text-muted-foreground">App launcher</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Secure sign-in</span>
                </div>
              </div>

              {/* Page heading */}
              <div className="mb-6">
                <div className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  D380
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  Open the work you need.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Workspace routes are protected. Sign in with your badge and PIN, then navigate to
                  Projects, Schedule, or Parts.
                </p>
              </div>

              {/* Workflow timeline */}
              <WorkflowTimeline steps={D380_WORKFLOW_STEPS} />
            </div>

            {/* Right: sign-in panel */}
            <div className="flex w-90 shrink-0 flex-col border-l border-border bg-secondary">

              {/* Panel header */}
              <div className="shrink-0 px-7 pt-8">
                <div className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {isAuthenticated ? "Authenticated" : "Authentication required"}
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                  {isAuthenticated ? "Signed in" : "Sign in"}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {isAuthenticated && user
                    ? `${user.preferredName || user.legalName} · Badge ${user.badge}`
                    : "Enter your badge number and PIN to access your workspace."}
                </p>
              </div>

              {/* Panel form */}
              <div className="flex-1 overflow-y-auto px-7 py-6">
                {signedInPanel}
              </div>

              {/* Panel footer */}
              <div className="shrink-0 border-t border-border px-7 py-4">
                <Button
                  asChild
                  variant="ghost"
                  className="w-full rounded-xl border border-border bg-transparent text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Link href="/startup">Startup settings</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppLauncherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
          <div className="w-full max-w-275 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="p-8">
              <div className="flex items-center gap-3">
                <D380Logo size="sm" />
                <div>
                  <div className="text-sm font-semibold text-foreground">D380</div>
                  <div className="text-[11px] text-muted-foreground">App launcher</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AppLauncherContent />
    </Suspense>
  );
}
