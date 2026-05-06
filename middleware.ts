import { NextRequest, NextResponse } from "next/server";

const ALLOWED_BADGE_WORKSPACE_SEGMENTS = new Set(["projects", "schedule", "parts"]);

function isBadgeWorkspaceSegment(value: string | undefined): value is string {
  return Boolean(value && value !== "380" && /^\d+$/.test(value));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const badgeNumber = segments[0];

  if (!isBadgeWorkspaceSegment(badgeNumber)) {
    return NextResponse.next();
  }

  const workspaceSegment = segments[1];
  if (workspaceSegment && ALLOWED_BADGE_WORKSPACE_SEGMENTS.has(workspaceSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${badgeNumber}/projects`;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
