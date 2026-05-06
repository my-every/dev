import {
    WorkspaceDetailSubheader,
    type BaseStatefulProps,
} from "@/app/(workspaces)/[badgeNumber]/_components";

import { PART_SUBHEADER } from "./part-fixtures";

type PartSubheaderProps = BaseStatefulProps<typeof PART_SUBHEADER>;

export function PartSubheader({ mode = "default", data = PART_SUBHEADER, className }: PartSubheaderProps) {
    if (mode === "skeleton") {
        return <WorkspaceDetailSubheader mode="skeleton" className={className} />;
    }

    return (
        <WorkspaceDetailSubheader
            mode={mode}
            className={className}
            title={data.title}
            description={data.description}
            metadata={data.metadata}
        />
    );
}
