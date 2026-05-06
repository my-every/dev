/**
 * Device Reference Image Carousel
 * Displays one or multiple device reference images with fallback to placeholder.
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DeviceReferenceImage } from "@/lib/device-details/resolve-device-reference-images";

interface DeviceReferenceImageCarouselProps {
  images: DeviceReferenceImage[];
  deviceId?: string;
}

const EXCLUDED_DEVICE_PART_NUMBERS = new Set([
  "2684693-17",
  "5094-tb3xt",
  "2684693-18",
  "5094-of8ihxt",
  "2684693-19",
  "5094-tb3txt",
]);

function normalizePartNumberToken(value: string): string {
  return value.trim().replace(/^"+|"+$/g, "").toLowerCase();
}

function shouldExcludeDeviceReferenceImage(image: DeviceReferenceImage): boolean {
  if (!image.partNumbers || image.partNumbers.length === 0) {
    return false;
  }

  return image.partNumbers.some((partNumber) => {
    const normalized = normalizePartNumberToken(partNumber);

    if (EXCLUDED_DEVICE_PART_NUMBERS.has(normalized)) {
      return true;
    }

    return normalized
      .split(",")
      .map(normalizePartNumberToken)
      .some((token) => EXCLUDED_DEVICE_PART_NUMBERS.has(token));
  });
}

export function DeviceReferenceImageCarousel({
  images,
  deviceId,
}: DeviceReferenceImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState<Set<number>>(new Set());

  const eligibleImages = images.filter((image) => !shouldExcludeDeviceReferenceImage(image));
  const visibleImages = eligibleImages.filter((_, idx) => !imageError.has(idx));

  useEffect(() => {
    if (visibleImages.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= visibleImages.length) {
      setCurrentIndex(visibleImages.length - 1);
    }
  }, [visibleImages.length, currentIndex]);

  if (visibleImages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Reference image unavailable
        </p>
      </div>
    );
  }

  const currentImage = visibleImages[currentIndex];
  const showNavigation = visibleImages.length > 1;

  const handlePrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? visibleImages.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev === visibleImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleImageError = (idx: number) => {
    setImageError((prev) => new Set(prev).add(idx));
  };

  return (
    <div className="space-y-3">
      {/* Image Container */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative aspect-square w-full"
          >
            {/* Eslint disable img-element for backward compat */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.src}
              alt={`${deviceId} reference image - ${currentImage.label || currentImage.source}`}
              className="h-full w-full object-contain p-4"
              onError={() => handleImageError(visibleImages.indexOf(currentImage))}
              crossOrigin="anonymous"
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {showNavigation && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-black/20 text-white hover:bg-black/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-black/20 text-white hover:bg-black/40"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Image Badge */}
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="text-xs">
            {currentIndex + 1} / {visibleImages.length}
          </Badge>
        </div>
      </div>

      {/* Image Details */}
      {currentImage && (
        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {currentImage.label || currentImage.source}
            </span>
            <Badge variant="outline" className="text-xs">
              {currentImage.source === "library"
                ? "Library"
                : currentImage.source === "static-device"
                  ? "Static"
                  : currentImage.source === "family-fallback"
                    ? "Family"
                    : "Placeholder"}
            </Badge>
          </div>

          {currentImage.partNumbers && currentImage.partNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentImage.partNumbers.map((pn) => (
                <span
                  key={pn}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground"
                >
                  {pn}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
