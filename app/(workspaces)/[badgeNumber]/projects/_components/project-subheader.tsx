import type { ReactNode } from "react";

import { WorkspaceDetailSubheader } from "@/app/(workspaces)/[badgeNumber]/_components";

import { PROJECT_SUBHEADER } from "./project-fixtures";
import type { BaseStatefulProps } from "@/app/(workspaces)/[badgeNumber]/_components";

type ProjectSubheaderProps = BaseStatefulProps<typeof PROJECT_SUBHEADER> & {
    actions?: ReactNode;
};

export function ProjectSubheader({ mode = "default", data = PROJECT_SUBHEADER, actions, className }: ProjectSubheaderProps) {
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
            actions={actions}
        />
    );
}