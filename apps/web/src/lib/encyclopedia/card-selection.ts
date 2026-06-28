export function resolveInitialCardId({
  requestedCardId,
  fallbackCardId,
  knownCardIds,
}: {
  requestedCardId: string | null | undefined;
  fallbackCardId: string;
  knownCardIds: string[];
}) {
  if (requestedCardId && knownCardIds.includes(requestedCardId)) {
    return requestedCardId;
  }

  const runtimeMajorId = requestedCardId?.replace(/^the-/, "");

  return runtimeMajorId && knownCardIds.includes(runtimeMajorId)
    ? runtimeMajorId
    : fallbackCardId;
}
