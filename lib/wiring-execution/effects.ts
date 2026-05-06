/**
 * Wiring Execution Effects Pipeline
 *
 * Extensible registry of side-effects that fire on section or session completion.
 * To add a new effect, create a module in ./effects/ and register it in WIRING_EFFECTS.
 */

import type { WiringExecutionSession, WiringSectionExecution } from "@/types/d380-wiring-execution";

// ============================================================================
// Effect Types
// ============================================================================

export type WiringEffectTrigger = "section-complete" | "session-complete";

export interface WiringEffectContext {
    session: WiringExecutionSession;
    section?: WiringSectionExecution;
    projectId: string;
    badge: string;
    shift: string;
}

export interface WiringEffect {
    id: string;
    trigger: WiringEffectTrigger;
    label: string;
    execute: (ctx: WiringEffectContext) => Promise<void>;
}

export interface WiringEffectResult {
    effectId: string;
    success: boolean;
    error?: string;
}

// ============================================================================
// Effect Registry
// ============================================================================

const WIRING_EFFECTS: WiringEffect[] = [];

/**
 * Register a new effect. Called by individual effect modules.
 */
export function registerWiringEffect(effect: WiringEffect): void {
    if (!WIRING_EFFECTS.find(e => e.id === effect.id)) {
        WIRING_EFFECTS.push(effect);
    }
}

/**
 * Run all effects matching the given trigger.
 * Returns results for each effect (success/failure).
 */
export async function runWiringEffects(
    trigger: WiringEffectTrigger,
    ctx: WiringEffectContext,
): Promise<WiringEffectResult[]> {
    const matching = WIRING_EFFECTS.filter(e => e.trigger === trigger);
    const results: WiringEffectResult[] = [];

    for (const effect of matching) {
        try {
            await effect.execute(ctx);
            results.push({ effectId: effect.id, success: true });
        } catch (err) {
            results.push({
                effectId: effect.id,
                success: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return results;
}

/**
 * Get all registered effects (for debugging/UI).
 */
export function getRegisteredEffects(): ReadonlyArray<WiringEffect> {
    return WIRING_EFFECTS;
}
