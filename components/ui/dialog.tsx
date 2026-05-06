"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIcon } from "@/lib/theme/icon-context";
import { springs } from "@/lib/theme/springs";
import { useShape } from "@/lib/theme/shape-context";
import { Button } from "@/components/ui/button";

const DialogOpenContext = createContext(false);

function Dialog({
  children,
  open: controlledOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = onOpenChange ?? setUncontrolledOpen;

  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "lg";
  showCloseButton?: boolean;
  mobileSheet?: boolean;
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size = "sm", showCloseButton = true, mobileSheet = false, onInteractOutside, ...props }, ref) => {
    const XIcon = useIcon("x");
    const open = useContext(DialogOpenContext);
    const shape = useShape();
    const [mounted, setMounted] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    useEffect(() => {
      const mediaQuery = window.matchMedia("(max-width: 639px)");
      const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
      updateViewport();
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }, []);

    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);

    const handleExitComplete = () => {
      if (!open) setMounted(false);
    };

    if (!mounted) return null;

    const useMobileSheet = mobileSheet && isMobileViewport;

    return (
      <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={open ? springs.slow : springs.moderate}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          ref={ref}
          asChild
          forceMount
          onInteractOutside={(e) => {
            // The custom Select renders its dropdown via createPortal to document.body,
            // placing it outside the dialog's DOM subtree. Without this guard, Radix
            // fires onInteractOutside when the user clicks a Select option, dismissing
            // the dialog before the option click can register.
            const originalTarget = (e as CustomEvent<{ originalEvent?: Event }>)
              .detail?.originalEvent?.target as Element | null;
            if (originalTarget?.closest('[role="listbox"]')) {
              e.preventDefault();
              return;
            }
            onInteractOutside?.(e);
          }}
          {...props}
        >
          <motion.div
            className={cn(
              "fixed z-50 bg-card border border-border/60 shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] focus:outline-none",
              useMobileSheet
                ? "inset-x-0 bottom-0 top-auto w-full max-w-none rounded-b-none p-0"
                : "left-1/2 top-1/2 w-[calc(100%-2rem)] p-6",
              "bg-card border border-border/60",
              !useMobileSheet && size === "sm" && "max-w-[400px]",
              !useMobileSheet && size === "lg" && "max-w-[540px]",
              shape.container,
              useMobileSheet && "rounded-t-[2rem]",
              className
            )}
            initial={
              useMobileSheet
                ? { opacity: 0, y: "8%" }
                : { opacity: 0, scale: 0.97, x: "-50%", y: "-50%" }
            }
            animate={
              useMobileSheet
                ? { opacity: open ? 1 : 0, y: open ? "0%" : "8%" }
                : { opacity: open ? 1 : 0, scale: open ? 1 : 0.97, x: "-50%", y: "-50%" }
            }
            transition={open ? springs.slow : springs.moderate}
            onAnimationComplete={handleExitComplete}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-3 top-3"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            )}
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 mb-4", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 mt-6", className)}
      {...props}
    />
  );
}

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[16px] text-foreground leading-tight", className)}
    style={{ fontVariationSettings: "'wght' 700" }}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
