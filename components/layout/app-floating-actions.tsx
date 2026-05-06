"use client";

import {
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  Filter,
  FolderKanban,
  GraduationCap,
  Home,
  Library,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { TourTrigger } from "@/components/tour/tour/index";
import type { TourConfig } from "@/components/tour/tour/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FloatingActionCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  tags?: string[];
  badge?: string;
};

export type FloatingActionSection = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  cards: FloatingActionCard[];
};

type AppFloatingActionsProps = {
  sections?: FloatingActionSection[];
  tourConfig?: TourConfig;
  className?: string;
  extraButtons?: React.ReactNode;
};

const DEFAULT_SECTIONS: FloatingActionSection[] = [
  {
    id: "home",
    label: "380",
    description: "Workspace overview and launch points",
    href: "/380",
    icon: Home,
    cards: [
      {
        id: "home-overview",
        title: "Workspace Home",
        description: "See the current status of projects, parts, and training at a glance.",
        href: "/380",
        tags: ["overview", "workspace"],
        badge: "Home",
      },
      {
        id: "home-projects",
        title: "Projects Hub",
        description: "Jump into active project planning, uploads, and execution.",
        href: "/projects",
        tags: ["projects", "execution"],
      },
      {
        id: "home-board",
        title: "Assignment Board",
        description: "Schedule project work against team competency and stage workspaces.",
        href: "/board",
        tags: ["board", "assignments"],
      },
      {
        id: "home-parts",
        title: "Parts Library",
        description: "Review part categories, readiness, and coverage gaps.",
        href: "/parts",
        tags: ["parts", "library"],
      },
      {
        id: "home-training",
        title: "Training Modules",
        description: "Browse learning content, publish status, and onboarding resources.",
        href: "/training",
        tags: ["training", "learning"],
      },
    ],
  },
  {
    id: "board",
    label: "Board",
    description: "Assignment planning, competency, and stage routing",
    href: "/board",
    icon: BriefcaseBusiness,
    cards: [
      {
        id: "board-assignments",
        title: "Project Board",
        description: "Assign operational sheets to users and review stage competency in one place.",
        href: "/board",
        tags: ["board", "assignments", "scheduling"],
        badge: "Board",
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Project intake, status, and assignments",
    href: "/projects",
    icon: FolderKanban,
    cards: [
      {
        id: "projects-list",
        title: "Project Library",
        description: "Browse active wiring and buildup projects with status and sheet counts.",
        href: "/projects",
        tags: ["all", "recent"],
        badge: "Browse",
      },
      {
        id: "projects-upload",
        title: "Upload New Project",
        description: "Start a new project by importing an Excel workbook into the app.",
        href: "/projects/upload",
        tags: ["create", "upload"],
      },
    ],
  },
  {
    id: "parts",
    label: "Parts",
    description: "Part categories, coverage, and readiness",
    href: "/parts",
    icon: Library,
    cards: [
      {
        id: "parts-library",
        title: "Browse Parts",
        description: "Open the top-level parts library view and review category coverage.",
        href: "/parts",
        tags: ["library", "categories"],
        badge: "Library",
      },
      {
        id: "parts-devices",
        title: "Device Parts",
        description: "Inspect device-driven parts and the modules they support.",
        href: "/parts",
        tags: ["devices", "electrical"],
      },
      {
        id: "parts-tools",
        title: "Tools and Consumables",
        description: "Review tooling, supplies, and supporting hardware readiness.",
        href: "/parts",
        tags: ["tools", "consumables"],
      },
    ],
  },
  {
    id: "training",
    label: "Training",
    description: "Training modules, content quality, and publishing",
    href: "/training",
    icon: GraduationCap,
    cards: [
      {
        id: "training-library",
        title: "Training Library",
        description: "Open all published and draft training content in one place.",
        href: "/training",
        tags: ["library", "content"],
        badge: "Modules",
      },
      {
        id: "training-beginner",
        title: "Onboarding",
        description: "Find onboarding-friendly modules for first-pass instruction.",
        href: "/training",
        tags: ["beginner", "onboarding"],
      },
      {
        id: "training-published",
        title: "Shop Floor Notes",
        description: "Check the training content that is ready to ship to the floor.",
        href: "/training",
        tags: ["published", "ready"],
      },
    ],
  },
];

function resolveSectionFromPath(pathname: string, sections: FloatingActionSection[]) {
  if (pathname.startsWith("/board")) {
    return sections.find((section) => section.id === "board")?.id ?? sections[0]?.id ?? "home";
  }

  if (pathname.startsWith("/projects")) {
    return sections.find((section) => section.id === "projects")?.id ?? sections[0]?.id ?? "home";
  }

  if (pathname.startsWith("/parts")) {
    return sections.find((section) => section.id === "parts")?.id ?? sections[0]?.id ?? "home";
  }

  if (pathname.startsWith("/training")) {
    return sections.find((section) => section.id === "training")?.id ?? sections[0]?.id ?? "home";
  }

  if (pathname.startsWith("/380")) {
    return sections.find((section) => section.id === "home")?.id ?? sections[0]?.id ?? "home";
  }

  return sections[0]?.id ?? "home";
}

export function AppFloatingActions({
  sections = DEFAULT_SECTIONS,
  tourConfig,
  className,
  extraButtons,
}: AppFloatingActionsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(() => resolveSectionFromPath(pathname, sections));
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeSection =
    sections.find((section) => section.id === activeSectionId)
    ?? sections.find((section) => section.id === resolveSectionFromPath(pathname, sections))
    ?? sections[0];

  const availableFilters = useMemo(() => {
    if (!activeSection) {
      return [];
    }

    return Array.from(new Set(activeSection.cards.flatMap((card) => card.tags ?? []))).sort((a, b) => a.localeCompare(b));
  }, [activeSection]);

  const filteredCards = useMemo(() => {
    if (!activeSection) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    return activeSection.cards.filter((card) => {
      const matchesQuery =
        normalizedQuery.length === 0
        || card.title.toLowerCase().includes(normalizedQuery)
        || card.description.toLowerCase().includes(normalizedQuery)
        || (card.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesFilter = activeFilter === "all" || (card.tags ?? []).includes(activeFilter);

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, activeSection, query]);

  if (!activeSection) {
    return null;
  }

  if (!mounted) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/88 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeSection.id;

            return (
              <Button
                key={section.id}
                type="button"
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "h-12 w-12 rounded-full",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                )}
                aria-label={`Open ${section.label} quick actions`}
              >
                <Icon className="size-5" />
              </Button>
            );
          })}
          {tourConfig ? (
            <TourTrigger
              tourConfig={tourConfig}
              showLabel={false}
              size="md"
              variant="ghost"
              className="rounded-full text-muted-foreground"
            />
          ) : null}
          {extraButtons}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/88 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeSection.id;

            return (
              <PopoverTrigger asChild key={section.id}>
                <Button
                  type="button"
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "h-12 w-12 rounded-full",
                    isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                  )}
                  onClick={() => {
                    setActiveSectionId(section.id);
                    setActiveFilter("all");
                    if (!isOpen) {
                      setQuery("");
                    }
                  }}
                  aria-label={`Open ${section.label} quick actions`}
                >
                  <Icon className="size-5" />
                </Button>
              </PopoverTrigger>
            );
          })}

          {tourConfig ? (
            <TourTrigger
              tourConfig={tourConfig}
              showLabel={false}
              size="md"
              variant="ghost"
              className="rounded-full text-muted-foreground"
            />
          ) : null}

          {extraButtons}
        </div>

        <PopoverContent
          side="top"
          align="center"
          sideOffset={18}
          className="w-[min(92vw,34rem)] rounded-3xl border-border/70 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl"
        >
          <div className="border-b border-border/70 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <activeSection.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{activeSection.label}</h3>
                    <p className="text-sm text-muted-foreground">{activeSection.description}</p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  router.push(activeSection.href);
                  setIsOpen(false);
                }}
              >
                Open Page
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${activeSection.label.toLowerCase()} cards...`}
                className="rounded-2xl border-border/70 bg-background pl-9"
                aria-label={`Search ${activeSection.label.toLowerCase()} actions`}
              />
            </div>

            {availableFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </span>
                <Button
                  type="button"
                  variant={activeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setActiveFilter("all")}
                >
                  All
                </Button>
                {availableFilters.map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant={activeFilter === filter ? "default" : "outline"}
                    size="sm"
                    className="rounded-full capitalize"
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter.replace(/-/g, " ")}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5">
            {filteredCards.length > 0 ? (
              <div className="grid gap-3">
                {filteredCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      router.push(card.href);
                      setIsOpen(false);
                    }}
                  >
                    <Card className="rounded-2xl border-border/70 bg-card/70 py-0 transition-colors hover:border-primary/30 hover:bg-accent/50">
                      <CardContent className="flex items-start justify-between gap-4 px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{card.title}</p>
                            {card.badge ? <Badge variant="outline">{card.badge}</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{card.description}</p>
                          {card.tags?.length ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {card.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="capitalize">
                                  {tag.replace(/-/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span className="rounded-full border border-border/70 p-2 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 px-5 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <p className="font-medium text-foreground">No matching quick actions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search or remove the active filter.
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      
    </div>
  );
}
