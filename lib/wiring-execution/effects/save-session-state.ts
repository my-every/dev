/**
 * Save Session State Effect
 *
 * Persists the WiringExecutionSession to the project state directory
 * on every section completion and session completion.
 */

import { registerWiringEffect, type WiringEffectContext } from "../effects";
import { saveWiringExecutionSession } from "@/lib/project-state/share-wiring-execution-handlers";

async function execute(ctx: WiringEffectContext): Promise<void> {
    await saveWiringExecutionSession(ctx.projectId, ctx.session);
}

registerWiringEffect({
    id: "save-session-state",
    trigger: "section-complete",
    label: "Save session state to project directory",
    execute,
});

registerWiringEffect({
    id: "save-session-state-final",
    trigger: "session-complete",
    label: "Save final session state to project directory",
    execute,
});
