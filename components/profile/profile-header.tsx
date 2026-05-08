"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Check, Edit2, Move, Palette, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UserProfile, ProfileStat, UserRole } from "@/types/profile";
import type { UserIdentity } from "@/types/d380-user-session";
import { ROLE_DEFAULT_STATS } from "@/lib/profile/widget-registry";
import { ProfileStatGrid } from "./profile-stat-grid";
import { ProfileRoleBadge } from "./profile-role-badge";
import { ProfileCoverImageUploader } from "./profile-cover-image-uploader";
import {
  ProfileAvatar,
  ProfileIdentity,
  ProfileMetaRow,
  ProfileBio,
} from "./profile-fields";
import { ProfileActions, type ProfileAction } from "./profile-actions";
import { useProfileAvatar } from "@/hooks/use-profile-avatar";
import { useProfileCoverImage } from "@/hooks/use-profile-cover-image";
import {
  getHeaderSolidBg,
  getHeaderSolidBgByIndex,
  HEADER_COLOR_OPTIONS,
} from "@/lib/profile/avatar-utils";

// ============================================================================
// Helper: Map UserIdentity to UserProfile
// ============================================================================

function identityToProfile(user: UserIdentity): UserProfile {
  const roleMap: Record<string, UserRole> = {
    DEVELOPER: "developer",
    MANAGER: "manager",
    SUPERVISOR: "supervisor",
    TEAM_LEAD: "team_lead",
    QA: "qa",
    BRANDER: "brander",
    ASSEMBLER: "assembler",
  };

  return {
    id: user.badge,
    fullName: user.legalName,
    preferredName: user.preferredName,
    badgeId: user.badge,
    email: user.email ?? undefined,
    role: roleMap[user.role] ?? "assembler",
    title: user.title ?? undefined,
    shift: user.currentShift,
    lwc: user.primaryLwc ? [user.primaryLwc] : [],
    status: "active",
    joinedAt: user.hireDate,
  };
}

// ============================================================================
// PROFILE HEADER - Main component
// ============================================================================

type ProfileHeaderLayout = 'horizontal' | 'vertical' | 'side'

interface ProfileHeaderProps {
  badgeNumber: string
  isEditable?: boolean
  /** Render in compact mode for narrow containers like aside panels */
  compact?: boolean
  /** Layout variant — horizontal (default), vertical (avatar + name stacked center), or side (avatar + fields in a clean flex row, no cover overlap) */
  layout?: ProfileHeaderLayout
  /** Actions rendered in the bottom-right of the header */
  actions?: ProfileAction[];
  onProfileUpdate?: (profile: Partial<UserProfile>) => void;
  className?: string;
}

export function ProfileHeader({
  badgeNumber,
  isEditable = false,
  compact = false,
  layout = 'horizontal',
  actions,
  className,
}: ProfileHeaderProps) {
  const isVertical = layout === 'vertical'
  const isSide = layout === 'side'
  // State for profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);
  const [initialCoverUrl, setInitialCoverUrl] = useState<string | null>(null);
  const [initialCoverPositionY, setInitialCoverPositionY] =
    useState<number>(50);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [dragPositionY, setDragPositionY] = useState<number | null>(null);
  const [headerColorIndex, setHeaderColorIndex] = useState<number | null>(null);
  const coverContainerRef = React.useRef<HTMLDivElement>(null);
  const dragStartRef = React.useRef<{
    startY: number;
    startPos: number;
  } | null>(null);

  // Fetch profile data on mount
  useEffect(() => {
    fetch(`/api/users/${badgeNumber}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile?.avatarPath) {
          setInitialAvatarUrl(data.profile.avatarPath);
        }
        if (data?.profile?.coverImagePath) {
          setInitialCoverUrl(data.profile.coverImagePath);
        }
        if (data?.profile?.coverImagePositionY != null) {
          setInitialCoverPositionY(data.profile.coverImagePositionY);
        }
        // Build profile from fetched data
        if (data?.profile) {
          const p = data.profile as UserIdentity;
          setProfile(identityToProfile(p));
        }
      })
      .catch(() => {
        /* non-critical */
      });
  }, [badgeNumber]);

  // Handle avatar and cover changes
  const { avatarUrl, handleAvatarChange } = useProfileAvatar({
    badge: badgeNumber,
    initialUrl: initialAvatarUrl,
  });

  const {
    coverUrl,
    positionY: coverPositionY,
    handleCoverChange,
    handlePositionChange: handleCoverPositionChange,
  } = useProfileCoverImage({
    badge: badgeNumber,
    initialUrl: initialCoverUrl,
    initialPositionY: initialCoverPositionY,
  });

  // Merge avatar and cover into profile
  const mergedProfile = useMemo<UserProfile | null>(() => {
    if (!profile) return null;
    return {
      ...profile,
      avatarUrl: avatarUrl ?? undefined,
      coverImageUrl: coverUrl ?? undefined,
      coverImagePositionY: coverPositionY,
    };
  }, [profile, avatarUrl, coverUrl, coverPositionY]);

  // Get stats for the profile role
  const stats = useMemo(() => {
    if (!mergedProfile) return [];
    return ROLE_DEFAULT_STATS[mergedProfile.role] ?? [];
  }, [mergedProfile]);

  // --- Cover reposition handlers ---
  // Define these BEFORE the early return to comply with Rules of Hooks
  const handleRepositionStart = useCallback(() => {
    setDragPositionY(mergedProfile?.coverImagePositionY ?? 50);
    setIsRepositioning(true);
  }, [mergedProfile?.coverImagePositionY]);

  const handleRepositionSave = useCallback(() => {
    if (dragPositionY != null) {
      handleCoverPositionChange(dragPositionY);
    }
    setIsRepositioning(false);
    setDragPositionY(null);
  }, [dragPositionY, handleCoverPositionChange]);

  const handleRepositionCancel = useCallback(() => {
    setIsRepositioning(false);
    setDragPositionY(null);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isRepositioning) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartRef.current = {
        startY: e.clientY,
        startPos: dragPositionY ?? 50,
      };
    },
    [isRepositioning, dragPositionY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isRepositioning ||
        !dragStartRef.current ||
        !coverContainerRef.current
      )
        return;
      const containerHeight = coverContainerRef.current.offsetHeight;
      const deltaPixels = e.clientY - dragStartRef.current.startY;
      const deltaPct = (deltaPixels / containerHeight) * -100;
      const newY = Math.max(
        0,
        Math.min(100, dragStartRef.current.startPos + deltaPct),
      );
      setDragPositionY(newY);
    },
    [isRepositioning],
  );

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  // Compute solid header color — must be above early return to avoid conditional hooks
  const headerSolidBg = useMemo(() => {
    if (headerColorIndex != null) return getHeaderSolidBgByIndex(headerColorIndex);
    return getHeaderSolidBg(badgeNumber);
  }, [headerColorIndex, badgeNumber]);

  if (!mergedProfile) {
    return null;
  }

  const currentPositionY =
    dragPositionY ?? mergedProfile.coverImagePositionY ?? 50;

  return (
    <Card
      className={cn(
        "overflow-hidden pt-0 rounded-none bg-background border-0 w-full",
        isSide ? "gap-0" : "gap-10",
        className,
      )}
    >
      {/* Cover Image Section */}
      <div
        ref={coverContainerRef}
        className={cn(
          "relative",
          isSide ? "h-14 sm:h-18 md:h-20" : isVertical ? "h-28 sm:h-36" : compact ? "h-24" : "h-36 sm:h-44 md:h-52",
          isRepositioning && "cursor-grab active:cursor-grabbing select-none",
          !mergedProfile.coverImageUrl && headerSolidBg,
          mergedProfile.coverImageUrl && "bg-slate-800",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {mergedProfile.coverImageUrl ? (
          <img
            src={mergedProfile.coverImageUrl}
            alt="Cover"
            className="h-full w-full object-cover pointer-events-none"
            style={{ objectPosition: `center ${currentPositionY}%` }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0" />
        )}

        {/* Combined button group: Color + Edit Cover */}
        {!isRepositioning && (!mergedProfile.coverImageUrl || isEditable) && (
          <div className="absolute top-3 right-3 z-10 flex divide-x divide-white/20 overflow-hidden rounded-full bg-black/40 backdrop-blur-sm">
            {!mergedProfile.coverImageUrl && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-none px-3 gap-1.5 text-white/90 text-[11px] hover:bg-white/20 hover:text-white"
                  >
                    <Palette className="h-3 w-3" />
                    Color
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground mb-2">
                    Header Color
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {HEADER_COLOR_OPTIONS.map((opt) => {
                      const isActive = headerColorIndex === opt.index;
                      return (
                        <button
                          key={opt.index}
                          type="button"
                          onClick={() => setHeaderColorIndex(opt.index)}
                          className={cn(
                            "h-6 w-6 rounded-full transition-all cursor-pointer",
                            opt.bg,
                            isActive
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                              : "hover:scale-110",
                          )}
                          aria-label={`Color option ${opt.index + 1}`}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isEditable && (
              <ProfileCoverImageUploader
                onImageChange={handleCoverChange}
                onReposition={
                  mergedProfile.coverImageUrl ? handleRepositionStart : undefined
                }
                isOpen={isEditingCover}
                onOpenChange={setIsEditingCover}
                className="relative top-auto right-auto rounded-none bg-transparent hover:bg-white/20 text-white/90 hover:text-white h-7 px-3 text-[11px]"
              />
            )}
          </div>
        )}

        {/* Reposition mode overlay */}
        {isRepositioning && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <p className="text-white text-sm font-medium flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <Move className="h-4 w-4" />
              Drag to reposition
            </p>
          </div>
        )}

        {/* Reposition save/cancel buttons */}
        {isRepositioning && (
          <div
            className="absolute bottom-3 right-3 flex items-center gap-2 z-20"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              onClick={handleRepositionCancel}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 rounded-full bg-white/90 text-black backdrop-blur-sm hover:bg-white"
              onClick={handleRepositionSave}
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        )}

      </div>

      {/* Profile Content */}
      {isSide ? (
        /* ── Side layout: @container-driven fluid row ── */
        <div className="@container w-full">
          <div className="flex w-full items-center gap-2.5 px-3 py-2.5 @sm:gap-3 @sm:px-4 @sm:py-3 @md:py-4">
            {/* Avatar — scales with container */}
            <div className="shrink-0">
              <ProfileAvatar
                fullName={mergedProfile.fullName}
                preferredName={mergedProfile.preferredName}
                avatarUrl={mergedProfile.avatarUrl}
                status={mergedProfile.status}
                size="sm"
                colorKey={badgeNumber}
                editable={isEditable}
                onImageChange={handleAvatarChange}
                isEditOpen={isEditingAvatar}
                onEditOpenChange={setIsEditingAvatar}
                className="@md:hidden"
              />
              <ProfileAvatar
                fullName={mergedProfile.fullName}
                preferredName={mergedProfile.preferredName}
                avatarUrl={mergedProfile.avatarUrl}
                status={mergedProfile.status}
                size="md"
                colorKey={badgeNumber}
                editable={isEditable}
                onImageChange={handleAvatarChange}
                isEditOpen={isEditingAvatar}
                onEditOpenChange={setIsEditingAvatar}
                className="hidden @md:block"
              />
            </div>

            {/* Identity + meta — grows to fill remaining space */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate font-medium text-sm @sm:text-base leading-tight">
                  {mergedProfile.preferredName || mergedProfile.fullName}
                </span>
                <ProfileRoleBadge role={mergedProfile.role} />
              </div>
              {/* Meta row — progressively reveals more info as container widens */}
                <ProfileMetaRow
                  profile={mergedProfile}
                  compact
                  className="@md:flex hidden"
                />
                <ProfileMetaRow
                  profile={mergedProfile}
                  badgeOnly
                  className="flex @md:hidden"
                />
              {mergedProfile.bio && (
                <ProfileBio
                  bio={mergedProfile.bio}
                  className="hidden @lg:block mt-0.5 text-xs text-muted-foreground line-clamp-1"
                />
              )}
            </div>

            {/* Actions — pinned to the right */}
            {actions && actions.length > 0 && (
              <ProfileActions actions={actions} className="shrink-0 self-center" />
            )}
          </div>
        </div>
      ) : isVertical ? (
        /* ── Vertical layout: avatar + name + role centered ── */
        <div className="relative flex flex-col items-center px-4 pb-6 -mt-12 sm:-mt-14 gap-3 text-center">
          <ProfileAvatar
            fullName={mergedProfile.fullName}
            preferredName={mergedProfile.preferredName}
            avatarUrl={mergedProfile.avatarUrl}
            status={mergedProfile.status}
            size="lg"
            colorKey={badgeNumber}
            align="center"
            editable={isEditable}
            onImageChange={handleAvatarChange}
            isEditOpen={isEditingAvatar}
            onEditOpenChange={setIsEditingAvatar}
          />
          <div className="flex flex-col items-center gap-1">
            <ProfileIdentity
              preferredName={mergedProfile.preferredName}
              title={mergedProfile.title}
              layout={layout}
              className="items-center"
            >
              <ProfileRoleBadge role={mergedProfile.role} />
            </ProfileIdentity>
          </div>
          <ProfileMetaRow profile={mergedProfile} className="justify-center" />
          {mergedProfile.bio && (
            <ProfileBio bio={mergedProfile.bio} className="text-sm text-muted-foreground max-w-xs" />
          )}
          {actions && actions.length > 0 && (
            <ProfileActions actions={actions} />
          )}
        </div>
      ) : (
        /* ── Horizontal layout (default) ── */
        <div
          className={cn(
            "relative mb-4 px-4 flex flex-col gap-6",
            compact
              ? "-mt-10 gap-3"
              : "-mt-16 sm:-mt-20 lg:flex-row lg:items-start",
          )}
        >
          <div
            className={cn(
              "relative flex gap-4",
              compact
                ? "flex-col items-center text-center"
                : "flex-1 items-center justify-between",
            )}
          >
            <ProfileAvatar
              fullName={mergedProfile.fullName}
              preferredName={mergedProfile.preferredName}
              avatarUrl={mergedProfile.avatarUrl}
              status={mergedProfile.status}
              size={compact ? "md" : "lg"}
              colorKey={badgeNumber}
              editable={isEditable}
              onImageChange={handleAvatarChange}
              isEditOpen={isEditingAvatar}
              onEditOpenChange={setIsEditingAvatar}
            />

            {/* Identity Block */}
            <div
              className={cn(
                "relative flex w-full flex-1",
                compact ? "flex-col items-center" : "mt-15 justify-between",
              )}
            >
              <div
                className={cn(
                  "flex flex-col flex-1",
                  compact ? "items-center px-0" : "px-4",
                )}
              >
                <ProfileIdentity
                  preferredName={mergedProfile.preferredName}
                  fullName={mergedProfile.fullName}
                  title={mergedProfile.title}
                >
                  <ProfileRoleBadge role={mergedProfile.role} />
                </ProfileIdentity>

                {/* Meta info row */}
                <ProfileMetaRow
                  profile={mergedProfile}
                  className={cn("mt-3", compact && "justify-center")}
                />

                {!compact && (
                  <ProfileBio
                    bio={mergedProfile.bio}
                    className="mt-4 text-sm text-muted-foreground"
                  />
                )}
              </div>

              {/* Actions — bottom right */}
              {!compact && actions && actions.length > 0 && (
                <ProfileActions actions={actions} className="self-end shrink-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

