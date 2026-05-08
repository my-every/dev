"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Delete, LogIn, RotateCcw, ShieldCheck } from "lucide-react";

import { D380Logo } from "@/components/projects/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import type { UserRole } from "@/types/d380-user-session";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_DESTINATIONS = new Set(["projects", "schedule", "parts"]);

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ASSEMBLER", label: "Assembler" },
  { value: "TEAM_LEAD", label: "Team Lead" },
  { value: "ENGINEER", label: "Engineer" },
  { value: "MANAGER", label: "Manager" },
  { value: "SUPERVISOR", label: "Supervisor" },
];

function normalizeBadge(value: string) {
  return value.trim().replace(/\D/g, "");
}

function resolveDestination(value: string | null) {
  return value && ALLOWED_DESTINATIONS.has(value) ? value : "projects";
}

// ── PIN Pad ───────────────────────────────────────────────────────────────────

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

function PinPad({ value, onChange, maxLength = 4 }: PinPadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  function handleKey(key: string) {
    if (key === "del") {
      onChange(value.slice(0, -1));
    } else if (key !== "" && value.length < maxLength) {
      onChange(value + key);
    }
  }

  return (
    <div className="space-y-5">
      {/* Dot display */}
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: stable fixed-length array
            key={i}
            className={`h-3 w-3 rounded-full border-2 transition-all duration-150 ${
              i < value.length
                ? "border-foreground bg-foreground scale-110"
                : "border-muted-foreground/40 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key, idx) => {
          if (key === "") {
            // biome-ignore lint/suspicious/noArrayIndexKey: stable layout spacer
            return <div key={idx} />;
          }
          if (key === "del") {
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: stable layout
                key={idx}
                type="button"
                onClick={() => handleKey("del")}
                disabled={value.length === 0}
                className="flex h-14 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-30"
                aria-label="Delete"
              >
                <Delete className="size-4" />
              </button>
            );
          }
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: stable layout
              key={idx}
              type="button"
              onClick={() => handleKey(key)}
              disabled={value.length >= maxLength}
              className="flex h-14 items-center justify-center rounded-xl border border-border bg-card text-base font-semibold text-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-40"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

type Step = "badge" | "profile" | "pin";

interface StepState {
  badge: string;
  isNewUser: boolean;
  legalName: string;
  role: UserRole;
}

// ── Main content ──────────────────────────────────────────────────────────────

function AppLauncherContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, signIn, signOut } = useSession();

  const [step, setStep] = useState<Step>("badge");
  const [state, setState] = useState<StepState>({
    badge: "",
    isNewUser: false,
    legalName: "",
    role: "ASSEMBLER",
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBadgeLookingUp, setIsBadgeLookingUp] = useState(false);

  const destination = useMemo(
    () => resolveDestination(searchParams.get("to")),
    [searchParams],
  );

  const activeBadge = user?.badge ?? state.badge;
  const launchHref = activeBadge ? `/${activeBadge}/${destination}` : "/380";

  // ── Step 1: Badge lookup ───────────────────────────────────────────────────

  async function handleBadgeNext() {
    const badge = normalizeBadge(state.badge);
    if (!badge) {
      setError("Enter a valid badge number.");
      return;
    }

    setError(null);
    setIsBadgeLookingUp(true);

    try {
      const res = await fetch(`/api/session/users?badge=${encodeURIComponent(badge)}`);
      const data = await res.json() as { user: unknown };
      const exists = !!data.user;
      setState(prev => ({ ...prev, badge, isNewUser: !exists }));
      setStep(exists ? "pin" : "profile");
    } catch {
      setError("Could not look up badge. Check your connection.");
    } finally {
      setIsBadgeLookingUp(false);
    }
  }

  // ── Step 2: Profile save (new users) ──────────────────────────────────────

  function handleProfileNext() {
    if (!state.legalName.trim()) {
      setError("Enter your full name.");
      return;
    }
    setError(null);
    setStep("pin");
  }

  // ── Step 3: PIN submit ─────────────────────────────────────────────────────

  async function handlePinSubmit() {
    if (pin.length !== 4) return;
    setError(null);
    setIsSubmitting(true);

    try {
      // Create user first if new
      if (state.isNewUser) {
        const res = await fetch("/api/session/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badge: state.badge,
            legalName: state.legalName,
            role: state.role,
            pin,
          }),
        });

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Failed to create account.");
          setPin("");
          setIsSubmitting(false);
          return;
        }
      }

      // Sign in
      const result = await signIn(state.badge, pin);

      if (!result.success) {
        setError(result.error ?? "Sign in failed.");
        setPin("");
        setIsSubmitting(false);
        return;
      }

      router.push(`/${state.badge}/${destination}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setPin("");
      setIsSubmitting(false);
    }
  }

  // Auto-submit when 4 digits entered
  const didAutoSubmit = useRef(false);
  useEffect(() => {
    if (pin.length === 4 && !isSubmitting && !didAutoSubmit.current) {
      didAutoSubmit.current = true;
      void handlePinSubmit();
    }
    if (pin.length < 4) {
      didAutoSubmit.current = false;
    }
  });

  // ── Signed-in panel (already authenticated) ────────────────────────────────

  if (isAuthenticated && user && activeBadge) {
    return (
      <AuthenticatedPanel
        user={user}
        launchHref={launchHref}
        destination={destination}
        onSwitch={() => {
          void signOut();
          setState(prev => ({ ...prev, badge: "" }));
          setPin("");
          setStep("badge");
        }}
      />
    );
  }

  // ── Stepper panels ─────────────────────────────────────────────────────────

  return (
    <StepperShell step={step} isNewUser={state.isNewUser}>
      {step === "badge" && (
        <BadgeStep
          badge={state.badge}
          onChange={badge => setState(prev => ({ ...prev, badge }))}
          onNext={() => void handleBadgeNext()}
          isLoading={isBadgeLookingUp || isLoading}
          error={error}
        />
      )}
      {step === "profile" && (
        <ProfileStep
          legalName={state.legalName}
          role={state.role}
          onLegalNameChange={legalName => setState(prev => ({ ...prev, legalName }))}
          onRoleChange={role => setState(prev => ({ ...prev, role }))}
          onBack={() => { setStep("badge"); setError(null); }}
          onNext={handleProfileNext}
          error={error}
        />
      )}
      {step === "pin" && (
        <PinStep
          badge={state.badge}
          isNewUser={state.isNewUser}
          pin={pin}
          onPinChange={setPin}
          onBack={() => {
            setPin("");
            setError(null);
            setStep(state.isNewUser ? "profile" : "badge");
          }}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </StepperShell>
  );
}

// ── Panel components ──────────────────────────────────────────────────────────

function AuthenticatedPanel({
  user,
  launchHref,
  destination,
  onSwitch,
}: {
  user: { initials?: string; preferredName?: string; legalName?: string; badge?: string; role?: string };
  launchHref: string;
  destination: string;
  onSwitch: () => void;
}) {
  return (
    <CardShell eyebrow="Authenticated" heading="Signed in" subheading={`${user.preferredName ?? user.legalName} · Badge ${user.badge}`}>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-muted p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
              <span className="text-sm font-bold text-accent-foreground">{user.initials ?? "?"}</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {user.preferredName ?? user.legalName}
              </div>
              <div className="text-xs text-muted-foreground">
                Badge {user.badge}{user.role ? ` · ${user.role}` : ""}
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
          onClick={onSwitch}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          Switch user
        </Button>
      </div>
    </CardShell>
  );
}

function CardShell({
  eyebrow,
  heading,
  subheading,
  children,
}: {
  eyebrow: string;
  heading: string;
  subheading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-size-[32px_32px]"
        style={{
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
          maskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl/40">
        <div className="px-7 pt-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <D380Logo size="sm" />
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">D380</div>
                <div className="text-[11px] text-muted-foreground">App launcher</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              <span>Secure sign-in</span>
            </div>
          </div>
          <div className="mt-6 inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{heading}</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subheading}</p>
        </div>
        <div className="px-7 py-6">{children}</div>
        <div className="border-t border-border px-7 py-4">
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
  );
}

function StepperShell({
  step,
  isNewUser,
  children,
}: {
  step: Step;
  isNewUser: boolean;
  children: React.ReactNode;
}) {
  const steps: Step[] = isNewUser ? ["badge", "profile", "pin"] : ["badge", "pin"];
  const currentIndex = steps.indexOf(step);

  const eyebrow = step === "badge"
    ? "Authentication required"
    : step === "profile"
      ? "New account"
      : isNewUser
        ? "Set your PIN"
        : "Enter your PIN";

  const heading = step === "badge"
    ? "Sign in"
    : step === "profile"
      ? "Create account"
      : "PIN";

  const subheading = step === "badge"
    ? "Enter your badge number to get started."
    : step === "profile"
      ? "This badge isn't registered yet. Enter your details to create an account."
      : isNewUser
        ? "Choose a 4-digit PIN for your new account."
        : "Enter your 4-digit PIN to sign in.";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-size-[32px_32px]"
        style={{
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
          maskImage: "radial-gradient(ellipse 80% 80% at 0% 100%, #000 50%, transparent 90%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl/40">
        <div className="px-7 pt-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <D380Logo size="sm" />
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">D380</div>
                <div className="text-[11px] text-muted-foreground">App launcher</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              <span>Secure sign-in</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="mt-5 flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= currentIndex ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{heading}</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subheading}</p>
        </div>

        <div className="px-7 py-6">{children}</div>

        <div className="border-t border-border px-7 py-4">
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
  );
}

// ── Individual step forms ─────────────────────────────────────────────────────

function BadgeStep({
  badge,
  onChange,
  onNext,
  isLoading,
  error,
}: {
  badge: string;
  onChange: (v: string) => void;
  onNext: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="badge" className="text-xs text-muted-foreground">Badge Number</Label>
        <Input
          id="badge"
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          value={badge}
          placeholder="e.g. 1001"
          onChange={e => onChange(normalizeBadge(e.target.value))}
          onKeyDown={e => { if (e.key === "Enter") onNext(); }}
          className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {error && <ErrorBanner message={error} />}
      <Button
        type="button"
        disabled={isLoading || !badge}
        onClick={onNext}
        className="w-full rounded-xl bg-background text-foreground hover:bg-background"
      >
        {isLoading ? "Looking up…" : "Continue"}
      </Button>
    </div>
  );
}

function ProfileStep({
  legalName,
  role,
  onLegalNameChange,
  onRoleChange,
  onBack,
  onNext,
  error,
}: {
  legalName: string;
  role: UserRole;
  onLegalNameChange: (v: string) => void;
  onRoleChange: (v: UserRole) => void;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName" className="text-xs text-muted-foreground">Full Name</Label>
        <Input
          id="fullName"
          autoFocus
          autoComplete="name"
          value={legalName}
          placeholder="e.g. Jane Smith"
          onChange={e => onLegalNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onNext(); }}
          className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Role</Label>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRoleChange(option.value)}
              className={`flex items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                role === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-muted text-foreground hover:bg-accent"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="rounded-xl border border-border bg-transparent text-foreground hover:bg-muted"
        >
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!legalName.trim()}
          className="flex-1 rounded-xl bg-background text-foreground hover:bg-background"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function PinStep({
  badge,
  isNewUser,
  pin,
  onPinChange,
  onBack,
  isSubmitting,
  error,
}: {
  badge: string;
  isNewUser: boolean;
  pin: string;
  onPinChange: (v: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        Badge <span className="font-semibold text-foreground">{badge}</span>
        {isNewUser ? " · new account" : ""}
      </div>

      {isSubmitting ? (
        <div className="flex h-40 items-center justify-center">
          <div className="text-sm text-muted-foreground">{isNewUser ? "Creating account…" : "Signing in…"}</div>
        </div>
      ) : (
        <PinPad value={pin} onChange={onPinChange} />
      )}

      {error && <ErrorBanner message={error} />}

      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={isSubmitting}
        className="w-full rounded-xl border border-border bg-transparent text-foreground hover:bg-muted"
      >
        <ArrowLeft className="mr-1.5 size-3.5" />
        Back
      </Button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">
      {message}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppLauncherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="p-7">
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
