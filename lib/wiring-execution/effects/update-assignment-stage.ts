/**
 * Update Assignment Stage Effect
 *
 * On session completion, transitions the assignment's stage
 * from WIRING → next stage via the assignment-mappings API.
 */

import { registerWiringEffect, type WiringEffectContext } from "../effects";

async function execute(ctx: WiringEffectContext): Promise<void> {
    // PATCH the assignment stage via the existing API
    await fetch(`/api/projects/${ctx.projectId}/assignment-mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slug: ctx.session.sheetSlug,
            selectedStage: "IPV2",
            selectedStatus: "NOT_STARTED",
        }),
    });
}

registerWiringEffect({
    id: "update-assignment-stage",
    trigger: "session-complete",
    label: "Transition assignment stage to IPV2",
    execute,
});
