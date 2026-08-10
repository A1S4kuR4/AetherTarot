import HomeView from "@/components/home/HomeView";
import { getBetaOpsConfig } from "@/server/beta/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { anonymousDailyLimit } = getBetaOpsConfig();
  return <HomeView anonymousDailyReadingLimit={anonymousDailyLimit} />;
}
