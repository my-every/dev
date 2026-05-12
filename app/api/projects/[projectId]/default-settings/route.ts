import { NextRequest, NextResponse } from "next/server";
import {
  readProjectManifest,
  writeProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { enrichManifestFromProjectState } from "@/lib/project-state/manifest-enrichment";
import { syncAssignmentSettingsToLegal } from "@/lib/legal-drawings/library";
import {
  BoxSideConfig,
  getDefaultExternalLocationSettings,
  type ExternalLocationDefaultSettings,
} from "@/boxSide";

/**
 * Infer the box side key from a box side string value.
 * Handles variations like "Left Side", "leftSide", "LEFT_SIDE", etc.
 */
function inferBoxSideKey(boxSideValue: string | undefined): string | undefined {
  if (!boxSideValue) return undefined;
  
  const normalized = boxSideValue.toLowerCase().replace(/[\s_-]+/g, "");
  
  // Find matching key in BoxSideConfig
  for (const key of Object.keys(BoxSideConfig)) {
    const keyNormalized = key.toLowerCase();
    if (normalized === keyNormalized || normalized.includes(keyNormalized)) {
      return key;
    }
  }
  
  return undefined;
}

/**
 * Infer box side from external location string.
 * External locations often contain box side info like "JB70 LEFT SIDE" or "RAIL, LEFT, JB70"
 */
function inferBoxSideFromLocation(location: string): string | undefined {
  const locationLower = location.toLowerCase();
  
  // Check for door references
  if (locationLower.includes("left door") || locationLower.includes("l door") || locationLower.includes("ldoor")) {
    return "leftDoor";
  }
  if (locationLower.includes("right door") || locationLower.includes("r door") || locationLower.includes("rdoor")) {
    return "rightDoor";
  }
  if (locationLower.includes("door")) {
    // Generic door - could be either, default to leftDoor
    return "leftDoor";
  }
  
  // Check for specific back side references (must check before generic "back")
  if (locationLower.includes("top back") || locationLower.includes("topback") || locationLower.includes("top bk")) {
    return "topBackSide";
  }
  if (locationLower.includes("left back") || locationLower.includes("leftback") || locationLower.includes("l back") || locationLower.includes("lbk")) {
    return "leftBackSide";
  }
  if (locationLower.includes("right back") || locationLower.includes("rightback") || locationLower.includes("r back") || locationLower.includes("rbk")) {
    return "rightBackSide";
  }
  
  // Check for side references (after back sides to avoid false matches)
  if (locationLower.includes("left side") || locationLower.includes("leftside") || locationLower.includes("l side") || 
      (locationLower.includes("left") && !locationLower.includes("back"))) {
    return "leftSide";
  }
  if (locationLower.includes("right side") || locationLower.includes("rightside") || locationLower.includes("r side") ||
      (locationLower.includes("right") && !locationLower.includes("back"))) {
    return "rightSide";
  }
  
  // Generic back side
  if (locationLower.includes("back") || locationLower.includes("bk side") || locationLower.includes("bkside")) {
    return "backSide";
  }
  
  return undefined;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);

  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Return current assignments with their box sides and external locations
  const assignments = Object.entries(manifest.assignments ?? {}).map(
    ([sheetSlug, assignment]) => ({
      sheetSlug,
      sheetName: assignment.sheetName,
      boxSide: assignment.boxSide,
      unitType: assignment.unitType,
      externalLocations: assignment.externalLocations ?? [],
    })
  );

  return NextResponse.json({
    projectId,
    assignments,
    boxSideConfig: BoxSideConfig,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);

  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { 
    applyDefaults = true, 
    syncToLegal = true,
    overwriteExisting = false,
  } = body as { 
    applyDefaults?: boolean; 
    syncToLegal?: boolean;
    overwriteExisting?: boolean;
  };

  if (!applyDefaults) {
    return NextResponse.json({ 
      message: "No action taken", 
      updated: false 
    });
  }

  let updatedCount = 0;
  const updatedAssignments: string[] = [];

  // Process each assignment
  for (const [sheetSlug, assignment] of Object.entries(manifest.assignments ?? {})) {
    const assignmentBoxSideKey = inferBoxSideKey(assignment.boxSide);
    
    if (!assignmentBoxSideKey) {
      // Skip assignments without a valid box side
      continue;
    }

    const externalLocations = assignment.externalLocations ?? [];
    let locationUpdated = false;

    // Update each external location's visibility settings
    const updatedLocations = externalLocations.map((extLoc) => {
      const targetBoxSideKey = inferBoxSideFromLocation(extLoc.location);
      
      if (!targetBoxSideKey) {
        // Can't infer target box side, keep existing settings
        return extLoc;
      }

      const defaults = getDefaultExternalLocationSettings(
        assignmentBoxSideKey,
        targetBoxSideKey
      );

      // Only update if overwriteExisting is true or values are currently all true (default)
      const isCurrentlyDefault = 
        extLoc.wireListVisible !== false && 
        extLoc.brandingVisible !== false;

      if (!overwriteExisting && !isCurrentlyDefault) {
        // Don't overwrite user-customized settings
        return extLoc;
      }

      locationUpdated = true;
      return {
        ...extLoc,
        wireListVisible: defaults.wire_list,
        brandingVisible: defaults.brand_list,
        // Note: crossWireVisible would need to be added to the external location schema
        // For now, we'll use wireListVisible as the cross_wire indicator
      };
    });

    if (locationUpdated) {
      manifest.assignments![sheetSlug] = {
        ...assignment,
        externalLocations: updatedLocations,
      };
      updatedCount++;
      updatedAssignments.push(sheetSlug);
    }
  }

  if (updatedCount === 0) {
    return NextResponse.json({
      message: "No assignments updated - all already have custom settings or missing box sides",
      updated: false,
      updatedCount: 0,
    });
  }

  // Enrich and save the manifest
  const enrichedManifest = await enrichManifestFromProjectState(manifest);
  await writeProjectManifest(enrichedManifest);

  // Sync to legal drawings if requested
  let legalSyncResult = null;
  if (syncToLegal) {
    legalSyncResult = await syncAssignmentSettingsToLegal({ 
      projectManifest: enrichedManifest 
    });
  }

  return NextResponse.json({
    message: `Applied default settings to ${updatedCount} assignment(s)`,
    updated: true,
    updatedCount,
    updatedAssignments,
    legalSync: legalSyncResult,
    project: enrichedManifest,
  });
}
