"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Download, Eye, Layers3, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TutorialSlide {
  id: string;
  title: string;
  description: string;
  render: () => ReactNode;
}

interface MultiSheetReviewTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MultiSheetReviewTutorialDialog({
  open,
  onOpenChange,
}: MultiSheetReviewTutorialDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo<TutorialSlide[]>(() => [
    {
      id: "cover",
      title: "Choose Your Review Path",
      description: "The cover page is where you decide whether to import a workbook, open the tutorial, or continue the live review module.",
      render: () => (
        <div className="grid gap-3 rounded-3xl border bg-muted/20 p-5 md:grid-cols-3">
          {[
            { label: "Import Brand List", icon: Download, tone: "border-emerald-200 bg-emerald-50 text-emerald-950" },
            { label: "Open Tutorial", icon: BookOpen, tone: "border-sky-200 bg-sky-50 text-sky-950" },
            { label: "Start / Continue / View", icon: Layers3, tone: "border-violet-200 bg-violet-50 text-violet-950" },
          ].map((card) => (
            <div key={card.label} className={cn("rounded-2xl border p-4", card.tone)}>
              <card.icon className="h-5 w-5" />
              <div className="mt-3 font-semibold">{card.label}</div>
              <p className="mt-1 text-sm opacity-80">Each option routes you into the same review system with the right level of setup.</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "modes",
      title: "Brand And Standard Modes",
      description: "Brand mode is the editable source of truth. Standard mode helps you cross-check against the original wire-list context.",
      render: () => (
        <div className="rounded-3xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Badge>Brand</Badge>
            <Badge variant="secondary">Standard</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-amber-50 p-4">
              <div className="text-sm font-semibold">Editable Brand Schema</div>
              <div className="mt-2 h-32 rounded-xl border border-amber-200 bg-white/70" />
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">Standard Wire List Workspace</div>
              <div className="mt-2 h-32 rounded-xl border border-slate-200 bg-white/70" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "navigator",
      title: "Navigator And Approval",
      description: "The right-side navigator keeps sheet progress visible, while approval locks in the current saved schema hash for each sheet.",
      render: () => (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="rounded-3xl border bg-card p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Navigator</div>
            <div className="mt-3 space-y-2">
              {["PANEL JB70", "PANEL JB71", "RAIL JB72"].map((sheet, index) => (
                <div key={sheet} className={cn("rounded-2xl border px-3 py-2", index === 0 ? "border-primary/40 bg-primary/10" : "bg-muted/20")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{sheet}</span>
                    {index < 2 ? <Badge variant="secondary">Approved</Badge> : <Badge variant="outline">In Review</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <WandSparkles className="h-4 w-4" />
              Review Footer Actions
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary">Approve Sheet</Button>
              <Button size="sm" variant="outline">Unapprove</Button>
              <Button size="sm">Combine &amp; Export</Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "import",
      title: "Import Review Diffs",
      description: "Imported-only rows, removed rows, and length changes are reviewed before they become part of the saved schema.",
      render: () => (
        <div className="rounded-3xl border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-red-950">
                <Eye className="h-4 w-4" />
                Current Only
              </div>
              <p className="mt-2 text-sm text-red-900">Rows missing from the import can be kept or deleted.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-emerald-950">
                <Download className="h-4 w-4" />
                Imported Update
              </div>
              <p className="mt-2 text-sm text-emerald-900">Imported-only rows and imported lengths can be accepted into the schema.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "complete",
      title: "Complete And Export",
      description: "Once every sheet is approved and the combined workbook exists, the module can be reopened in view-only mode for verification and downloads.",
      render: () => (
        <div className="rounded-3xl border bg-card p-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/20 p-4">
            <div>
              <div className="text-sm font-semibold">Combined Export Ready</div>
              <p className="mt-1 text-sm text-muted-foreground">View mode keeps the review history visible while protecting the final state from accidental edits.</p>
            </div>
            <Badge>View Only</Badge>
          </div>
        </div>
      ),
    },
  ], []);

  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{activeSlide.title}</DialogTitle>
          <DialogDescription>{activeSlide.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  index === activeIndex ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground",
                )}
                onClick={() => setActiveIndex(index)}
              >
                {index + 1}. {slide.title}
              </button>
            ))}
          </div>

          {activeSlide.render()}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setActiveIndex((prev) => Math.max(prev - 1, 0))} disabled={activeIndex === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (activeIndex >= slides.length - 1) {
                onOpenChange(false);
                return;
              }
              setActiveIndex((prev) => Math.min(prev + 1, slides.length - 1));
            }}
          >
            {activeIndex >= slides.length - 1 ? "Close" : "Next"}
            {activeIndex < slides.length - 1 ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
