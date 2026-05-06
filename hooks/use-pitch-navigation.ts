"use client";

import { useState, useCallback, useEffect } from "react";

interface UsePitchNavigationOptions {
  totalSlides: number;
  initialSlide?: number;
}

interface UsePitchNavigationReturn {
  currentSlide: number;
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  isFirstSlide: boolean;
  isLastSlide: boolean;
  progress: number;
}

/**
 * Hook for managing pitch presentation slide navigation.
 * Handles keyboard navigation (arrows, space, home/end) and provides
 * slide state with progress calculation.
 */
export function usePitchNavigation({
  totalSlides,
  initialSlide = 0,
}: UsePitchNavigationOptions): UsePitchNavigationReturn {
  const [currentSlide, setCurrentSlide] = useState(initialSlide);

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentSlide(index);
      }
    },
    [totalSlides]
  );

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToFirst = useCallback(() => {
    setCurrentSlide(0);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentSlide(totalSlides - 1);
  }, [totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ": // Spacebar
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prevSlide();
          break;
        case "Home":
          e.preventDefault();
          goToFirst();
          break;
        case "End":
          e.preventDefault();
          goToLast();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, goToFirst, goToLast]);

  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === totalSlides - 1;
  const progress = totalSlides > 1 ? (currentSlide / (totalSlides - 1)) * 100 : 100;

  return {
    currentSlide,
    goToSlide,
    nextSlide,
    prevSlide,
    goToFirst,
    goToLast,
    isFirstSlide,
    isLastSlide,
    progress,
  };
}
