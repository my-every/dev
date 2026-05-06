"use client";

type QaDashboardProps = {
    badgeNumber: string;
};

export function QaDashboard({ badgeNumber }: QaDashboardProps) {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold">QA Workspace</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Route scaffold for QA-specific dashboard logic.
                </p>
            </div>
        </div>
    );
}
