import {
    DetailSectionCard,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";
import { PhotoUploadGallery, type PhotoGalleryItem } from "@/components/activity/photo-upload-gallery";
import { Skeleton } from "@/components/ui/skeleton";

import { PART_IMAGES } from "./part-fixtures";

type PartImageGalleryProps = BaseStatefulProps<{
    images: PhotoGalleryItem[];
    allowUpload?: boolean;
    onChange?: (images: PhotoGalleryItem[]) => void;
}>;

export function PartImageGallery({
    mode = "default",
    data = {
        images: PART_IMAGES.map((image, index) => ({
            id: `fixture-${index + 1}`,
            url: "",
            name: image.label,
            uploadedAt: new Date().toISOString(),
            tags: [],
        })),
        allowUpload: false,
    },
    className,
}: PartImageGalleryProps) {
    return (
        <DetailSectionCard
            className={className}
            title="Reference Images"
            action={mode === "skeleton" ? <Skeleton className="h-8 w-24 rounded-full" /> : <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">{data.images.length} image{data.images.length === 1 ? "" : "s"}</span>}
        >
            {mode === "skeleton" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="overflow-hidden rounded-xl border border-border bg-background/70">
                            <Skeleton className="aspect-video w-full" />
                            <div className="p-2">
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <PhotoUploadGallery
                    images={data.images}
                    onChange={(nextImages) => data.onChange?.(nextImages)}
                    allowUpload={data.allowUpload}
                    allowUrlImport={data.allowUpload}
                    maxPreviewCards={6}
                />
            )}
        </DetailSectionCard>
    );
}
