"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

type ProfilePageProps = {
    params: Promise<{ badgeNumber: string }>;
};

export default function ProfilePage({ params: paramsPromise }: ProfilePageProps) {
    const params = use(paramsPromise);
    const router = useRouter();

    useEffect(() => {
        router.replace(`/${params.badgeNumber}?tab=profile`);
    }, [params.badgeNumber, router]);

    return null;
}
