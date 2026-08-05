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
    <div className="border-y border-safety/40 py-8 md:py-10">
      <div className="flex items-center gap-3">
        <LegacyIcon name="gavel" className="text-2xl text-safety-ink" />
        <h2 className="font-serif text-2xl text-safety-ink">界限阻断</h2>
      </div>
      <p className="mt-4 text-base leading-relaxed text-text-body">{reason}</p>
      {referralLinks && referralLinks.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="font-sans text-xs font-semibold text-safety-ink">
            现实支持资源：
          </p>
          <div className="flex flex-col gap-2">
            {referralLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-accent underline underline-offset-2 hover:text-terracotta-ink"
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
          className="min-h-11 border border-paper-border px-5 py-2 text-sm text-ink transition-colors hover:border-terracotta hover:text-terracotta"
        >
          离开并返回首页
        </button>
      </div>
    </div>
  );
}
