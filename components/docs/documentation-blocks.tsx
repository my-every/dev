"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const docsFadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const docsStaggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

interface DocumentationHeroProps {
  title: string;
  description: string;
  aside?: ReactNode;
}

export function DocumentationHero({ title, description, aside }: DocumentationHeroProps) {
  return (
    <motion.section variants={docsFadeInUp} className="space-y-6">
      <div className="flex flex-col gap-6 rounded-4xl border border-foreground/10 bg-linear-to-br from-card to-muted/30 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {aside ? <div className="lg:max-w-sm">{aside}</div> : null}
      </div>
    </motion.section>
  );
}

interface DocumentationSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DocumentationSection({
  id,
  title,
  icon: Icon,
  description,
  children,
  className,
}: DocumentationSectionProps) {
  return (
    <motion.section variants={docsFadeInUp} id={id} className={cn("scroll-mt-24 space-y-6", className)}>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {description ? <p className="max-w-3xl leading-relaxed text-muted-foreground">{description}</p> : null}
      {children}
    </motion.section>
  );
}

interface DocumentationFeatureCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  eyebrow?: string;
  className?: string;
}

export function DocumentationFeatureCard({
  title,
  description,
  icon: Icon,
  eyebrow,
  className,
}: DocumentationFeatureCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="space-y-3">
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</div> : null}
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
          <h3 className="font-medium text-foreground">{title}</h3>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

export function DocumentationCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}

interface DocumentationChecklistProps {
  items: string[];
  icon?: "check" | "chevron";
  columns?: 1 | 2 | 3;
}

export function DocumentationChecklist({ items, icon = "check", columns = 1 }: DocumentationChecklistProps) {
  const gridClassName = columns === 1 ? "grid-cols-1" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  const ItemIcon = icon === "check" ? CheckCircle2 : ChevronRight;

  return (
    <div className={cn("grid gap-3", gridClassName)}>
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 rounded-lg border bg-card/60 p-3 text-sm text-muted-foreground">
          <ItemIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

interface DocumentationCodePanelProps {
  filePath?: string;
  title?: string;
  code: string;
  footer?: ReactNode;
}

export function DocumentationCodePanel({ filePath, title, code, footer }: DocumentationCodePanelProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {filePath || title ? (
        <div className="border-b bg-muted/50 px-4 py-2">
          {title ? <div className="text-sm font-medium text-foreground">{title}</div> : null}
          {filePath ? <code className="text-xs text-muted-foreground">{filePath}</code> : null}
        </div>
      ) : null}
      <div className="space-y-4 p-4">
        <div className="overflow-x-auto rounded-lg bg-muted/50 p-4 font-mono text-xs">
          <pre className="text-foreground/80">{code}</pre>
        </div>
        {footer ? footer : null}
      </div>
    </div>
  );
}

interface DocumentationTimelineItem {
  step: string;
  title: string;
  description: string;
}

export function DocumentationTimeline({ items }: { items: DocumentationTimelineItem[] }) {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-border" />
      <div className="space-y-6">
        {items.map((item, index) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            viewport={{ once: true }}
            className="relative pl-10"
          >
            <div className="absolute left-2 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {item.step}
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function DocumentationCallout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground", className)}>{children}</div>;
}

interface DocumentationPreviewExample {
  id: string;
  label: string;
  title: string;
  description: string;
  content: ReactNode;
}

interface DocumentationPreviewTabsProps {
  eyebrow?: string;
  title: string;
  description?: string;
  examples: DocumentationPreviewExample[];
}

export function DocumentationPreviewTabs({
  eyebrow,
  title,
  description,
  examples,
}: DocumentationPreviewTabsProps) {
  const [activeId, setActiveId] = useState(examples[0]?.id ?? "");
  const activeExample = examples.find((example) => example.id === activeId) ?? examples[0];

  if (!activeExample) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-foreground/10 bg-linear-to-br from-card to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="space-y-2">
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</div> : null}
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example.id}
            onClick={() => setActiveId(example.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              example.id === activeExample.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
        <div className="rounded-2xl border border-foreground/10 bg-background/70 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview Mode</div>
          <div className="mt-2 text-base font-semibold text-foreground">{activeExample.title}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeExample.description}</p>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background p-4 shadow-sm">{activeExample.content}</div>
      </div>
    </div>
  );
}