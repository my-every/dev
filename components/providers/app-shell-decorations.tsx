"use client";

import { usePathname } from "next/navigation";

import { SensitivityFooter } from "@/components/layout/sensitivity-footer";
import { TourOverlay } from "@/components/tour/tour/index";
import { Toaster } from "@/components/ui/toaster";
import { useFeedbackLoader } from "@/contexts/feedback-loader-context";

export function AppShellDecorations({
  showSensitivityFooter,
}: {
  showSensitivityFooter: boolean;
}) {
  const pathname = usePathname();
  const { isLoading } = useFeedbackLoader();
  const isPrintRoute = pathname?.startsWith("/print/") ?? false;

  if (isPrintRoute) {
    return null;
  }

  return (
    <>
      {showSensitivityFooter && !isLoading ? (
        <div className="fixed bottom-0 left-0 z-40 p-5">
          <SensitivityFooter variant="badge" pulseBadge />
        </div>
      ) : null}
      <TourOverlay />
      <Toaster />
    </>
  );
}
