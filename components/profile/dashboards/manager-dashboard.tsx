"use client";

type ManagerDashboardProps = {
    badgeNumber: string;
};

export function ManagerDashboard({ badgeNumber }: ManagerDashboardProps) {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold">Manager Workspace</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Role scaffold for manager-specific dashboard logic.
                </p>
            </div>
        </div>
    );
}
