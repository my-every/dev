import { NextRequest, NextResponse } from "next/server";

/**
 * All valid first-level workspace sub-routes under /{badgeNumber}/.
 * Add new route segments here as new workspace sections are created.
 */
const BADGE_WORKSPACE_SEGMENTS = new Set([
  "projects",
  "schedule",
  "parts",
  "branding",
  "users",
  "sws",
  "training",
  "profile",
]);

/**
 * Returns true when the first URL segment looks like a badge workspace entry.
 * Excludes the legacy "380" route prefix and non-numeric segments.
 */
function isBadgeWorkspaceSegment(value: string | undefined): value is string {
  return Boolean(value && value !== "380" && /^\d+$/.test(value));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const badgeNumber = segments[0];

  // Not a badge-based route — pass through
  if (!isBadgeWorkspaceSegment(badgeNumber)) {
    return NextResponse.next();
  }

  const workspaceSegment = segments[1];

  // Allow the workspace home page (/{badgeNumber} with no sub-segment)
  if (!workspaceSegment) {
    return NextResponse.next();
  }

  // Allow all known workspace sub-routes
  if (BADGE_WORKSPACE_SEGMENTS.has(workspaceSegment)) {
    return NextResponse.next();
  }

  // Unknown sub-segment — redirect to home instead of projects
  const url = request.nextUrl.clone();
  url.pathname = `/${badgeNumber}`;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
