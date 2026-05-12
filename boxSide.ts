/**
 * Box Side Installation Order (Door In, Top to Bottom, Left to Right):
 * 1. Left/Right Door (first - entry point)
 * 2. Left Side
 * 3. Top Back Side
 * 4. Left Back Side
 * 5. Right Back Side
 * 6. Right Side (last)
 * 
 * Default settings logic: Enable settings for connections to box sides that come
 * AFTER in installation order, disable for sides that come BEFORE.
 * Special case: Left Side -> Door has cross_wire=true only.
 */

export interface ExternalLocationDefaultSettings {
  wire_list: boolean;
  brand_list: boolean;
  cross_wire: boolean;
}

export interface BoxSideExternalLocationConfig {
  [targetBoxSide: string]: ExternalLocationDefaultSettings;
}

export interface BoxSideConfigEntry {
  name: string;
  description: string;
  order: number; // Installation order (lower = earlier)
  externalLocations: Record<string, boolean>; // Legacy compatibility
  defaultSettings: BoxSideExternalLocationConfig; // New: per-target-side settings
}

export const BoxSideConfig: Record<string, BoxSideConfigEntry> = {
  leftDoor: {
    name: 'Left Door',
    description: 'The left door of the box.',
    order: 1,
    externalLocations: {
      leftSide: true,
      rightBackSide: true,
      backSide: true,
      topBackSide: true,
      rightSide: true,
      rightDoor: true,
      leftBackSide: true,
    },
    // Door: All downstream connections enabled (entry point)
    defaultSettings: {
      leftSide: { wire_list: true, brand_list: true, cross_wire: true },
      topBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      leftBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      backSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightDoor: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  rightDoor: {
    name: 'Right Door',
    description: 'The right door of the box.',
    order: 1,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      rightBackSide: true,
      topBackSide: true,
      rightSide: true,
      leftBackSide: true,
      backSide: true,
    },
    // Door: All downstream connections enabled (entry point)
    defaultSettings: {
      leftDoor: { wire_list: true, brand_list: true, cross_wire: true },
      leftSide: { wire_list: true, brand_list: true, cross_wire: true },
      topBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      leftBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      backSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  leftSide: {
    name: 'Left Side',
    description: 'The left side of the box.',
    order: 2,
    externalLocations: {
      leftDoor: true,
      rightBackSide: true,
      backSide: true,
      topBackSide: true,
      rightSide: true,
      rightDoor: true,
      leftBackSide: true,
    },
    // Left Side: cross_wire only to Door, all true to downstream
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: true },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: true },
      topBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      leftBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      backSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  topBackSide: {
    name: 'Top Back Side',
    description: 'The top back side of the box.',
    order: 3,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      rightBackSide: true,
      leftBackSide: true,
      rightSide: true,
      rightDoor: true,
      backSide: true,
    },
    // Top Back: Disabled upstream (Door, Left Side), enabled downstream
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: false },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: false },
      leftSide: { wire_list: false, brand_list: false, cross_wire: false },
      leftBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      backSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  leftBackSide: {
    name: 'Left Back Side',
    description: 'The left back side of the box.',
    order: 4,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      rightBackSide: true,
      backSide: true,
      topBackSide: true,
      rightSide: true,
      rightDoor: true,
    },
    // Left Back: Disabled upstream, enabled to Right Back and Right Side
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: false },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: false },
      leftSide: { wire_list: false, brand_list: false, cross_wire: false },
      topBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      rightBackSide: { wire_list: true, brand_list: true, cross_wire: true },
      backSide: { wire_list: true, brand_list: true, cross_wire: true },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  rightBackSide: {
    name: 'Right Back Side',
    description: 'The right back side of the box.',
    order: 5,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      topBackSide: true,
      rightSide: true,
      rightDoor: true,
      leftBackSide: true,
      backSide: true,
    },
    // Right Back: Disabled upstream, enabled only to Right Side
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: false },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: false },
      leftSide: { wire_list: false, brand_list: false, cross_wire: false },
      topBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      leftBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      backSide: { wire_list: false, brand_list: false, cross_wire: false },
      rightSide: { wire_list: true, brand_list: true, cross_wire: true },
    },
  },
  rightSide: {
    name: 'Right Side',
    description: 'The right side of the box.',
    order: 6,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      rightBackSide: true,
      backSide: true,
      topBackSide: true,
      rightDoor: true,
      leftBackSide: true,
    },
    // Right Side: All disabled (endpoint - last in installation order)
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: false },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: false },
      leftSide: { wire_list: false, brand_list: false, cross_wire: false },
      topBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      leftBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      rightBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      backSide: { wire_list: false, brand_list: false, cross_wire: false },
    },
  },
  backSide: {
    name: 'Back Side',
    description: 'The back side of the box (generic)',
    order: 7,
    externalLocations: {
      leftDoor: true,
      leftSide: true,
      rightBackSide: true,
      topBackSide: true,
      rightSide: true,
      leftBackSide: true,
      rightDoor: true,
    },
    // Generic Backside: All disabled (no prefix variant)
    defaultSettings: {
      leftDoor: { wire_list: false, brand_list: false, cross_wire: false },
      rightDoor: { wire_list: false, brand_list: false, cross_wire: false },
      leftSide: { wire_list: false, brand_list: false, cross_wire: false },
      topBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      leftBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      rightBackSide: { wire_list: false, brand_list: false, cross_wire: false },
      rightSide: { wire_list: false, brand_list: false, cross_wire: false },
    },
  },
} as const;

export type BoxSideName = keyof typeof BoxSideConfig;

/**
 * Get the default visibility settings for an assignment's external location
 * based on the assignment's box side and the target location's box side.
 */
export function getDefaultExternalLocationSettings(
  assignmentBoxSide: string | undefined,
  targetLocationBoxSide: string | undefined,
): ExternalLocationDefaultSettings {
  const fallback: ExternalLocationDefaultSettings = {
    wire_list: true,
    brand_list: true,
    cross_wire: true,
  };

  if (!assignmentBoxSide || !targetLocationBoxSide) {
    return fallback;
  }

  const normalizedAssignment = assignmentBoxSide.toLowerCase().replace(/[\s_-]+/g, '');
  const normalizedTarget = targetLocationBoxSide.toLowerCase().replace(/[\s_-]+/g, '');

  // Find matching box side config
  const configEntry = Object.entries(BoxSideConfig).find(([key]) => {
    const normalizedKey = key.toLowerCase();
    return normalizedAssignment === normalizedKey || 
           normalizedAssignment.includes(normalizedKey) ||
           normalizedKey.includes(normalizedAssignment);
  });

  if (!configEntry) {
    return fallback;
  }

  const [, config] = configEntry;
  
  // Find matching target in defaultSettings
  const targetEntry = Object.entries(config.defaultSettings).find(([key]) => {
    const normalizedKey = key.toLowerCase();
    return normalizedTarget === normalizedKey ||
           normalizedTarget.includes(normalizedKey) ||
           normalizedKey.includes(normalizedTarget);
  });

  if (!targetEntry) {
    return fallback;
  }

  return targetEntry[1];
}
