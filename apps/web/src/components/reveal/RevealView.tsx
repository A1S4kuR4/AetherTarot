"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CardImage from "@/components/ui/CardImage";
import LegacyIcon from "@/components/ui/LegacyIcon";
import { useReading } from "@/context/ReadingContext";
import { getRevealCardImageUrl } from "@/lib/card-assets";
import { getSpreadExperience } from "@/lib/spreadExperience";
import { cn } from "@/lib/utils";
import styles from "./RevealView.module.css";

type RevealPosition = {
  x: number;
  y: number;
  rotate?: number;
};

type ShareStatus = "idle" | "sharing" | "copied" | "shared" | "error";

interface RevealSlotStyle extends CSSProperties {
  "--slot-x": string;
  "--slot-y": string;
  "--slot-rotation": string;
}

const REVEAL_LAYOUTS: Record<string, RevealPosition[]> = {
  single: [{ x: 0, y: 0 }],
  "holy-triangle": [
    { x: 0, y: -130 },
    { x: -110, y: 110 },
    { x: 110, y: 110 },
  ],
  "four-aspects": [
    { x: -115, y: -90 },
    { x: 115, y: -90 },
    { x: -115, y: 90 },
    { x: 115, y: 90 },
  ],
  "seven-card": [
    { x: -220, y: 0 },
    { x: -110, y: 0 },
    { x: 0, y: 0 },
    { x: 110, y: 0 },
    { x: 220, y: 0 },
    { x: 110, y: -140 },
    { x: 110, y: 140 },
  ],
  "celtic-cross": [
    { x: 0, y: 0 },
    { x: 0, y: 0, rotate: 90 },
    { x: 0, y: -105 },
    { x: 0, y: 105 },
    { x: -135, y: 0 },
    { x: 135, y: 0 },
    { x: 260, y: -168 },
    { x: 260, y: -84 },
    { x: 260, y: 0 },
    { x: 260, y: 84 },
  ],
};

const formatCount = (value: number) => String(value).padStart(2, "0");

function getFallbackLayout(count: number): RevealPosition[] {
  const columns = Math.min(count, 5);
  const columnGap = 110;

  return Array.from({ length: count }, (_, index) => ({
    x: (index % columns - (columns - 1) / 2) * columnGap,
    y: (Math.floor(index / columns) - 0.5) * 160,
  }));
}

export default function RevealView() {
  const router = useRouter();
  const { question, selectedSpread, drawSource, drawnCards, isHydrated } = useReading();
  const [isEnteringReading, setIsEnteringReading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const shouldReduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!selectedSpread || !question.trim()) {
      router.replace("/");
      return;
    }

    if (drawnCards.length === 0) {
      router.replace(drawSource === "offline_manual" ? "/offline-draw" : "/ritual");
    }
  }, [drawSource, drawnCards.length, isHydrated, question, router, selectedSpread]);

  if (!isHydrated || !selectedSpread || drawnCards.length === 0) {
    return null;
  }

  const spreadExperience = getSpreadExperience(
    selectedSpread.id,
    selectedSpread.name,
    selectedSpread.positions.map((position) => position.name),
  );
  const positionLayout =
    REVEAL_LAYOUTS[selectedSpread.id]
    ?? getFallbackLayout(selectedSpread.positions.length);
  const cardImageWidth = selectedSpread.positions.length >= 7 ? 180 : 240;
  const cardCount = selectedSpread.positions.length;

  const handleEnterReading = () => {
    if (isEnteringReading) {
      return;
    }

    setIsEnteringReading(true);
    router.push("/reading");
  };

  const enterReadingButtonLabel = isEnteringReading
    ? "正在进入深读..."
    : "带着整组气候进入深读";
  const shareButtonLabel =
    shareStatus === "sharing"
      ? "正在准备分享..."
      : shareStatus === "copied"
        ? "牌阵摘要已复制"
        : shareStatus === "shared"
          ? "牌阵已交给系统分享"
          : shareStatus === "error"
            ? "复制失败，请重试"
            : "保存或分享本次牌阵";

  const handleSaveOrShare = async () => {
    if (shareStatus === "sharing") {
      return;
    }

    const cardSummary = selectedSpread.positions
      .map((position, index) => {
        const drawn = drawnCards.find((card) => card.positionId === position.id);
        const cardName = drawn
          ? `${drawn.card.name}${drawn.isReversed ? "（逆位）" : ""}`
          : "尚未归位";

        return `${formatCount(index + 1)} ${position.name} · ${cardName}`;
      })
      .join("\n");
    const shareText = `灵语塔罗 · ${selectedSpread.name}\n${cardSummary}`;

    setShareStatus("sharing");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `灵语塔罗 · ${selectedSpread.name}`,
          text: shareText,
        });
        setShareStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setShareStatus("idle");
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  };

  return (
    <section className={styles.stage}>
      <section className={styles.altarPane} aria-label="牌阵祭坛">
        <h1
          className={styles.plaque}
          aria-label={`揭示 · ${selectedSpread.name} · ${cardCount} 张牌`}
        >
          <span className={cn(styles.plaqueSegment, styles.plaqueKicker)}>
            <span className={styles.statusDot} aria-hidden="true" />
            揭示 · REVEAL
          </span>
          <span className={cn(styles.plaqueSegment, styles.plaqueName)}>
            {selectedSpread.name}
          </span>
          <span className={cn(styles.plaqueSegment, styles.plaqueCount)}>
            {formatCount(drawnCards.length)} / {formatCount(cardCount)}
          </span>
        </h1>

        <div className={styles.altar} data-spread={selectedSpread.id} data-count={cardCount}>
          <div className={styles.rings} aria-hidden="true">
            <span className={cn(styles.axis, styles.axisHorizontal)} />
            <span className={cn(styles.axis, styles.axisVertical)} />
            <span className={cn(styles.ring, styles.ringOuter)} />
            <span className={cn(styles.ring, styles.ringInner)} />
            <span className={styles.centerMark} />
            {Array.from({ length: 24 }, (_, index) => (
              <span
                key={`reveal-tick-${index}`}
                className={styles.tick}
                style={{ transform: `rotate(${index * 15}deg) translateY(-319px)` }}
              />
            ))}
          </div>

          <ol
            data-testid="reveal-card-track"
            className={styles.positionTrack}
            aria-label={`${selectedSpread.name}牌面`}
          >
            {selectedSpread.positions.map((position, index) => {
              const drawn = drawnCards.find(
                (card) => card.positionId === position.id,
              );

              if (!drawn) {
                return null;
              }

              const layout = positionLayout[index] ?? { x: 0, y: 0 };
              const slotStyle: RevealSlotStyle = {
                "--slot-x": `${layout.x}px`,
                "--slot-y": `${layout.y}px`,
                "--slot-rotation": `${layout.rotate ?? 0}deg`,
                zIndex: selectedSpread.id === "celtic-cross" && index === 1 ? 30 : 20,
              };
              const isMajorArcana = drawn.card.arcana
                .toLowerCase()
                .startsWith("major");

              return (
                <motion.li
                  key={position.id}
                  className={cn("reveal-card-container", styles.position)}
                  style={slotStyle}
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.55,
                    delay: shouldReduceMotion ? 0 : index * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <div
                    className={cn(
                      styles.cardFrame,
                      isMajorArcana && styles.majorCard,
                    )}
                  >
                    <div className={styles.cardImageShell}>
                      <CardImage
                        src={getRevealCardImageUrl(drawn.card.imageUrl)}
                        alt={`${position.name}：${drawn.card.name}${drawn.isReversed ? "，逆位" : ""}`}
                        intrinsicWidth={cardImageWidth}
                        sizes="(min-width: 1024px) 120px, 42vw"
                        quality={75}
                        priority={index < 3}
                        loading="eager"
                        isReversed={drawn.isReversed}
                        className={styles.cardImage}
                      />
                    </div>
                    <span className={styles.positionMarker} aria-hidden="true">
                      {formatCount(index + 1)}
                    </span>
                    {drawn.isReversed ? (
                      <span className={styles.reversedBadge}>逆位</span>
                    ) : null}
                  </div>

                  <div className={styles.positionLabel}>
                    <span className={styles.positionIndex}>{formatCount(index + 1)}</span>
                    <span className={styles.positionName}>{position.name}</span>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>

        <div className={styles.altarNote}>
          <span className={styles.altarNoteLabel}>牌阵已揭示</span>
          <p>{selectedSpread.description}</p>
        </div>
      </section>

      <aside className={styles.folioPane} aria-label="解读卷宗">
        <header className={styles.folioHeader}>
          <p className={styles.folioKicker}>READING FOLIO / 解读卷宗</p>
          <h2>{selectedSpread.name}</h2>
        </header>

        <section className={styles.questionBlock} aria-labelledby="reveal-question-label">
          <h3 id="reveal-question-label">本次问询</h3>
          <p>{question}</p>
        </section>

        <section
          className={styles.readingPath}
          data-testid="reveal-reading-path"
          aria-labelledby="reveal-reading-path-title"
        >
          <h3 id="reveal-reading-path-title">
            <span className={styles.pathDot} aria-hidden="true" />
            阅读路径
          </h3>
          <p>{spreadExperience.revealFocus}</p>
          <ol className={styles.pathSteps}>
            {spreadExperience.organizationModel.map((item, index) => (
              <li key={`${selectedSpread.id}-organization-${item}`}>
                <span>{formatCount(index + 1)}</span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.positionSection} aria-labelledby="position-meanings-title">
          <h3 id="position-meanings-title" className={styles.folioKicker}>
            POSITION MEANINGS / 牌阵解析
          </h3>
          <ol className={styles.positionList}>
            {selectedSpread.positions.map((position, index) => {
              const drawn = drawnCards.find(
                (card) => card.positionId === position.id,
              );

              return (
                <li key={position.id}>
                  <div className={styles.positionItemHeading}>
                    <span>{formatCount(index + 1)}</span>
                    <h4>{position.name}</h4>
                  </div>
                  <p className={styles.positionCardName}>
                    {drawn
                      ? `${drawn.card.name}${drawn.isReversed ? " · 逆位" : ""}`
                      : "尚未归位"}
                  </p>
                  <p className={styles.positionDescription}>{position.description}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleEnterReading}
            disabled={isEnteringReading}
            className="btn-primary min-h-12 w-full !rounded-none"
          >
            <span>{enterReadingButtonLabel}</span>
            <LegacyIcon name="arrow_right_alt" className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => void handleSaveOrShare()}
            disabled={shareStatus === "sharing"}
            className="btn-secondary-dark min-h-11 w-full !rounded-none"
          >
            <LegacyIcon name="ios_share" className="text-base" />
            <span aria-live="polite">{shareButtonLabel}</span>
          </button>
        </div>
      </aside>
    </section>
  );
}
