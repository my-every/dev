"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Expand, ImageIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  getClientDevicePropertyRecord,
  getClientDevicePropertyRecords,
} from "@/lib/device/device-property-library-client";
import type { DevicePropertyField, DevicePropertyRecord } from "@/lib/device/device-property-types";

type DevicePropertyType = DevicePropertyField | "summary" | "referenceImageCarousel";

export interface DevicePropertyProps {
  type: DevicePropertyType;
  pn: string | string[];
  preferredDescription?: string;
  className?: string;
  fallback?: React.ReactNode;
  imageClassName?: string;
  iconClassName?: string;
  showLabel?: boolean;
}

function getPreferredField(type: DevicePropertyType): DevicePropertyField | undefined {
  if (type === "summary" || type === "referenceImageCarousel") {
    return "referenceImage";
  }

  return type;
}

function normalizePartNumbers(pn: string | string[]): string[] {
  if (Array.isArray(pn)) {
    return Array.from(new Set(pn.map((value) => value.trim()).filter(Boolean)));
  }

  return Array.from(
    new Set(
      pn
        .split(/[\n,;]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function getFallbackContent(pn: string | string[], fallback?: React.ReactNode) {
  if (fallback !== undefined) {
    return fallback;
  }

  const label = Array.isArray(pn) ? pn.join(", ") : pn;

  return (
    <span className="text-sm text-muted-foreground">
      No device property found for {label}
    </span>
  );
}

function renderTextValue(value: string, className?: string) {
  return <span className={className}>{value}</span>;
}

interface ReferenceImageThumbnailProps {
  partNumber: string;
  src: string;
  className?: string;
  imageClassName?: string;
}

function ReferenceImageThumbnail({
  partNumber,
  src,
  className,
  imageClassName,
}: ReferenceImageThumbnailProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "group relative block overflow-hidden rounded-lg border bg-white transition-colors  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={`Open reference image for ${partNumber}`}
      >
        <Image
          src={src}
          alt={`${partNumber} reference image`}
          fill
          sizes="(max-width: 768px) 92vw, 50vw"
          className={cn("object-contain p-3", imageClassName)}
          unoptimized
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-end p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="rounded-md bg-white/30 backdrop-blur-2xl p-1 text-foreground">
            <Expand className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference Image</p>
                  <p className="truncate font-mono text-sm font-medium">{partNumber}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close reference image modal"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative flex h-[min(80vh,720px)] items-center justify-center bg-muted/20 p-6">
                <Image
                  src={src}
                  alt={`${partNumber} reference image`}
                  fill
                  className="object-contain p-6"
                  unoptimized
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function renderSummary(record: DevicePropertyRecord, props: DevicePropertyProps) {
  const { className, imageClassName, iconClassName, showLabel = true } = props;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3", className)}>
      {record.icon ? (
        <div className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-muted/50">
          <Image
            src={record.icon}
            alt={`${record.partNumber} icon`}
            fill
            className={cn("object-contain p-1", iconClassName)}
            unoptimized
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-white px-2 py-0.5 text-sm font-medium">{record.partNumber}</code>
          {record.category ? <Badge variant="secondary">{record.category}</Badge> : null}
        </div>
        {showLabel ? <p className="text-sm text-foreground">{record.description}</p> : null}
        {record.referenceImage ? (
          <ReferenceImageThumbnail
            partNumber={record.partNumber}
            src={record.referenceImage}
            className={cn("mt-2 h-28 w-full max-w-xs", imageClassName)}
          />
        ) : null}
      </div>
    </div>
  );
}

interface ReferenceImageCarouselVariantProps {
  records: DevicePropertyRecord[];
  partNumbers: string[];
  preferredDescription?: string;
  className?: string;
  imageClassName?: string;
  fallback?: React.ReactNode;
}

function normalizeReferenceText(value: string): string {
  return value.trim().toUpperCase();
}

function extractCatalogHints(value?: string): string[] {
  if (!value) {
    return [];
  }

  const matches = normalizeReferenceText(value).match(/\b\d{4}-[A-Z0-9]+\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function isLikelyTerminalBaseRecord(record: DevicePropertyRecord): boolean {
  const haystack = `${record.partNumber} ${record.description}`.toUpperCase();

  return [
    'TERMINAL BASE',
    'REMOVABLE TERMINAL',
    'TB3',
    'TB3XT',
    'TB3TXT',
    'RTB',
  ].some(token => haystack.includes(token));
}

function rankReferenceImageRecord(record: DevicePropertyRecord, preferredDescription?: string): number {
  const normalizedDescription = normalizeReferenceText(record.description);
  const normalizedPartNumber = normalizeReferenceText(record.partNumber);
  const catalogHints = extractCatalogHints(preferredDescription);

  let score = 0;

  if (catalogHints.some(hint => normalizedDescription.includes(hint) || normalizedPartNumber.includes(hint))) {
    score += 100;
  }

  if (preferredDescription) {
    const firstPhrase = normalizeReferenceText(preferredDescription).split(',')[0] ?? '';
    if (firstPhrase && normalizedDescription.includes(firstPhrase)) {
      score += 40;
    }
  }

  if (record.referenceImage) {
    score += 10;
  }

  if (isLikelyTerminalBaseRecord(record)) {
    score -= 50;
  }

  return score;
}

function sortReferenceImageRecords(records: DevicePropertyRecord[], preferredDescription?: string): DevicePropertyRecord[] {
  return [...records].sort((left, right) => {
    const leftScore = rankReferenceImageRecord(left, preferredDescription);
    const rightScore = rankReferenceImageRecord(right, preferredDescription);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.partNumber.localeCompare(right.partNumber);
  });
}

function renderReferenceImageFallback(partNumber: string) {
  return (
    <div className="flex h-full min-h-48 w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
      <div className="space-y-2 text-muted-foreground">
        <ImageIcon className="mx-auto h-8 w-8" />
        <p className="text-sm">No reference image for {partNumber}</p>
      </div>
    </div>
  );
}

function ReferenceImageCarouselVariant({
  records,
  partNumbers,
  preferredDescription,
  className,
  imageClassName,
  fallback,
}: ReferenceImageCarouselVariantProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const sortedRecords = useMemo(
    () => sortReferenceImageRecords(records, preferredDescription),
    [records, preferredDescription],
  );

  useEffect(() => {
    if (!api) {
      return;
    }

    const syncIndex = () => setActiveIndex(api.selectedScrollSnap());
    syncIndex();
    api.on("select", syncIndex);
    api.on("reInit", syncIndex);

    return () => {
      api.off("select", syncIndex);
      api.off("reInit", syncIndex);
    };
  }, [api]);

  if (sortedRecords.length === 0) {
    return getFallbackContent(partNumbers, fallback);
  }

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col gap-3", className)}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: sortedRecords.length > 1 }}
        className="w-full"
      >
        <CarouselContent className="ml-0">
          {sortedRecords.map((record) => (
            <CarouselItem key={`${record.partNumber}-${record.referenceImage || "missing"}`} className="basis-full pl-0">
              <div className="flex h-full min-h-0 w-full flex-col gap-3">
                <div className="relative flex h-81.25 max-h-81.25 w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
                  {record.referenceImage ? (
                    <ReferenceImageThumbnail
                      partNumber={record.partNumber}
                      src={record.referenceImage}
                      className="h-full max-h-81.25 w-full border-0 bg-transparent"
                      imageClassName={cn("rounded-xl p-4", imageClassName)}
                    />
                  ) : (
                    renderReferenceImageFallback(record.partNumber)
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {record.partNumber}
                    </Badge>
                    {record.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{record.description}</p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activeIndex + 1} / {sortedRecords.length}
                  </Badge>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {sortedRecords.length > 1 ? (
          <>
            <CarouselPrevious className="left-3 top-[calc(50%-1.5rem)] translate-y-0 bg-background/95" />
            <CarouselNext className="right-3 top-[calc(50%-1.5rem)] translate-y-0 bg-background/95" />
          </>
        ) : null}
      </Carousel>

      {sortedRecords.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {sortedRecords.map((record, index) => (
            <button
              key={`dot-${record.partNumber}-${index}`}
              type="button"
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "h-2.5 rounded-full transition-all",
                activeIndex === index ? "w-8 bg-foreground" : "w-2.5 bg-muted-foreground/30",
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DeviceProperty({
  type,
  pn,
  preferredDescription,
  className,
  fallback,
  imageClassName,
  iconClassName,
  showLabel = true,
}: DevicePropertyProps) {
  const partNumbers = useMemo(() => normalizePartNumbers(pn), [pn]);
  const primaryPartNumber = partNumbers[0] ?? "";
  const [record, setRecord] = useState<DevicePropertyRecord | null | undefined>(undefined);
  const [records, setRecords] = useState<DevicePropertyRecord[] | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;

    if (type === "referenceImageCarousel") {
      setRecord(undefined);

      getClientDevicePropertyRecords(partNumbers, getPreferredField(type))
        .then((nextRecords) => {
          if (!isCancelled) {
            setRecords(nextRecords);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setRecords([]);
          }
        });

      return () => {
        isCancelled = true;
      };
    }

    if (!primaryPartNumber) {
      setRecords(undefined);
      setRecord(null);

      return () => {
        isCancelled = true;
      };
    }

    setRecords(undefined);
    getClientDevicePropertyRecord(primaryPartNumber, getPreferredField(type))
      .then(nextRecord => {
        if (!isCancelled) {
          setRecord(nextRecord);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setRecord(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [partNumbers, primaryPartNumber, type]);

  if (type === "referenceImageCarousel") {
    if (records === undefined) {
      return null;
    }

    return (
      <ReferenceImageCarouselVariant
        records={records}
        partNumbers={partNumbers}
        preferredDescription={preferredDescription}
        className={className}
        imageClassName={imageClassName}
        fallback={fallback}
      />
    );
  }

  if (record === undefined) {
    return null;
  }

  if (!record) {
    return getFallbackContent(pn, fallback);
  }

  if (type === "summary") {
    return renderSummary(record, { type, pn, className, fallback, imageClassName, iconClassName, showLabel });
  }

  switch (type) {
    case "partNumber":
      return <code className={cn("rounded bg-muted px-2 py-0.5 text-sm font-medium", className)}>{record.partNumber}</code>;
    case "description":
      return renderTextValue(record.description, cn("text-sm text-foreground", className));
    case "category":
      return record.category
        ? <Badge className={className} variant="secondary">{record.category}</Badge>
        : getFallbackContent(pn, fallback);
    case "referenceImage":
      return record.referenceImage ? (
        <ReferenceImageThumbnail
          partNumber={record.partNumber}
          src={record.referenceImage}
          className={cn("h-28 w-28", className)}
          imageClassName={imageClassName}
        />
      ) : getFallbackContent(pn, fallback);
    case "icon":
      return record.icon ? (
        <div className={cn("relative h-6 w-6 overflow-hidden", className)}>
          <Image
            src={record.icon}
            alt={`${record.partNumber} icon`}
            fill
            className={cn("object-contain", iconClassName)}
            unoptimized
          />
        </div>
      ) : getFallbackContent(pn, fallback);
    default:
      return showLabel
        ? renderTextValue(record.description, cn("text-sm text-foreground", className))
        : null;
  }
}