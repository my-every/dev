import { NextResponse } from "next/server";

import {
  mergeCompetencyProfilePatch,
  normalizeCompetencyProfile,
  type UserCompetencyProfile,
} from "@/lib/users/competency";
import {
  readProfileFromShare,
  writeProfileToShare,
} from "@/lib/profile/share-profile-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ badge: string }> },
) {
  const { badge } = await params;

  if (!badge || !/^\d+$/.test(badge)) {
    return NextResponse.json({ error: "Invalid badge number" }, { status: 400 });
  }

  try {
    const profile = await readProfileFromShare(badge);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      badge,
      competencyProfile: normalizeCompetencyProfile(
        profile.competencyProfile,
        profile.assignmentCompetency,
      ),
    });
  } catch (error) {
    console.error(`[users/${badge}/competency] GET failed`, error);
    return NextResponse.json(
      { error: "Failed to read competency profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ badge: string }> },
) {
  const { badge } = await params;

  if (!badge || !/^\d+$/.test(badge)) {
    return NextResponse.json({ error: "Invalid badge number" }, { status: 400 });
  }

  try {
    const profile = await readProfileFromShare(badge);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      competencyProfile?: Partial<UserCompetencyProfile>;
    };

    if (!body?.competencyProfile || typeof body.competencyProfile !== "object") {
      return NextResponse.json(
        { error: "competencyProfile patch is required" },
        { status: 400 },
      );
    }

    const nextCompetencyProfile = mergeCompetencyProfilePatch(
      normalizeCompetencyProfile(
        profile.competencyProfile,
        profile.assignmentCompetency,
      ),
      body.competencyProfile,
    );

    const updated = await writeProfileToShare(badge, {
      competencyProfile: nextCompetencyProfile,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Profile not found after update" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      badge,
      competencyProfile: updated.competencyProfile,
    });
  } catch (error) {
    console.error(`[users/${badge}/competency] PATCH failed`, error);
    return NextResponse.json(
      { error: "Failed to update competency profile" },
      { status: 500 },
    );
  }
}
