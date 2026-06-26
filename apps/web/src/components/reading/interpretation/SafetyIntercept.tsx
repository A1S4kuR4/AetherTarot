"use client";

import { useRouter } from "next/navigation";
import LegacyIcon from "@/components/ui/LegacyIcon";

interface SafetyInterceptProps {
  reason: string;
  referralLinks?: string[];
}

export function SafetyIntercept({ reason, referralLinks }: SafetyInterceptProps) {
  const router = useRouter();

  return (
    <div className="reading-card border-red-900/30 bg-red-950/10 ring-1 ring-inset ring-red-900/20">
      <div className="flex items-center gap-3 border-b border-red-900/20 pb-4">
        <LegacyIcon name="gavel" className="text-3xl text-red-500" />
        <h2 className="font-serif text-2xl text-red-400">界限阻断</h2>
      </div>
      <p className="mt-5 text-base leading-relaxed text-red-200">{reason}</p>
      {referralLinks && referralLinks.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="font-sans text-xs uppercase tracking-wider text-red-400/80">
            现实支持资源：
          </p>
          <div className="flex flex-col gap-2">
            {referralLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-300 underline hover:text-red-200"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="rounded-full border border-paper-border bg-paper px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-paper-raised"
        >
          离开并返回首页
        </button>
      </div>
    </div>
  );
}
