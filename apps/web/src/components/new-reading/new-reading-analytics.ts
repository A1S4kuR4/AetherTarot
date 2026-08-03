import type { AgentProfile, DrawSource } from "@aethertarot/shared-types";

export type NewReadingEventName =
  | "new_reading_category_selected"
  | "new_reading_prompt_selected"
  | "new_reading_prompts_refreshed"
  | "new_reading_spread_selected"
  | "new_reading_profile_selected"
  | "new_reading_draw_source_selected"
  | "new_reading_start_requested"
  | "new_reading_boundary_shown"
  | "new_reading_boundary_confirmed";

export interface NewReadingEventPayload {
  category?: string;
  drawSource?: DrawSource;
  profile?: AgentProfile;
  spreadId?: string;
  startMode?: "ritual" | "quick";
}

/**
 * Mirrors the existing share analytics contract without letting telemetry
 * interfere with the reading flow.
 */
export function trackNewReadingEvent(
  name: NewReadingEventName,
  payload: NewReadingEventPayload = {},
): void {
  if (typeof window === "undefined") return;

  try {
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ event: name, ...payload });
    } else if (process.env.NODE_ENV !== "production") {
      console.debug(`[new-reading] ${name}`, payload);
    }
  } catch {
    // Analytics must never break the reading flow.
  }
}
