"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Sparkles, ChevronLeft, ChevronRight, Activity } from "lucide-react";

import {
  CompositeAside,
  CompositeCommandSearchModal,
  CompositeFloatingActions,
  CompositeHeaderSearch,
  CompositeSidePanel,
} from "@/components/layout/layout-composite";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { SessionAvatarMenu } from "@/components/layout/session-avatar-menu";
import { cn } from "@/lib/utils";
import type {
  LayoutPageProps,
  LayoutVariant,
  PageLayoutShellClassNames,
} from "@/components/layout/layout";
import { useLayoutUI } from "@/components/layout/layout-context";
import { Button } from "@/components/ui/button";

const SPRING = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.8,
} as const;

const VARIANT_STYLES: Record<
  LayoutVariant,
  { sidePanel: string; aside: string }
> = {
  default: {
    sidePanel: "lg:w-72 lg:max-w-[300px]",
    aside: "xl:w-80",
  },
  compact: {
    sidePanel: "lg:w-64 lg:max-w-[300px]",
    aside: "xl:w-72",
  },
  wide: {
    sidePanel: "lg:w-[22rem] lg:max-w-[300px]",
    aside: "xl:w-[23rem]",
  },
};

export function PageContent({
  children,
  title,
  subtitle,
  sidePanel,
  showPanel = true,
  aside,
  subHeader,
  headerActions,
  floatingActions,
  commandSearchGroups,
  commandSearchPlaceholder,
  variant = "default",
  showAside = true,
  showBreadcrumbs = false,
  showHeader = true,
  showHeading = true,
  showHeaderTitleInline = false,
  showSubHeader = true,
  showStartUpButton = false,
  showSidePanelToggle,
  showAsideToggle,
  userAvatarMenu,
  showUserAvatarMenu = true,
  classNames,
  asideOpen,
  onAsideOpenChange,
  asideTitle,
  asideHeader,
  asideFooter,
  selectedEntity,
}: LayoutPageProps) {
  const prefersReducedMotion = useReducedMotion();
  const { isSidePanelOpen, closeSidePanel, toggleSidePanel, toggleAside, isAsideOpen } = useLayoutUI();

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 relative flex-1 flex-wrap rounded-xl border border-border lg:flex-nowrap ",
          classNames?.main,
        )}
      >
        {showPanel ? (
          <CompositeSidePanel
            className={cn(
              VARIANT_STYLES[variant].sidePanel,
              classNames?.sidePanel,
            )}
          >
            {sidePanel}
          </CompositeSidePanel>
        ) : null}


        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col mx-auto lg:max-w-none lg:mx-0 ",
            classNames?.mainInner,
          )}
        >
          

          {showHeader ? (
            <motion.header
              className={cn(
                "sticky top-0 px-4 relative z-20 border-b border-border  py-3.5 flex items-center justify-between backdrop-blur sm:px-4 lg:px-3",
                classNames?.header,
              )}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={SPRING}
            >
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-5 -left-3 z-30 rounded-full p-1 border-border bg-card "
                  onClick={toggleSidePanel}
                  aria-label={isSidePanelOpen ? "Close side panel" : "Open side panel"}
                >
                  {isSidePanelOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>

           
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                {showBreadcrumbs ? (
                  <div className="max-w-max  ml-2 ">
                    {showUserAvatarMenu ? (
                      userAvatarMenu ? (
                        <UserAvatarMenu
                          {...userAvatarMenu}
                          interactive={false}
                          showName={true}
                          className={cn(
                            "rounded-full border-0 bg-transparent p-0",
                            userAvatarMenu.className,
                          )}
                        />
                      ) : (
                        <SessionAvatarMenu
                          showName={true}
                          className="rounded-full border-0 bg-transparent p-0"
                        />
                      )
                    ) : null}
                  </div>
                ) : null}

                {showHeaderTitleInline ? (
                  <div className="min-w-0 pl-4 shrink-0 pr-1 sm:pr-2">
                    {showUserAvatarMenu && userAvatarMenu ? (
                      <UserAvatarMenu
                        {...userAvatarMenu}
                        interactive={false}
                        showName={userAvatarMenu.showName ?? true}
                      />
                    ) : (
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">
                          {title}
                        </h2>
                        {subtitle ? (
                          <p className="hidden truncate text-xs text-muted-foreground sm:block">
                            {subtitle}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="relative flex min-h-10 flex-1 items-center justify-center">
                  <div className="w-full max-w-xl">
                    <CompositeHeaderSearch className="mx-auto w-full min-w-0" />
                  </div>
                </div>
              </div>

              {headerActions ? (
                <div className="ml-2 flex shrink-0 items-center justify-end gap-2">
                  {headerActions}
                </div>
              ) : null}

                {(aside || asideTitle) ? (
                  <div className="ml-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleAside}
                      className="relative rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      aria-label={isAsideOpen ? "Close activity panel" : "Open activity panel"}
                    >
                      <Activity className="h-4 w-4" />
                      <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                    </button>
                  </div>
                ) : null}
            </motion.header>
          ) : null}

          {showHeading ? (
            <div className="text-left px-3 sm:px-4 gap-3 flex flex-col lg:px-5">
              <h2 className="truncate text-2xl font-medium tracking-tight text-foreground">
                {title}
              </h2>
              {subtitle ? (
                <p className="truncate text-md text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          ) : null}

          {showSubHeader && subHeader ? (
            <div className="text-lg">{subHeader}</div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
            {children}
          </div>
        </div>
      </div>

      {aside || asideHeader || asideTitle ? (
        <CompositeAside
          className={cn(VARIANT_STYLES[variant].aside, classNames?.aside)}
          open={asideOpen}
          onOpenChange={onAsideOpenChange}
          title={asideTitle ?? selectedEntity?.title ?? undefined}
          header={asideHeader}
          footer={asideFooter}
        >
          {aside}
        </CompositeAside>
      ) : null}

      <CompositeFloatingActions className={classNames?.bottomRail}>
        <div className="flex items-center gap-2">
          {floatingActions}
          {showStartUpButton ? (
            <Link
              href="/startup?revisit=1"
              className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-transparent text-muted-foreground transition-colors duration-200 hover:border-border hover:bg-accent hover:text-accent-foreground"
              aria-label="Open startup selector"
              title="Open startup selector"
            >
              <motion.span
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
              >
                <Sparkles className="h-5 w-5" />
              </motion.span>
            </Link>
          ) : null}
        </div>
      </CompositeFloatingActions>

      <CompositeCommandSearchModal
        groups={commandSearchGroups ?? []}
        placeholder={commandSearchPlaceholder}
      />
    </>
  );
}
