const SOURCE_HREF_PREFIX = "aether-source:";
const DISABLED_HREF_PREFIX = "aether-disabled:";

const SOURCE_MAP: Record<string, string> = {
  "78W": "《78度的智慧》",
  "YAT": "《其实你已经很塔罗了》",
  "CTB": "《塔罗全书》",
  "MAN": "《塔罗牌使用说明书》",
  "SFB": "《塔罗葵花宝典》",
};

export function formatSourceLabel(sourceId: string): string {
  const normalizedId = sourceId.trim().toUpperCase();
  return SOURCE_MAP[normalizedId] ?? sourceId;
}

export function sourceHref(sourceId: string) {
  return `${SOURCE_HREF_PREFIX}${encodeURIComponent(sourceId.trim())}`;
}

export function isSourceHref(href: string | undefined) {
  return Boolean(href?.startsWith(SOURCE_HREF_PREFIX));
}

export function sourceLabelFromHref(href: string) {
  const rawLabel = decodeURIComponent(href.slice(SOURCE_HREF_PREFIX.length));
  return formatSourceLabel(rawLabel);
}

export function disabledHref(label: string) {
  return `${DISABLED_HREF_PREFIX}${encodeURIComponent(label.trim())}`;
}

export function isDisabledHref(href: string | undefined) {
  return Boolean(href?.startsWith(DISABLED_HREF_PREFIX));
}

export function disabledLabelFromHref(href: string) {
  return decodeURIComponent(href.slice(DISABLED_HREF_PREFIX.length));
}

export function prepareWikiMarkdown(content: string) {
  return content.replace(/\[来源:\s*([^\]]+)\]/g, (_, sourceId: string) => {
    const label = sourceId.trim();
    return `[来源: ${label}](${sourceHref(label)})`;
  });
}

function isCardWikiPath(path: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  return !(
    normalizedPath.includes("concepts/")
    || normalizedPath.includes("spreads/")
  );
}

export function mapWikiHref(href: string | undefined) {
  if (!href) {
    return "#";
  }

  if (isSourceHref(href) || isDisabledHref(href)) {
    return href;
  }

  if (/^https?:\/\//i.test(href) || href.startsWith("#")) {
    return href;
  }

  const pathWithoutHash = href.split("#")[0] ?? href;
  const match = pathWithoutHash.match(/([^/]+)\.md$/);

  if (!match?.[1]) {
    return href;
  }

  if (!isCardWikiPath(pathWithoutHash)) {
    return disabledHref(match[1]);
  }

  return `/encyclopedia?card=${encodeURIComponent(match[1])}`;
}
