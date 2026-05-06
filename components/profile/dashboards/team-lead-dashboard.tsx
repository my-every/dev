"use client";

import { AssignmentTimeline } from "@/components/assignments/assignment-timeline";
import { BadgeTimeLogSection } from "@/components/profile/dashboards/badge-time-log-section";

type TeamLeadDashboardProps = {
    badgeNumber: string;
};

export function TeamLeadDashboard({ badgeNumber }: TeamLeadDashboardProps) {
    return (
        <div className="space-y-6">
            <section className="rounded-lg border bg-muted/40 p-4">
                <h2 className="text-xl font-semibold">Team Lead Workspace</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage assignment placement by floor area and monitor current execution time.
                </p>
            </section>

            <AssignmentTimeline />

            <section className="rounded-lg border bg-card p-4">
                <BadgeTimeLogSection badgeNumber={badgeNumber} />
            </section>
        </div>
    );
}
