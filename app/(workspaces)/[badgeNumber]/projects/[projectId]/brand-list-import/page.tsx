import { BrandListImportCompareWorkspace } from "@/components/projects/brand-list-import-compare-workspace";

export default async function BrandListImportPage({
  params,
}: {
  params: Promise<{ badgeNumber: string; projectId: string }>;
}) {
  const { badgeNumber, projectId } = await params;

  return (
    <BrandListImportCompareWorkspace
      badgeNumber={badgeNumber}
      projectId={projectId}
    />
  );
}
