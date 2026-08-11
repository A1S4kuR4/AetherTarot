import type { ReadingHistoryEntry } from "@aethertarot/shared-types";
import {
  readGuestHistory,
  updateGuestHistoryNotes,
  type GuestHistoryLockManager,
} from "@/lib/guest-reading-history";

export type ReadingIdentity = { kind: "guest" } | { kind: "account"; id: string };

export async function loadIdentityHistory({
  identity,
  storage,
  fetchImplementation,
  signal,
}: {
  identity: ReadingIdentity;
  storage: Pick<Storage, "getItem">;
  fetchImplementation: typeof fetch;
  signal?: AbortSignal;
}) {
  if (identity.kind === "guest") return readGuestHistory(storage);
  const response = await fetchImplementation("/api/readings", { cache: "no-store", signal });
  if (!response.ok) return [];
  const payload = await response.json() as { readings?: ReadingHistoryEntry[] };
  return Array.isArray(payload.readings) ? payload.readings : [];
}

export async function saveIdentityNotes({
  identity,
  storage,
  fetchImplementation,
  readingId,
  notes,
  signal,
  guestLockManager,
  guestShouldCommit,
}: {
  identity: ReadingIdentity;
  storage: Pick<Storage, "getItem" | "setItem">;
  fetchImplementation: typeof fetch;
  readingId: string;
  notes: string;
  signal?: AbortSignal;
  guestLockManager?: GuestHistoryLockManager;
  guestShouldCommit?: () => boolean;
}) {
  if (identity.kind === "guest") {
    return {
      status: "saved_to_browser" as const,
      history: await updateGuestHistoryNotes(
        storage,
        readingId,
        notes,
        guestLockManager,
        guestShouldCommit,
      ),
    };
  }
  const response = await fetchImplementation("/api/readings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reading_id: readingId, user_notes: notes }),
    signal,
  });
  if (!response.ok) return { status: "failed" as const, history: null };
  return { status: "synced" as const, history: null };
}
