"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/theme/font-weight";
import { useShape } from "@/lib/theme/shape-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: TooltipSide;
  sideOffset?: number;
  delayDuration?: number;
  className?: string;
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type TooltipRootProps = React.ComponentProps<typeof TooltipPrimitive.Root> & {
  delayDuration?: number;
};

// ---------------------------------------------------------------------------
function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const shape = useShape();

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-background text-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) px-2 py-1 text-[12px] shadow-md",
          shape.bg,
          className,
        )}
        style={{
          fontVariationSettings: fontWeights.medium,
          ...style,
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-background z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function Tooltip(props: TooltipProps | TooltipRootProps) {
  if ("content" in props) {
    const {
      content,
      children,
      side = "top",
      sideOffset = 8,
      delayDuration = 200,
      className,
      forceOpen,
      onOpenChange: onOpenChangeProp,
    } = props;
    const [internalOpen, setInternalOpen] = React.useState(false);
    const open = forceOpen !== undefined ? forceOpen : internalOpen;

    return (
      <TooltipProvider delayDuration={delayDuration}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          open={open}
          onOpenChange={(nextOpen) => {
            setInternalOpen(nextOpen);
            onOpenChangeProp?.(nextOpen);
          }}
        >
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side={side} sideOffset={sideOffset} className={className}>
            {content}
          </TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
    );
  }

  const { delayDuration = 200, ...rootProps } = props;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipPrimitive.Root data-slot="tooltip" {...rootProps} />
    </TooltipProvider>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
export type { TooltipProps, TooltipSide };
