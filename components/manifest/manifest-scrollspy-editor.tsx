"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrollspySection {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ManifestScrollspyEditorProps {
  sections: ScrollspySection[];
  children: React.ReactNode;
  className?: string;
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  section,
  active,
  onClick,
}: {
  section: ScrollspySection;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
      <span className="truncate">{section.label}</span>
    </button>
  );
}

// ─── Mobile drawer trigger ─────────────────────────────────────────────────────

function MobileNavDrawer({
  sections,
  activeId,
  onSelect,
}: {
  sections: ScrollspySection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = sections.find((s) => s.id === activeId);

  return (
    <div className="relative border-b border-border bg-background px-4 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          {active?.icon ? <span className="shrink-0">{active.icon}</span> : null}
          <span>{active?.label ?? "Navigate…"}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background px-4 py-2 shadow-md">
          <div className="space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  onSelect(section.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  section.id === activeId
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ManifestScrollspyEditor({
  sections,
  children,
  className,
}: ManifestScrollspyEditorProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    if (!contentRef.current) return;

    const sectionEls = sections
      .map((s) => contentRef.current?.querySelector(`[data-section="${s.id}"]`))
      .filter((el): el is Element => el instanceof Element);

    if (sectionEls.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.section;
          if (id) setActiveId(id);
        }
      },
      {
        root: contentRef.current.closest("[data-scroll-root]") ?? null,
        threshold: 0.15,
        rootMargin: "-10% 0px -70% 0px",
      },
    );

    for (const el of sectionEls) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sections]);

  const scrollTo = useCallback((id: string) => {
    setActiveId(id);
    isScrollingRef.current = true;
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  }, []);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {/* Mobile nav */}
      <MobileNavDrawer sections={sections} activeId={activeId} onSelect={scrollTo} />

      {/* Desktop layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar nav */}
        <aside className="hidden w-44 shrink-0 border-r border-border lg:block">
          <ScrollArea className="h-full">
            <nav className="space-y-0.5 p-2">
              {sections.map((section) => (
                <NavItem
                  key={section.id}
                  section={section}
                  active={activeId === section.id}
                  onClick={() => scrollTo(section.id)}
                />
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Scrollable content */}
        <div data-scroll-root className="flex-1 min-w-0 overflow-y-auto" ref={contentRef}>
          <div className="mx-auto max-w-3xl px-5 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section block ─────────────────────────────────────────────────────────────

export function ScrollspySection({
  id,
  title,
  description,
  children,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section data-section={id} className="scroll-mt-4 pb-10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
        {children}
      </div>
    </section>
  );
}

// ─── Field grid ────────────────────────────────────────────────────────────────

export function FieldGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-5",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

// ─── Section divider ───────────────────────────────────────────────────────────

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="flex-1 border-t border-border/60" />
    </div>
  );
}
