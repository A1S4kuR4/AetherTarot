import type { ShareMode } from "./constants";

export type ShareEventName =
  | "share_dialog_open"
  | "share_mode_select"
  | "share_image_generated"
  | "share_image_failed"
  | "share_completed"
  | "share_downloaded";

export interface ShareEventPayload {
  mode?: ShareMode;
  cardCount?: number;
  error?: string;
}

/**
 * Minimal share analytics. Pushes to window.dataLayer when a tag manager
 * provides one; otherwise logs in development. Must never break the flow.
 */
export function trackShareEvent(
  name: ShareEventName,
  payload: ShareEventPayload = {},
): void {
  if (typeof window === "undefined") return;

  try {
    const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push({ event: name, ...payload });
    } else if (process.env.NODE_ENV !== "production") {
      console.debug(`[share] ${name}`, payload);
    }
  } catch {
    // Analytics must never break the share flow.
  }
}
