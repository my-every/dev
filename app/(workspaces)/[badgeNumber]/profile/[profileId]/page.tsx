"use client";

import { use } from "react";

import { ProfileWorkspaceDetail } from "../_components/profile-workspace-detail";

type ProfileDetailsPageProps = {
    params: Promise<{ badgeNumber: string; profileId: string }>;
};

export default function ProfileDetailsPage({ params: paramsPromise }: ProfileDetailsPageProps) {
    const params = use(paramsPromise);

    return (
        <ProfileWorkspaceDetail
            badgeNumber={params.badgeNumber}
            targetBadge={params.profileId}
            backHref={`/${params.badgeNumber}/profile`}
            title="Profile Details"
            subtitle={`Badge ${params.profileId}`}
        />
    );
}
