"use client";

import { use, useEffect, useMemo, useState } from "react";

import { PageContent } from "@/components/layout/page-content";
import type { CommandSearchGroup } from "@/components/layout/layout-composite";
import { useSession } from "@/hooks/use-session";
import { useWorkspaceAccess } from "../../layout";
import {
  BrandingWorkspace,
  type BrandItem,
} from "@/components/dashboard/branding";

// ============================================================================
// Types
// ============================================================================

type BrandingWorkspacePageProps = {
  params: Promise<{
    badgeNumber: string;
  }>;
};

type LoadState = "loading" | "ready" | "error";

// ============================================================================
// Mock Data Generator (replace with API calls in production)
// ============================================================================

function generateMockBrands(): BrandItem[] {
  const brandNames = [
    "ONSKID-A",
    "ONSKID-B",
    "ONSKID-C",
    "PWRBX-1",
    "PWRBX-2",
    "CTRLPNL-X",
    "CTRLPNL-Y",
    "JBOX-M1",
    "JBOX-M2",
    "RELAY-S",
  ];

  return brandNames.map((name, index) => {
    const totalWires = 50 + Math.floor(Math.random() * 150);
    const approvedCount = Math.floor(totalWires * (0.4 + Math.random() * 0.6));
    const statuses: BrandItem["status"][] = [
      "approved",
      "pending",
      "in-progress",
      "error",
    ];
    const status =
      approvedCount === totalWires
        ? "approved"
        : approvedCount > totalWires * 0.5
          ? "in-progress"
          : statuses[Math.floor(Math.random() * 3)];

    return {
      id: `brand-${index + 1}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      sheetCount: 1 + Math.floor(Math.random() * 5),
      totalWires,
      approvedCount,
      status,
      assignee: index % 3 === 0 ? { badge: "PT", name: "Phi T." } : undefined,
      lastUpdated: new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      ).toISOString(),
    };
  });
}

// ============================================================================
// Component
// ============================================================================

export default function BrandingWorkspacePage({
  params: paramsPromise,
}: BrandingWorkspacePageProps) {
  const params = use(paramsPromise);
  const { user } = useSession();
  const { hasAccess, isLoading: isAccessLoading } = useWorkspaceAccess();
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  // Check branding access via workspace context
  const hasBrandingAccess = hasAccess("brandingAccess");

  // Load branding data
  useEffect(() => {
    let mounted = true;

    async function loadBrandingData() {
      setState("loading");

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (!mounted) return;

      // In production, replace with actual API calls:
      // const brandsResponse = await fetch("/api/branding/brands");

      const mockBrands = generateMockBrands();

      setBrands(mockBrands);
      setState("ready");
    }

    if (hasBrandingAccess) {
      void loadBrandingData();
    } else if (!isAccessLoading) {
      setState("error");
    }

    return () => {
      mounted = false;
    };
  }, [hasBrandingAccess, isAccessLoading]);

  // Command search groups
  const commandSearchGroups = useMemo<CommandSearchGroup[]>(
    () => [
      {
        heading: "Workspace",
        items: [
          {
            id: "workspace-home",
            label: "Workspace Home",
            href: `/${params.badgeNumber}`,
            keywords: ["workspace", "home"],
          },
          {
            id: "branding-root",
            label: "Branding",
            href: `/${params.badgeNumber}/branding`,
            keywords: ["branding", "brands", "labels"],
          },
        ],
      },
      {
        heading: "Brands",
        items: brands.slice(0, 12).map((brand) => ({
          id: `brand-${brand.id}`,
          label: brand.name,
          description: `${Math.round((brand.approvedCount / brand.totalWires) * 100)}% complete • ${brand.approvedCount}/${brand.totalWires} wires`,
          href: `/${params.badgeNumber}/branding/${encodeURIComponent(brand.id)}`,
          keywords: [brand.id, brand.name, brand.slug, brand.status],
        })),
      },
    ],
    [params.badgeNumber, brands]
  );

  // Compute metrics for the workspace
  const metrics = useMemo(() => {
    const totalSheets = brands.length;
    const totalApproved = brands.filter((b) => b.status === "approved").length;
    const totalSchemas = brands.reduce((acc, b) => acc + b.totalWires, 0);
    const approvedSchemas = brands.reduce((acc, b) => acc + b.approvedCount, 0);
    const pending = brands.filter(
      (b) => b.status === "pending" || b.status === "in-progress"
    ).length;

    return {
      sheets: totalSheets,
      approved: `${totalApproved}/${totalSheets}`,
      schemas: `${approvedSchemas}/${totalSchemas}`,
      pending,
    };
  }, [brands]);

  // Workspace data
  const workspaceStats = useMemo(
    () => ({
      workspaceId: `branding-${params.badgeNumber}`,
      metrics,
    }),
    [params.badgeNumber, metrics]
  );

  // Handle brand selection
  const handleSelectBrand = (_brand: BrandItem) => {
    // Navigate to brand detail or open modal
    // TODO: Implement navigation to brand detail page
  };

  // Access denied state
  if (!hasBrandingAccess && !isAccessLoading && state !== "loading") {
    return (
      <PageContent
        title="Branding"
        variant="wide"
        showPanel={false}
        showBreadcrumbs={true}
        showHeader={true}
        showHeading={true}
      >
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="text-muted-foreground max-w-md">
            The Branding Workspace is only available to users with Developer or
            Brander roles. Please contact your supervisor if you need access.
          </p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent
      title="Branding"
      variant="wide"
      showPanel={false}
      showBreadcrumbs={true}
      showHeader={true}
      showHeading={false}
      showSubHeader={true}
      commandSearchGroups={commandSearchGroups}
      commandSearchPlaceholder="Search brands..."
    >
      <BrandingWorkspace
        workspaceId={`branding-${params.badgeNumber}`}
        brands={brands}
        activities={[]}
        basePath={`/${params.badgeNumber}/branding`}
        onSelectBrand={handleSelectBrand}
      />
    </PageContent>
  );
}
