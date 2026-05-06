"use client";

import React from "react";
import Link from "next/link";
import { useResponsive } from "@/hooks/use-responsive";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: { width: 150, spineTranslation: 122 },
  default: { width: 196, spineTranslation: 168 },
  lg: { width: 300, spineTranslation: 272 },
} as const;

const coverBindGradient =
  "linear-gradient(90deg, hsla(0, 0%, 100%, 0), hsla(0, 0%, 100%, 0) 12%, hsla(0, 0%, 100%, .25) 29.25%, hsla(0, 0%, 100%, 0) 50.5%, hsla(0, 0%, 100%, 0) 75.25%, hsla(0, 0%, 100%, .25) 91%, hsla(0, 0%, 100%, 0)), linear-gradient(90deg, rgba(0, 0, 0, .03), rgba(0, 0, 0, .1) 12%, transparent 30%, rgba(0, 0, 0, .02) 50%, rgba(0, 0, 0, .2) 73.5%, rgba(0, 0, 0, .5) 75.25%, rgba(0, 0, 0, .15) 85.25%, transparent)";

type BookSize = keyof typeof sizeMap;

interface ResponsiveProp<T> {
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
}

interface PerspectiveBookProps {
  size?: BookSize;
  width?: number;
  className?: string;
  coverClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  textured?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  backColor?: string;
  spineColor?: string;
}

interface BookProps {
  title: string;
  variant?: "simple" | "stripe";
  width?: number | ResponsiveProp<number>;
  color?: string;
  textColor?: string;
  backColor?: string;
  spineColor?: string;
  illustration?: React.ReactNode;
  textured?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  ariaLabel?: string;
}

function getFallbackWidth(width: number | ResponsiveProp<number> | undefined) {
  if (typeof width === "number") {
    return width;
  }

  return width?.sm ?? width?.md ?? width?.lg ?? width?.xl ?? sizeMap.default.width;
}

function getSizeFromWidth(width: number): BookSize {
  if (width <= sizeMap.sm.width) {
    return "sm";
  }

  if (width >= sizeMap.lg.width) {
    return "lg";
  }

  return "default";
}

function getSpineTranslation(size: BookSize, width: number) {
  if (width === sizeMap[size].width) {
    return sizeMap[size].spineTranslation;
  }

  return Math.max(0, width - 28);
}

export function PerspectiveBook({
  size = "default",
  width,
  className,
  coverClassName,
  bodyClassName,
  children,
  textured = false,
  interactive = false,
  disabled = false,
  color,
  textColor = "var(--ds-gray-1000)",
  backColor,
  spineColor,
}: PerspectiveBookProps) {
  const resolvedWidth = width ?? sizeMap[size].width;
  const spineTranslation = getSpineTranslation(size, resolvedWidth);
  const resolvedCoverColor = color ?? "linear-gradient(180deg, #f5f5f5 0%, #e5e5e5 100%)";
  const resolvedBackColor = backColor ?? resolvedCoverColor;
  const resolvedSpineColor = spineColor ?? "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)";
  const depth = 25;

  return (
    <div
      className={cn(
        "relative inline-block shrink-0",
        interactive && !disabled && "group",
        disabled && "opacity-60",
        className,
      )}
      style={{ perspective: "900px", width: resolvedWidth, maxWidth: "100%" }}
    >
      <div
        className={cn(
          "relative aspect-[49/60] [transform-style:preserve-3d] transition-transform duration-300 ease-out",
          interactive &&
          !disabled &&
          "group-hover:[transform:rotateY(-20deg)] group-hover:scale-[1.066] group-hover:-translate-x-1",
        )}
        style={{ width: resolvedWidth, borderRadius: "6px 4px 4px 6px" }}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 size-full overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10 after:shadow-[0_1.8px_3.6px_#0000000d,_0_10.8px_21.6px_#00000014,_inset_0_-.9px_#0000001a,_inset_0_1.8px_1.8px_#ffffff1a,_inset_3.6px_0_3.6px_#0000001a]",
            coverClassName,
          )}
          style={{
            transform: `translateZ(${depth}px)`,
            borderRadius: "6px 4px 4px 6px",
            background: resolvedCoverColor,
            color: textColor,
            containerType: "inline-size",
          }}
        >
          <div className="absolute left-0 top-0 h-full opacity-40" style={{ minWidth: "8.2%", background: coverBindGradient }} />
          {textured && (
            <div
              className="pointer-events-none absolute inset-0 rotate-180 bg-[url('/patterns/image.png')] bg-cover bg-no-repeat opacity-40 mix-blend-hard-light"
              style={{ borderRadius: "6px 4px 4px 6px" }}
            />
          )}
          <div className={cn("relative flex h-full flex-col p-[12%]", bodyClassName)} style={{ containerType: "inline-size" }}>
            {children}
          </div>
        </div>

        <div
          className="absolute left-0"
          style={{
            top: 3,
            bottom: 3,
            width: 48,
            background: resolvedSpineColor,
            transform: `translateX(${spineTranslation}px) rotateY(90deg)`,
          }}
        />

        <div
          className="absolute inset-y-0 left-0 size-full overflow-hidden"
          style={{
            transform: `translateZ(-${depth}px)`,
            borderRadius: "6px 4px 4px 6px",
            background: resolvedBackColor,
          }}
        />
      </div>
    </div>
  );
}

export function Book({
  title,
  variant = "stripe",
  width = sizeMap.default.width,
  color,
  textColor = "var(--ds-gray-1000)",
  backColor,
  spineColor,
  illustration,
  textured = false,
  href,
  onClick,
  disabled = false,
  className,
  titleClassName,
  bodyClassName,
  badge,
  subtitle,
  footer,
  ariaLabel,
}: BookProps) {
  const responsiveWidth = useResponsive(width);
  const fallbackWidth = getFallbackWidth(width);
  const resolvedWidth = responsiveWidth ?? fallbackWidth;
  const resolvedSize = getSizeFromWidth(resolvedWidth);
  const isInteractive = !disabled && Boolean(href || onClick);

  const content = (
    <PerspectiveBook
      size={resolvedSize}
      width={resolvedWidth}
      className={className}
      bodyClassName={bodyClassName}
      textured={textured}
      interactive={isInteractive}
      disabled={disabled}
      color={color}
      textColor={textColor}
      backColor={backColor}
      spineColor={spineColor}
    >
      <div className="relative flex h-full flex-col">
        {badge && <div className="absolute right-0 top-0 z-10">{badge}</div>}

        {illustration && (
          <div
            className={cn(
              "mb-[8%] overflow-hidden rounded-[10%]",
              variant === "stripe" ? "min-h-[28cqw]" : "min-h-[22cqw]",
            )}
          >
            {illustration}
          </div>
        )}

        <div className="flex flex-1 flex-col">
          <div className="space-y-[2.4cqw] pr-[18%]">
            <span
              className={cn(
                "block select-none text-balance font-bold leading-[1.02] tracking-[-0.04em]",
                variant === "simple" ? "text-[9.8cqw]" : "text-[9.2cqw]",
                titleClassName,
              )}
              style={{ color: textColor }}
            >
              {title}
            </span>

            {subtitle && (
              <div
                className="select-none text-[4.2cqw] font-medium uppercase tracking-[0.12em] opacity-70"
                style={{ color: textColor }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {footer ? <div className="mt-auto pt-[6%]">{footer}</div> : null}
        </div>
      </div>
    </PerspectiveBook>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? title}
        className="inline-block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? title}
        className="rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-not-allowed"
      >
        {content}
      </button>
    );
  }

  return content;
}

interface BookHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function BookHeader({ children, className }: BookHeaderProps) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}

interface BookTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function BookTitle({ children, className }: BookTitleProps) {
  return <h1 className={cn("mb-1 mt-3 select-none text-balance font-bold", className)}>{children}</h1>;
}

interface BookDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function BookDescription({ children, className }: BookDescriptionProps) {
  return <p className={cn("select-none text-xs/relaxed opacity-80", className)}>{children}</p>;
}

export default PerspectiveBook;