import EncyclopediaView from "@/components/encyclopedia/EncyclopediaView";
import { isEncyclopediaQueryEnabled } from "@/server/beta/config";
import { getEncyclopediaCoverageSummary } from "@/server/encyclopedia/coverage";
import { loadEncyclopediaWikiPages } from "@/server/encyclopedia/wiki";
import {
  buildCardWikiSummaries,
  countEncyclopediaWikiPages,
} from "@/server/encyclopedia/wiki-summary";

export const dynamic = "force-dynamic";

type EncyclopediaSearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EncyclopediaPage({
  searchParams,
}: {
  searchParams?: EncyclopediaSearchParams;
}) {
  const [coverage, wikiPages, params] = await Promise.all([
    getEncyclopediaCoverageSummary(),
    loadEncyclopediaWikiPages(),
    searchParams,
  ]);

  return (
    <EncyclopediaView
      coverage={coverage}
      cardWikiPages={buildCardWikiSummaries(wikiPages)}
      initialCardId={firstSearchValue(params?.card) ?? null}
      isQuestionEnabled={isEncyclopediaQueryEnabled()}
      knowledgeCounts={countEncyclopediaWikiPages(wikiPages)}
    />
  );
}
