export const GROWTH_EVENT_TYPES = [
  "page_view",
  "reading_started",
  "reading_completed",
  "feedback_submitted",
] as const;

export type GrowthEventType = (typeof GROWTH_EVENT_TYPES)[number];

export interface StoredGrowthAttribution {
  attributionId: string;
  capturedAt: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPath: string;
  referrerHost: string | null;
}

interface GrowthContext {
  attribution: StoredGrowthAttribution;
  sessionId: string;
}

const ATTRIBUTION_STORAGE_KEY = "aethertarot:growth-attribution:v1";
const SESSION_ID_STORAGE_KEY = "aethertarot:growth-session:v1";
const CURRENT_FLOW_STORAGE_KEY = "aethertarot:growth-reading-flow:v1";
const EVENT_DEDUP_PREFIX = "aethertarot:growth-event:v1:";
const ATTRIBUTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;

let memoryContext: GrowthContext | null = null;
let memoryFlowId: string | null = null;
const memoryDedupKeys = new Set<string>();

export function normalizeGrowthValue(
  value: string | null | undefined,
  maxLength = 120,
) {
  if (!value) return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeLandingPath(pathname: string) {
  const normalized = normalizeGrowthValue(pathname, 256);
  return normalized?.startsWith("/") ? normalized : "/";
}

function getReferrerHost(referrer: string, currentHost: string) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && host !== currentHost.toLowerCase()
      ? normalizeGrowthValue(host, 255)
      : null;
  } catch {
    return null;
  }
}

function isStoredAttribution(value: unknown): value is StoredGrowthAttribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<StoredGrowthAttribution>;
  return (
    typeof record.attributionId === "string"
    && UUID_PATTERN.test(record.attributionId)
    && typeof record.capturedAt === "number"
    && Number.isFinite(record.capturedAt)
    && typeof record.landingPath === "string"
  );
}

function createUuid() {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {}
}

function readStoredAttribution(now: number) {
  const raw = readStorage(window.localStorage, ATTRIBUTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      isStoredAttribution(parsed)
      && now - parsed.capturedAt <= ATTRIBUTION_MAX_AGE_MS
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function getSessionId() {
  const existing = readStorage(window.sessionStorage, SESSION_ID_STORAGE_KEY);
  if (existing && UUID_PATTERN.test(existing)) return existing;
  const created = createUuid();
  if (created) writeStorage(window.sessionStorage, SESSION_ID_STORAGE_KEY, created);
  return created;
}

export function parseGrowthAttribution({
  search,
  pathname,
  referrer,
  currentHost,
  now,
  attributionId,
}: {
  search: string;
  pathname: string;
  referrer: string;
  currentHost: string;
  now: number;
  attributionId: string;
}): StoredGrowthAttribution {
  const params = new URLSearchParams(search);
  const values = Object.fromEntries(
    UTM_KEYS.map((key) => [
      key,
      normalizeGrowthValue(params.get(`utm_${key}`)),
    ]),
  ) as Record<(typeof UTM_KEYS)[number], string | null>;

  return {
    attributionId,
    capturedAt: now,
    utmSource: values.source,
    utmMedium: values.medium,
    utmCampaign: values.campaign,
    utmContent: values.content,
    utmTerm: values.term,
    landingPath: normalizeLandingPath(pathname),
    referrerHost: getReferrerHost(referrer, currentHost),
  };
}

function initializeGrowthContext(): GrowthContext | null {
  if (typeof window === "undefined") return null;
  if (memoryContext) return memoryContext;

  const sessionId = getSessionId();
  if (!sessionId) return null;

  const now = Date.now();
  const params = new URLSearchParams(window.location.search);
  const hasCampaign = UTM_KEYS.some((key) =>
    Boolean(normalizeGrowthValue(params.get(`utm_${key}`))),
  );
  const existing = readStoredAttribution(now);
  const attributionId = hasCampaign || !existing
    ? createUuid()
    : existing.attributionId;

  if (!attributionId) return null;

  const attribution = hasCampaign || !existing
    ? parseGrowthAttribution({
      search: window.location.search,
      pathname: window.location.pathname,
      referrer: document.referrer,
      currentHost: window.location.hostname,
      now,
      attributionId,
    })
    : existing;

  writeStorage(
    window.localStorage,
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );
  memoryContext = { attribution, sessionId };
  return memoryContext;
}

function getCurrentFlowId() {
  if (memoryFlowId) return memoryFlowId;
  const existing = readStorage(window.sessionStorage, CURRENT_FLOW_STORAGE_KEY);
  if (existing && UUID_PATTERN.test(existing)) {
    memoryFlowId = existing;
    return existing;
  }
  return null;
}

function markEventOnce(key: string) {
  if (memoryDedupKeys.has(key)) return false;
  const storageKey = `${EVENT_DEDUP_PREFIX}${key}`;
  if (readStorage(window.sessionStorage, storageKey) === "1") return false;
  memoryDedupKeys.add(key);
  writeStorage(window.sessionStorage, storageKey, "1");
  return true;
}

function sendGrowthEvent({
  eventType,
  flowId = null,
  readingId = null,
  dedupKey,
}: {
  eventType: GrowthEventType;
  flowId?: string | null;
  readingId?: string | null;
  dedupKey?: string;
}) {
  const context = initializeGrowthContext();
  const eventId = createUuid();
  if (!context || !eventId) return;
  if (dedupKey && !markEventOnce(dedupKey)) return;

  const { attribution, sessionId } = context;
  void fetch("/api/growth-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      session_id: sessionId,
      attribution_id: attribution.attributionId,
      flow_id: flowId,
      reading_id: readingId,
      utm_source: attribution.utmSource,
      utm_medium: attribution.utmMedium,
      utm_campaign: attribution.utmCampaign,
      utm_content: attribution.utmContent,
      utm_term: attribution.utmTerm,
      landing_path: attribution.landingPath,
      referrer_host: attribution.referrerHost,
    }),
  }).catch(() => undefined);
}

export function captureGrowthVisit() {
  const context = initializeGrowthContext();
  if (!context) return;
  sendGrowthEvent({
    eventType: "page_view",
    dedupKey: `page_view:${context.sessionId}`,
  });
}

export function beginGrowthReadingFlow() {
  const flowId = createUuid();
  if (!flowId || typeof window === "undefined") return null;
  memoryFlowId = flowId;
  writeStorage(window.sessionStorage, CURRENT_FLOW_STORAGE_KEY, flowId);
  sendGrowthEvent({ eventType: "reading_started", flowId });
  return flowId;
}

export function trackGrowthReadingCompleted(readingId: string) {
  if (typeof window === "undefined") return;
  const flowId = getCurrentFlowId();
  if (!flowId) return;
  sendGrowthEvent({
    eventType: "reading_completed",
    flowId,
    readingId,
    dedupKey: `reading_completed:${readingId}`,
  });
}

export function trackGrowthFeedbackSubmitted(readingId: string) {
  if (typeof window === "undefined") return;
  const flowId = getCurrentFlowId();
  if (!flowId) return;
  sendGrowthEvent({
    eventType: "feedback_submitted",
    flowId,
    readingId,
    dedupKey: `feedback_submitted:${readingId}`,
  });
}
