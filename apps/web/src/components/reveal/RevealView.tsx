"use client";

import { motion, useAnimate } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useReading } from "@/context/ReadingContext";
import { cn } from "@/lib/utils";
import { getSpreadExperience } from "@/lib/spreadExperience";
import LegacyIcon from "@/components/ui/LegacyIcon";

export default function RevealView() {
  const router = useRouter();
  const { selectedSpread, drawSource, drawnCards } = useReading();
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (drawnCards.length > 0 && selectedSpread) {
      animate(
        ".reveal-card-container",
        { opacity: [0, 1], y: [40, 0] },
        { duration: 0.6, ease: "easeOut", delay: (el, i) => i * 0.3 }
      );
      animate(
        ".reveal-card-inner",
        { rotateY: [180, 0] },
        { duration: 0.8, type: "spring", delay: (el, i) => i * 0.3 + 0.15 }
      );
    }
  }, [animate, drawnCards.length, selectedSpread]);

  useEffect(() => {
    if (!selectedSpread) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace(drawSource === "offline_manual" ? "/offline-draw" : "/ritual");
    }
  }, [drawSource, drawnCards.length, router, selectedSpread]);

  if (!selectedSpread || drawnCards.length === 0) {
    return null;
  }

  const spreadCardGridClass =
    selectedSpread.positions.length === 1
      ? "max-w-sm grid-cols-1"
      : selectedSpread.positions.length === 3
        ? "md:grid-cols-3"
      : selectedSpread.positions.length === 4
          ? "md:grid-cols-2 xl:grid-cols-4"
          : selectedSpread.positions.length === 7
            ? "md:grid-cols-2 xl:grid-cols-4"
          : "md:grid-cols-2 xl:grid-cols-3";
  const spreadExperience = getSpreadExperience(
    selectedSpread.id,
    selectedSpread.name,
    selectedSpread.positions.map((position) => position.name),
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pt-12 pb-10">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted">
          牌阵揭示
        </span>
        <h1 className="font-serif text-3xl font-semibold text-text-inverse md:text-5xl">
          {selectedSpread.name}
        </h1>
      </div>

      <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-midnight-border bg-midnight-panel/60 px-6 py-5 text-center">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-indigo/80">
          先看整组牌的气候
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-inverse-muted">
          {drawSource === "offline_manual"
            ? `这些牌来自你的线下抽取，但你已经用 ${selectedSpread.name} 选择了观察角度。`
            : `这些牌的出现仍然带有随机性，但你已经用 ${selectedSpread.name} 选择了观察角度。`}
          接下来请先感受整组牌在不同位置形成的张力，而不是急着把它们听成一个确定答案。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-inverse">
          {spreadExperience.revealFocus}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
        {/* Card Spread Area */}
        <div className="relative flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-midnight-border bg-midnight-panel/50 px-8 pt-16 pb-8 lg:col-span-8">
          {/* Spread Cards */}
          <div ref={scope} className={cn("relative z-10 grid w-full max-w-4xl grid-cols-1 gap-10", spreadCardGridClass)}>
            {selectedSpread.positions.map((position, index) => {
              const drawn = drawnCards.find(
                (card) => card.positionId === position.id,
              );

              if (!drawn) {
                return null;
              }

              return (
                <div
                  key={position.id}
                  className={cn(
                    "reveal-card-container group flex flex-col items-center opacity-0",
                    selectedSpread.id === "holy-triangle" && index === 1 && "md:-mt-12",
                  )}
                >
                  {/* Position label */}
                  <div className="mb-3">
                    <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-text-inverse-muted/50">
                      {position.name}
                    </span>
                  </div>

                  {/* Card 3D Container */}
                  <div className="w-full" style={{ perspective: 1000 }}>
                    <motion.div
                      className={cn(
                        "reveal-card-inner relative aspect-[1/1.7] w-full overflow-hidden rounded-card-lg border shadow-[0_0_30px_rgba(113,112,255,0.15)] transition-transform duration-500 hover:scale-[1.02]",
                        index === 1
                          ? "border-indigo/20 shadow-[0_0_40px_rgba(113,112,255,0.25)]"
                          : "border-midnight-border",
                      )}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <img
                        src={drawn.card.imageUrl}
                        alt={drawn.card.name}
                        className={cn(
                          "h-full w-full object-cover",
                          drawn.isReversed && "rotate-180",
                        )}
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  </div>

                  {/* Card info */}
                  <div className="mt-5 text-center">
                    <h3 className="font-serif text-lg text-text-inverse">
                      {drawn.card.name}
                    </h3>
                    <span className="block text-xs text-text-inverse-muted">
                      {drawn.card.englishName}
                    </span>
                    {drawn.isReversed && (
                      <span className="mt-1 block font-sans text-[9px] font-bold uppercase tracking-[0.15em] text-indigo/60">
                        逆位 · REVERSED
                      </span>
                    )}
                    <div className="mt-2 flex justify-center gap-1.5">
                      {(drawn.isReversed
                        ? drawn.card.reversedKeywords
                        : drawn.card.uprightKeywords
                      )
                        .slice(0, 2)
                        .map((keyword) => (
                          <span key={keyword} className="chip-dark text-[10px]">
                            {keyword}
                          </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => router.push("/reading")}
            className="btn-primary mt-14"
          >
            <span className="text-sm font-medium">带着整组气候进入深读</span>
            <LegacyIcon name="arrow_right_alt" className="text-lg" />
          </button>
        </div>

        {/* Side Panel — Position Meanings */}
        <div className="space-y-6 lg:col-span-4">
          <div className="midnight-panel">
            <div className="mb-3 flex items-center gap-2.5">
              <LegacyIcon name="flare" className="text-lg text-terracotta" />
              <h2 className="font-serif text-lg text-text-inverse">
                阅读容器
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              {drawSource === "offline_manual"
                ? "你在线下完成抽取，系统只接收牌面与正逆位。牌阵负责把这些实体牌结果组织成可阅读的结构。"
                : "你没有在操纵结果，而是在选择一副观看问题的镜框。随机给出牌面，牌阵负责把这些偶然组织成可阅读的结构。"}
            </p>
          </div>

          <div className="midnight-panel">
            <div className="mb-4 flex items-center gap-2.5">
              <LegacyIcon name="travel_explore" className="text-lg text-terracotta" />
              <h2 className="font-serif text-lg text-text-inverse">
                本轮观察重点
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              {spreadExperience.revealFocus}
            </p>
          </div>

          <div className="midnight-panel">
            <div className="mb-4 flex items-center gap-2.5">
              <LegacyIcon name="account_tree" className="text-lg text-indigo" />
              <h2 className="font-serif text-lg text-text-inverse">
                牌阵如何组织随机
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-inverse-muted">
              {drawSource === "offline_manual"
                ? `线下抽取决定哪张牌进入哪个位置；${selectedSpread.name} 决定阅读顺序、位置语义与综合路径。`
                : `随机决定哪张牌进入哪个位置；${selectedSpread.name} 决定阅读顺序、位置语义与综合路径。`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {spreadExperience.organizationModel.map((item, index) => (
                <span
                  key={`${selectedSpread.id}-organization-${item}`}
                  className="rounded-full border border-midnight-border bg-midnight-elevated/60 px-3 py-1.5 font-sans text-[11px] text-text-inverse-muted"
                >
                  {index + 1}. {item}
                </span>
              ))}
            </div>
          </div>

          <div className="midnight-panel">
            <div className="mb-5 flex items-center gap-2.5">
              <LegacyIcon name="auto_awesome" className="text-lg text-indigo" />
              <h2 className="font-serif text-lg text-text-inverse">
                牌阵解析
              </h2>
            </div>
            <div className="space-y-6">
              {selectedSpread.positions.map((position, index) => (
                <div
                  key={position.id}
                  className="relative border-l border-midnight-border pl-5"
                >
                  <div
                    className={cn(
                      "absolute top-0.5 -left-[4px] h-2 w-2 rounded-full",
                      selectedSpread.id === "holy-triangle" && index === 1
                        ? "bg-indigo/50"
                        : "bg-text-inverse-muted/30",
                    )}
                  />
                  <h4
                    className={cn(
                      "mb-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em]",
                      "text-text-inverse-muted",
                    )}
                  >
                    位置 {index + 1}: {position.name}
                  </h4>
                  <p className="text-sm leading-relaxed text-text-inverse-muted/70">
                    {position.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-midnight-border-subtle p-5">
            <p className="text-center font-serif text-sm leading-relaxed italic text-text-inverse-muted/60">
              在星辰的指引下，所有的偶然都像是更深层线索的显影。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
