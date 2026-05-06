"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Menu, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface DocumentationNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface DocumentationLinkItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface DocumentationShellProps {
  title: string;
  titleIcon: LucideIcon;
  backHref: string;
  backLabel: string;
  sections: DocumentationNavItem[];
  docLinks?: DocumentationLinkItem[];
  activeSection: string;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onSectionSelect: (id: string) => void;
  children: ReactNode;
}

export function DocumentationShell({
  title,
  titleIcon: TitleIcon,
  backHref,
  backLabel,
  sections,
  docLinks = [],
  activeSection,
  mobileMenuOpen,
  onMobileMenuToggle,
  onSectionSelect,
  children,
}: DocumentationShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
      >
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href={backHref} className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">{backLabel}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <TitleIcon className="h-5 w-5 text-primary" />
            <span className="font-semibold">{title}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMobileMenuToggle}
            aria-label="Toggle documentation navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </motion.header>

      <div className="container mx-auto flex">
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r py-8 pr-6 md:flex"
        >
          <div className="px-4 pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</h3>
          </div>
          <nav className="flex flex-col gap-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionSelect(section.id)}
                  className={cn(
                    "mx-2 flex items-center gap-3 rounded-md px-4 py-2 text-sm transition-all",
                    activeSection === section.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </nav>

          {docLinks.length > 0 ? (
            <div className="mt-8 border-t pt-4">
              <div className="px-4 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documentation</h3>
              </div>
              <nav className="flex flex-col gap-1">
                {docLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="mx-2 flex items-center gap-3 rounded-md px-4 py-2 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </motion.aside>

        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="fixed inset-x-0 top-14 z-40 border-b bg-background md:hidden"
            >
              <nav className="flex flex-col gap-1 p-4">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => onSectionSelect(section.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-4 py-3 text-sm transition-all",
                        activeSection === section.id
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <main className="max-w-4xl flex-1 px-4 py-8 md:px-8 lg:px-12">{children}</main>

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-48 shrink-0 flex-col gap-2 border-l py-8 pl-6 xl:flex"
        >
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Links</h4>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionSelect(section.id)}
              className={cn(
                "text-left text-xs transition-colors",
                activeSection === section.id ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
            </button>
          ))}
        </motion.aside>
      </div>
    </div>
  );
}