"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

interface BannerImage {
  src: string;
  alt: string;
}

interface ProjectsHeroBannerProps {
  images?: BannerImage[];
  intervalMs?: number;
  className?: string;
}

const DEFAULT_IMAGES: BannerImage[] = [
  { src: "/product-types/Centaur 40  - Side.png", alt: "Centaur 40 Side" },
  { src: "/product-types/Mars-C45  - Side.png", alt: "Mars C45 Side" },
  { src: "/product-types/Titan 130 - Side.png", alt: "Titan 130 Side" },
];

export function ProjectsHeroBanner({
  images,
  intervalMs = 15000,
  className,
}: ProjectsHeroBannerProps) {
  const bannerImages = useMemo(
    () => (images && images.length > 0 ? images : DEFAULT_IMAGES),
    [images]
  );
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    if (bannerImages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % bannerImages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [bannerImages.length, intervalMs]);

  return (
    <div className={className ?? "absolute bottom-0 right-0 pointer-events-none overflow-hidden h-full w-3/4"}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={bannerIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={bannerImages[bannerIndex].src}
            alt={bannerImages[bannerIndex].alt}
            fill
            className="object-contain object-bottom-right dark:invert dark:opacity-60"
            unoptimized
            priority={bannerIndex === 0}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
