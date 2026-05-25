import EncyclopediaView from "@/components/encyclopedia/EncyclopediaView";
import { isEncyclopediaQueryEnabled } from "@/server/beta/config";
import { getEncyclopediaCoverageSummary } from "@/server/encyclopedia/coverage";

export default async function EncyclopediaPage() {
  const coverage = await getEncyclopediaCoverageSummary();

  return (
    <EncyclopediaView
      coverage={coverage}
      isQuestionEnabled={isEncyclopediaQueryEnabled()}
    />
  );
}
