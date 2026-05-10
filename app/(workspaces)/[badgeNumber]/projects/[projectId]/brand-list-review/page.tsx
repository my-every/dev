import { BrandListReviewWorkspace } from "@/components/projects/brand-list-review-workspace";

export default async function BrandListReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ badgeNumber: string; projectId: string }>;
  searchParams: Promise<{ surface?: string; sheetSlug?: string; readOnly?: string; promptImport?: string }>;
}) {
  const { badgeNumber, projectId } = await params;
  const { surface, sheetSlug, readOnly, promptImport } = await searchParams;

  return (
    <BrandListReviewWorkspace
      badgeNumber={badgeNumber}
      projectId={projectId}
      initialSurface={surface}
      initialSheetSlug={sheetSlug}
      readOnly={readOnly === "1"}
      promptImport={promptImport === "1"}
    />
  );
}
