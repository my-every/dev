"use client";

import { useEffect, useMemo } from "react";

import { useTour, type TourConfig } from "@/components/tour/tour/index";

export function useMultiSheetGuidance(options: {
  isOpen: boolean;
  stateReviewOpen: boolean;
}) {
  const { isOpen, stateReviewOpen } = options;
  const { startTour, hasSeenTour, isActive: isTourActive } = useTour();

  const reviewTourConfig = useMemo<TourConfig>(
    () => ({
      id: "multi-sheet-brand-review-tour",
      showProgress: true,
      allowClose: true,
      allowSkip: true,
      steps: [
        {
          id: "review-state",
          target: "[data-tour='multi-sheet-review-state']",
          position: "bottom",
          content: {
            en: {
              title: "Review State",
              description:
                "Start here for a quick health check. It summarizes mapping quality, saved brand schemas, approvals, and export readiness before you combine anything.",
            },
          },
        },
        {
          id: "review-mode-toggle",
          target: "[data-tour='multi-sheet-mode-toggle']",
          position: "bottom",
          content: {
            en: {
              title: "Brand vs Standard",
              description:
                "Brand mode is the editable source of truth for exported brand lists. Standard mode lets you cross-check the original wire-list print workspace.",
            },
          },
        },
        {
          id: "review-navigator",
          target: "[data-tour='multi-sheet-navigator']",
          position: "left",
          content: {
            en: {
              title: "Sheet Navigator",
              description:
                "Each sheet shows whether it is approved or edited after approval. Use this list to move quickly without losing review context.",
            },
          },
        },
        {
          id: "review-layout",
          target: "[data-tour='multi-sheet-layout-reference']",
          position: "left",
          content: {
            en: {
              title: "Layout Reference",
              description:
                "Open the floating layout preview to verify the current sheet against the mapped layout page. Low-confidence fallback pages are ignored.",
            },
          },
        },
        {
          id: "review-footer-actions",
          target: "[data-tour='multi-sheet-footer-actions']",
          position: "top",
          content: {
            en: {
              title: "Footer Actions",
              description:
                "Select brand rows, adjust lengths, duplicate rows, then approve only after final edits. Any edit after approval will return the sheet to review.",
            },
          },
        },
      ],
    }),
    [],
  );

  useEffect(() => {
    if (!isOpen || isTourActive || stateReviewOpen) {
      return;
    }

    if (!hasSeenTour(reviewTourConfig.id)) {
      const timeoutId = window.setTimeout(() => {
        startTour(reviewTourConfig);
      }, 250);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    hasSeenTour,
    isOpen,
    isTourActive,
    reviewTourConfig,
    startTour,
    stateReviewOpen,
  ]);

  return { reviewTourConfig };
}
