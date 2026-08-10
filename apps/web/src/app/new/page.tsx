import RitualInitializer from "@/components/home/RitualInitializer";
import { getBetaOpsConfig } from "@/server/beta/config";

export const dynamic = "force-dynamic";

export default function NewReadingPage() {
  const { anonymousDailyLimit } = getBetaOpsConfig();

  return (
    <div className="new-reading-page">
      <RitualInitializer anonymousDailyReadingLimit={anonymousDailyLimit} />
    </div>
  );
}
