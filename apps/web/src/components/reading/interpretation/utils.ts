export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function formatFallbackSentence(keywords: string[]): string {
  const valid = uniqueStrings(keywords);
  if (valid.length === 0) {
    return "本次解读的脉络正围绕着你当下的议题展开。";
  }
  if (valid.length === 1) {
    return `本次解读的脉络正围绕着：${valid[0]} 展开。`;
  }
  const last = valid.at(-1);
  const rest = valid.slice(0, -1).join("、");
  return `本次解读的脉络正围绕着：${rest} 与 ${last} 展开。`;
}

export function getLeadSentence(value: string, fallbackKeywords: string[]): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return formatFallbackSentence(fallbackKeywords);
  }

  const match = normalized.match(/^.+?[。！？!?]/);
  const sentence = match?.[0] ?? normalized;

  if (sentence.length <= 65) {
    return sentence;
  }

  return formatFallbackSentence(fallbackKeywords);
}
