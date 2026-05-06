"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";

type RoleDashboardShellProps = {
    badgeNumber: string;
    roleLabel: string;
    children: React.ReactNode;
};

export function RoleDashboardShell({ badgeNumber, roleLabel, children }: RoleDashboardShellProps) {
    return (
        <PageLayout
            title={roleLabel + " Dashboard"}
            subtitle={"Badge #" + badgeNumber}
            showAside={false}
            showSubHeader={false}
            sidePanelContent={
                <div className="border-b px-4 py-3">
                    <Button variant="ghost" size="sm" asChild className="gap-2">
                        <Link href="/profile">
                            <ArrowLeft className="h-3 w-3" />
                            Profile
                        </Link>
                    </Button>
                </div>
            }
            contentVariant="focus"
        >
            {children}
        </PageLayout>
    );
}
