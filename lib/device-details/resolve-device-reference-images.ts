/**
 * Reference image resolution pipeline for Device Details.
 * Implements deterministic fallback strategy with multiple image sources.
 */

import type { DeviceDetails } from "./types";
import {
  normalizePartNumberKey,
  getStaticDeviceImagePath,
  buildStaticDeviceImageCandidates,
} from "./normalize-part-number-key";

/**
 * Metadata for a resolved device reference image.
 */
export interface DeviceReferenceImage {
  src: string;
  source: "library" | "static-device" | "family-fallback" | "placeholder";
  partNumbers?: string[];
  label?: string;
}

/**
 * Resolve reference images for a device with deterministic fallback strategy.
 *
 * Resolution order:
 * 1. Explicit referenceImage from enriched data (library)
 * 2. Static device images from /public/devices (based on part numbers)
 * 3. Family/prefix fallback (reserved for future use)
 * 4. Generic placeholder
 *
 * Returns array of image candidates to try, in priority order.
 */
export function resolveDeviceReferenceImages(
  deviceDetails: DeviceDetails | null
): DeviceReferenceImage[] {
  const images: DeviceReferenceImage[] = [];

  if (!deviceDetails || !deviceDetails.partInfo) {
    // No device data - use placeholder
    images.push({
      src: "/placeholder.svg",
      source: "placeholder",
      label: "Reference image unavailable",
    });
    return images;
  }

  const { partInfo } = deviceDetails;
  const partNumbers = partInfo.partNumbers || [];

  // Priority 1: explicit library reference image
  // (if added to enriched metadata in future)
  // if (deviceDetails.referenceImage) {
  //   images.push({
  //     src: deviceDetails.referenceImage,
  //     source: "library",
  //     partNumbers,
  //     label: "Library Image",
  //   });
  // }

  // Priority 2: static device images from /public/devices
  const staticCandidates = buildStaticDeviceImageCandidates(partNumbers);
  for (const candidate of staticCandidates) {
    images.push({
      src: getStaticDeviceImagePath(candidate),
      source: "static-device",
      partNumbers: [candidate],
      label: candidate,
    });
  }

  // Priority 3: family/prefix fallback (reserved for future use)
  // Could add device-family-specific fallback images here
  // if (deviceDetails.parsedId?.baseId) {
  //   const prefix = deviceDetails.parsedId.baseId.slice(0, 2).toUpperCase();
  //   images.push({
  //     src: `/devices/family-${prefix}-placeholder.png`,
  //     source: "family-fallback",
  //   });
  // }

  // Priority 4: final generic placeholder (always included)
  if (images.length === 0 || !images.some(img => img.source === "placeholder")) {
    images.push({
      src: "/placeholder.svg",
      source: "placeholder",
      label: "Reference image unavailable",
    });
  }

  return images;
}

/**
 * Get the primary (first) reference image from resolved candidates.
 * Useful when carousel is not needed.
 */
export function getPrimaryDeviceReferenceImage(
  deviceDetails: DeviceDetails | null
): DeviceReferenceImage | null {
  const images = resolveDeviceReferenceImages(deviceDetails);
  return images.length > 0 ? images[0] : null;
}

/**
 * Filter reference images by source type.
 * Useful for separating library vs static vs placeholder images.
 */
export function filterReferenceImagesBySource(
  images: DeviceReferenceImage[],
  source: DeviceReferenceImage["source"]
): DeviceReferenceImage[] {
  return images.filter(img => img.source === source);
}
