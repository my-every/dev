/**
 * Wiring Execution Effects — Registration Index
 *
 * Import this module server-side to register all effects.
 * To add a new effect, create a file in ./effects/ and import it here.
 */

import "./effects/save-session-state";
import "./effects/log-activity";
import "./effects/update-operation-time";
import "./effects/update-assignment-stage";
import "./effects/update-monthly-ledger";
