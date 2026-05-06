/**
 * Orthogonal Path Builder
 * 
 * Builds orthogonal (Manhattan) wire paths between two points.
 * Supports panduct-assisted routing when available.
 */

import type { Point, PathSegment, PanductNode, PanelTopology } from "./types";

// ============================================================================
// Path Building
// ============================================================================

/**
 * Build an orthogonal (Manhattan) path between two points.
 * Uses L-shaped routing: horizontal first, then vertical.
 * 
 * @param from - Start point
 * @param to - End point
 * @returns Array of path segments
 */
export function buildOrthogonalPath(from: Point, to: Point): PathSegment[] {
  const segments: PathSegment[] = [];
  
  // Direct path if points are aligned
  if (Math.abs(from.x - to.x) < 0.1) {
    // Vertical line
    segments.push({
      kind: "vertical",
      from,
      to,
      length: Math.abs(to.y - from.y),
    });
    return segments;
  }
  
  if (Math.abs(from.y - to.y) < 0.1) {
    // Horizontal line
    segments.push({
      kind: "horizontal",
      from,
      to,
      length: Math.abs(to.x - from.x),
    });
    return segments;
  }
  
  // L-shaped path: horizontal first, then vertical
  const midPoint: Point = { x: to.x, y: from.y };
  
  // Horizontal segment
  segments.push({
    kind: "horizontal",
    from,
    to: midPoint,
    length: Math.abs(to.x - from.x),
  });
  
  // Vertical segment
  segments.push({
    kind: "vertical",
    from: midPoint,
    to,
    length: Math.abs(to.y - from.y),
  });
  
  return segments;
}

/**
 * Build a panduct-assisted path between two points.
 * Routes through the nearest panduct when possible.
 * 
 * @param from - Start point
 * @param to - End point
 * @param panducts - Available panducts
 * @returns Array of path segments
 */
export function buildPanductAssistedPath(
  from: Point,
  to: Point,
  panducts: PanductNode[]
): PathSegment[] {
  if (panducts.length === 0) {
    return buildOrthogonalPath(from, to);
  }
  
  // Find the best panduct for this route
  const panduct = findBestPanduct(from, to, panducts);
  
  if (!panduct) {
    return buildOrthogonalPath(from, to);
  }
  
  const segments: PathSegment[] = [];
  
  // Entry point into panduct
  const entryPoint = findPanductEntry(from, panduct);
  
  // Exit point from panduct
  const exitPoint = findPanductExit(to, panduct);
  
  // Exit segment from device to panduct entry
  if (Math.abs(from.x - entryPoint.x) > 0.1 || Math.abs(from.y - entryPoint.y) > 0.1) {
    segments.push({
      kind: "exit",
      from,
      to: entryPoint,
      length: calculateDistance(from, entryPoint),
    });
  }
  
  // Route through panduct
  if (Math.abs(entryPoint.x - exitPoint.x) > 0.1 || Math.abs(entryPoint.y - exitPoint.y) > 0.1) {
    // Horizontal panduct routing
    if (panduct.orientation === "horizontal") {
      segments.push({
        kind: "horizontal",
        from: entryPoint,
        to: exitPoint,
        length: Math.abs(exitPoint.x - entryPoint.x),
      });
    } else {
      segments.push({
        kind: "vertical",
        from: entryPoint,
        to: exitPoint,
        length: Math.abs(exitPoint.y - entryPoint.y),
      });
    }
  }
  
  // Entry segment from panduct exit to device
  if (Math.abs(exitPoint.x - to.x) > 0.1 || Math.abs(exitPoint.y - to.y) > 0.1) {
    segments.push({
      kind: "entry",
      from: exitPoint,
      to,
      length: calculateDistance(exitPoint, to),
    });
  }
  
  return segments;
}

/**
 * Find the best panduct for routing between two points.
 */
function findBestPanduct(from: Point, to: Point, panducts: PanductNode[]): PanductNode | null {
  if (panducts.length === 0) return null;
  
  // Find panduct that minimizes total path length
  let bestPanduct: PanductNode | null = null;
  let bestDistance = Infinity;
  
  for (const panduct of panducts) {
    const entry = findPanductEntry(from, panduct);
    const exit = findPanductExit(to, panduct);
    
    const totalDistance = 
      calculateDistance(from, entry) +
      calculateDistance(entry, exit) +
      calculateDistance(exit, to);
    
    // Only use panduct if it's actually shorter than direct path
    const directDistance = calculateDistance(from, to);
    
    if (totalDistance < bestDistance && totalDistance < directDistance * 1.5) {
      bestDistance = totalDistance;
      bestPanduct = panduct;
    }
  }
  
  return bestPanduct;
}

/**
 * Find the entry point into a panduct closest to the start point.
 */
function findPanductEntry(from: Point, panduct: PanductNode): Point {
  if (panduct.orientation === "horizontal") {
    // Enter from top or bottom of panduct
    const panductCenterY = panduct.y + panduct.height / 2;
    const clampedX = Math.max(panduct.x, Math.min(panduct.x + panduct.width, from.x));
    return { x: clampedX, y: panductCenterY };
  } else {
    // Enter from left or right of panduct
    const panductCenterX = panduct.x + panduct.width / 2;
    const clampedY = Math.max(panduct.y, Math.min(panduct.y + panduct.height, from.y));
    return { x: panductCenterX, y: clampedY };
  }
}

/**
 * Find the exit point from a panduct closest to the destination.
 */
function findPanductExit(to: Point, panduct: PanductNode): Point {
  if (panduct.orientation === "horizontal") {
    const panductCenterY = panduct.y + panduct.height / 2;
    const clampedX = Math.max(panduct.x, Math.min(panduct.x + panduct.width, to.x));
    return { x: clampedX, y: panductCenterY };
  } else {
    const panductCenterX = panduct.x + panduct.width / 2;
    const clampedY = Math.max(panduct.y, Math.min(panduct.y + panduct.height, to.y));
    return { x: panductCenterX, y: clampedY };
  }
}

/**
 * Calculate Euclidean distance between two points.
 */
function calculateDistance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the total length of a path.
 */
export function calculatePathLength(segments: PathSegment[]): number {
  return segments.reduce((total, segment) => total + segment.length, 0);
}

/**
 * Count the number of 90-degree turns in a path.
 */
export function countPathTurns(segments: PathSegment[]): number {
  let turns = 0;
  
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    
    // Count as turn if direction changes
    if (
      (prev.kind === "horizontal" && curr.kind === "vertical") ||
      (prev.kind === "vertical" && curr.kind === "horizontal") ||
      (prev.kind === "entry" || prev.kind === "exit") ||
      (curr.kind === "entry" || curr.kind === "exit")
    ) {
      turns++;
    }
  }
  
  return turns;
}
