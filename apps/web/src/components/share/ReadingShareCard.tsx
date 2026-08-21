"use client";

import { getRevealCardImageUrl } from "@/lib/card-assets";
import { cn } from "@/lib/utils";
import {
  getContentBudget,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_FIXED_COPY,
  type ShareMode,
} from "./constants";
import type { ShareCardModel } from "./share-model";
import { truncateByCharBudget, truncateLinesByBudget } from "./share-image";

interface ReadingShareCardProps {
  model: ShareCardModel;
}

// Usable text width inside card sections: card 600 − main px-8×2 − section px-4×2.
// Used to estimate chars-per-line for CJK text (≈1em per grapheme).
const TEXT_CONTAINER_WIDTH = 504;

function formatExportedDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

interface CardLayout {
  rows: number[];
  width: number;
  gap: number;
  rowGap: number;
}

function getCardLayout(
  count: number,
  mode: ShareMode,
  compactSummary: boolean,
): CardLayout {
  if (mode === "minimal") {
    switch (count) {
      case 1:
        return { rows: [1], width: 240, gap: 0, rowGap: 0 };
      case 2:
        return { rows: [2], width: 175, gap: 16, rowGap: 0 };
      case 3:
        return { rows: [3], width: 145, gap: 14, rowGap: 0 };
      case 4:
        return { rows: [2, 2], width: 122, gap: 14, rowGap: 10 };
      case 5:
        return { rows: [3, 2], width: 122, gap: 14, rowGap: 10 };
      case 6:
        return { rows: [3, 3], width: 122, gap: 14, rowGap: 10 };
      case 7:
        return { rows: [4, 3], width: 102, gap: 12, rowGap: 8 };
      case 8:
        return { rows: [4, 4], width: 102, gap: 12, rowGap: 8 };
      case 9:
        return { rows: [3, 3, 3], width: 85, gap: 10, rowGap: 8 };
      case 10:
        return { rows: [5, 5], width: 86, gap: 10, rowGap: 6 };
    }
  }

  if (compactSummary) {
    switch (count) {
      case 1:
        return { rows: [1], width: 115, gap: 0, rowGap: 0 };
      case 2:
        return { rows: [2], width: 88, gap: 12, rowGap: 0 };
      case 3:
        return { rows: [3], width: 74, gap: 10, rowGap: 0 };
      case 4:
        return { rows: [2, 2], width: 58, gap: 8, rowGap: 5 };
      case 5:
        return { rows: [3, 2], width: 56, gap: 8, rowGap: 5 };
      case 6:
        return { rows: [3, 3], width: 54, gap: 8, rowGap: 5 };
      case 7:
        return { rows: [4, 3], width: 52, gap: 6, rowGap: 4 };
      case 8:
        return { rows: [4, 4], width: 50, gap: 6, rowGap: 4 };
      case 9:
        return { rows: [5, 4], width: 48, gap: 5, rowGap: 4 };
      case 10:
        return { rows: [5, 5], width: 46, gap: 5, rowGap: 4 };
    }
  }

  switch (count) {
    case 1:
      return { rows: [1], width: 130, gap: 0, rowGap: 0 };
    case 2:
      return { rows: [2], width: 100, gap: 14, rowGap: 0 };
    case 3:
      return { rows: [3], width: 84, gap: 10, rowGap: 0 };
    case 4:
      return { rows: [2, 2], width: 64, gap: 10, rowGap: 5 };
    case 5:
      return { rows: [3, 2], width: 62, gap: 8, rowGap: 5 };
    case 6:
      return { rows: [3, 3], width: 60, gap: 8, rowGap: 5 };
    case 7:
      return { rows: [4, 3], width: 58, gap: 6, rowGap: 4 };
    case 8:
      return { rows: [4, 4], width: 56, gap: 6, rowGap: 4 };
    case 9:
      return { rows: [5, 4], width: 54, gap: 5, rowGap: 4 };
    case 10:
      return { rows: [5, 5], width: 52, gap: 5, rowGap: 4 };
  }

  return { rows: [count], width: 52, gap: 5, rowGap: 0 };
}

function CardGrid({
  model,
  compactSummary = false,
}: {
  model: ShareCardModel;
  compactSummary?: boolean;
}) {
  const { cards, mode } = model;
  const count = cards.length;
  const layout = getCardLayout(count, mode, compactSummary);

  const rows = layout.rows.map((rowCount, rowIndex) => {
    const start = layout.rows
      .slice(0, rowIndex)
      .reduce((sum, prevCount) => sum + prevCount, 0);
    return cards.slice(start, start + rowCount);
  });

  return (
    <div className="flex flex-col items-center" style={{ gap: layout.rowGap }}>
      {rows.map((rowCards, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-start justify-center"
          style={{ gap: layout.gap }}
        >
          {rowCards.map((card) => (
            <CardFigure
              key={card.positionId}
              card={card}
              width={layout.width}
              showPositionLabel
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// At 8+ cards the summary-mode grid shrinks card faces below recognition
// (≤56px). A compact text list keeps every position legible and returns
// vertical space to the reading text. Minimal mode is unaffected.
function CompactCardList({ cards }: { cards: ShareCardModel["cards"] }) {
  return (
    <div
      data-testid="reading-share-card-list"
      className="grid grid-cols-2 gap-x-4 gap-y-1.5"
    >
      {cards.map((card, index) => (
        <div
          key={card.positionId}
          data-testid="reading-share-card-item"
          className="flex items-baseline gap-1.5 text-[11px] leading-snug"
        >
          <span className="shrink-0 font-mono text-[9px] font-semibold text-terracotta-ink">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="shrink-0 font-sans text-text-muted">
            {card.position}
          </span>
          <span className="truncate font-aether-serif text-text-accent">
            {card.name}
            <span
              className={cn(
                "ml-1 font-mono text-[9px] tracking-[0.08em] text-text-muted",
                card.orientation === "reversed" && "text-indigo-ink",
              )}
            >
              ·{" "}
              {card.orientation === "reversed"
                ? SHARE_FIXED_COPY.positionReversed
                : SHARE_FIXED_COPY.positionUpright}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

interface CardFigureProps {
  card: ShareCardModel["cards"][number];
  width: number;
  showPositionLabel: boolean;
}

function getLabelClassName(width: number): string {
  if (width >= 170) return "text-[15px]";
  if (width >= 130) return "text-[13px]";
  if (width >= 110) return "text-[11px]";
  if (width >= 90) return "text-[10px]";
  if (width >= 75) return "text-[9px]";
  return "text-[8px]";
}

function CardFigure({ card, width, showPositionLabel }: CardFigureProps) {
  const aspectRatio = 1 / 1.7;
  const height = Math.round(width / aspectRatio);
  const revealUrl = getRevealCardImageUrl(card.imageUrl);
  const label = getLabelClassName(width);
  const isDense = width < 100;
  const isLarge = width >= 130;

  return (
    <div
      data-testid="reading-share-card-item"
      className="flex flex-col items-center text-center"
    >
      <div
        className={cn(
          "relative overflow-hidden border border-[#D9CEBC] bg-paper-raised shadow-[0_5px_16px_rgba(24,23,19,0.10)]",
          isLarge ? "rounded-2xl" : "rounded-[10px]",
          card.isMajor
            && "border-terracotta/55 shadow-[0_5px_16px_rgba(24,23,19,0.10),0_0_22px_rgba(201,100,66,0.18)]",
        )}
        style={{ width, height }}
      >
        {revealUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={revealUrl}
            alt={card.name}
            loading="eager"
            decoding="sync"
            className={cn(
              "h-full w-full object-cover",
              card.orientation === "reversed" && "rotate-180",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-paper-muted text-text-muted text-xs">
            {card.name}
          </div>
        )}
        {card.orientation === "reversed" && (
          <span
            className={cn(
              "absolute bottom-1.5 right-1.5 border border-indigo-ink/40 bg-paper-raised/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.1em] text-indigo-ink",
              isDense && "px-1 py-px text-[8px]",
            )}
          >
            {isDense
              ? SHARE_FIXED_COPY.positionReversedShort
              : SHARE_FIXED_COPY.positionReversed}
          </span>
        )}
      </div>
      {showPositionLabel && !isDense && (
        <div
          className={cn("mt-2 leading-snug text-text-muted", label)}
          style={{ width: Math.max(width, 108) }}
        >
          <span className="block truncate font-mono font-semibold tracking-[0.14em]">
            {card.position}
          </span>
          <span className="mt-0.5 block truncate font-aether-serif text-text-accent">
            {card.name}
            <span
              className={cn(
                "ml-1 font-mono text-[9px] tracking-[0.08em] text-text-muted",
                card.orientation === "reversed" && "text-indigo-ink",
              )}
            >
              ·{" "}
              {card.orientation === "reversed"
                ? SHARE_FIXED_COPY.positionReversed
                : SHARE_FIXED_COPY.positionUpright}
            </span>
          </span>
        </div>
      )}
      {showPositionLabel && isDense && (
        <div
          className={cn("mt-1.5 leading-tight text-text-muted", label)}
          style={{ width }}
        >
          <span className="block truncate font-mono font-semibold tracking-[0.14em]">
            {card.position}
          </span>
          <span className="mt-0.5 block truncate font-aether-serif text-text-accent">
            {card.name}
            <span
              className={cn(
                "ml-1 font-mono tracking-[0.08em] text-text-muted",
                card.orientation === "reversed" && "text-indigo-ink",
              )}
            >
              ·{" "}
              {card.orientation === "reversed"
                ? SHARE_FIXED_COPY.positionReversedShort
                : SHARE_FIXED_COPY.positionUprightShort}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function Themes({
  themes,
  compact = false,
}: {
  themes: string[];
  compact?: boolean;
}) {
  if (themes.length === 0) return null;

  return (
    <div
      data-testid="reading-share-themes"
      className={cn(
        "flex flex-col items-center",
        compact ? "gap-1.5" : "gap-2.5",
      )}
    >
      <div className="flex w-full items-center justify-center gap-2">
        <span className="h-px w-8 bg-terracotta/25" />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-terracotta-ink">
          {SHARE_FIXED_COPY.themesLabel}
        </span>
        <span className="h-px w-8 bg-terracotta/25" />
      </div>
      <p
        className={cn(
          "border-y border-paper-border px-3.5 text-center font-aether-serif text-text-body",
          compact ? "py-1.5 text-[12px]" : "py-2 text-[13px]",
        )}
      >
        {themes.map((theme, index) => (
          <span key={theme} className="text-text-accent">
            {index > 0 && (
              <span className="mx-2 text-text-muted">·</span>
            )}
            {theme}
          </span>
        ))}
      </p>
    </div>
  );
}

function QuestionBlock({
  question,
  maxLines,
}: {
  question: string;
  maxLines: number;
}) {
  const lineHeight = 1.5;
  const fontSize = 16;
  const maxHeight = maxLines * fontSize * lineHeight;
  const charsPerLine = Math.floor(TEXT_CONTAINER_WIDTH / fontSize);
  const truncated = truncateByCharBudget(question, maxLines * charsPerLine);

  return (
    <div className="border-l-2 border-terracotta py-0.5 pl-4">
      <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-terracotta-ink">
        {SHARE_FIXED_COPY.questionLabel}
      </p>
      <blockquote
        className="font-aether-serif text-ink"
        style={{
          fontSize,
          lineHeight,
          maxHeight,
          overflow: "hidden",
        }}
      >
        {truncated}
      </blockquote>
    </div>
  );
}

function TextSection({
  label,
  text,
  maxLines,
  fontSize = 15,
  lineHeight = 1.65,
  emphasis = false,
}: {
  label: string;
  text: string;
  maxLines: number;
  fontSize?: number;
  lineHeight?: number;
  emphasis?: boolean;
}) {
  const maxHeight = maxLines * fontSize * lineHeight;
  const charsPerLine = Math.floor(TEXT_CONTAINER_WIDTH / fontSize);
  const maxChars = maxLines * charsPerLine;
  const truncated = truncateByCharBudget(text, maxChars);

  return (
    <div
      className={cn(
        "border-b border-paper-border/70 px-1 py-2.5",
        emphasis && "border-l-2 border-l-terracotta pl-3.5",
      )}
    >
      <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.17em] text-terracotta-ink">
        {label}
      </p>
      <p
        className="font-aether-serif text-text-body"
        style={{
          fontSize,
          lineHeight,
          maxHeight,
          overflow: "hidden",
        }}
      >
        {truncated}
      </p>
    </div>
  );
}

function SafetySection({ text }: { text: string }) {
  return (
    <div
      data-testid="reading-share-safety-note"
      className="mx-1 mt-2 shrink-0 border-y border-safety/45 bg-safety-bg/55 px-0.5 py-2"
    >
      <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.17em] text-safety-ink">
        {SHARE_FIXED_COPY.safetyLabel}
      </p>
      <p
        data-testid="reading-share-safety-note-text"
        className="font-aether-serif text-text-body"
        style={{ fontSize: 12, lineHeight: 1.45 }}
      >
        {text}
      </p>
    </div>
  );
}

function GuidanceList({
  items,
  maxCount,
}: {
  items: string[];
  maxCount: number;
}) {
  const truncated = truncateLinesByBudget(items, maxCount, 72);
  if (truncated.length === 0) return null;

  return (
    <div
      data-testid="reading-share-guidance"
      className="px-1 py-2.5"
    >
      <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.17em] text-terracotta-ink">
        {SHARE_FIXED_COPY.guidanceLabel}
      </p>
      <ol className="space-y-1">
        {truncated.map((item, index) => (
          <li
            key={index}
            className="flex gap-2 text-[12px] leading-snug text-text-body"
          >
            <span className="shrink-0 pt-0.5 font-mono text-[10px] font-semibold text-terracotta-ink">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-aether-serif">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BrandHeader({ exportedDate }: { exportedDate: string }) {
  return (
    <header className="px-10 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.26em] text-terracotta-ink">
            {SHARE_FIXED_COPY.brandKicker}
          </div>
          <div className="mt-1.5 font-aether-serif text-[23px] leading-none tracking-[0.02em] text-ink">
            {SHARE_FIXED_COPY.brand}
          </div>
        </div>
        <span className="pt-1 font-mono text-[10px] tracking-[0.08em] text-text-muted">
          {exportedDate}
        </span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-paper-border" />
        <span className="h-1.5 w-1.5 rotate-45 border border-terracotta/50" />
        <span className="h-px w-12 bg-terracotta/35" />
      </div>
    </header>
  );
}

function SpreadHeading({
  spreadName,
  cardCount,
}: {
  spreadName: string;
  cardCount: number;
}) {
  return (
    <div className="text-center">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-terracotta-ink">
        {SHARE_FIXED_COPY.spreadKicker}
      </p>
      <h2 className="mt-1 font-aether-serif text-[18px] leading-tight text-ink">
        {spreadName}
      </h2>
      <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-text-muted">
        {String(cardCount).padStart(2, "0")} {SHARE_FIXED_COPY.cardCountUnit}
        <span className="mx-1.5">·</span>
        {spreadName}
      </p>
    </div>
  );
}

function ShareFooter({
  mode,
  exportedDate,
}: {
  mode: ShareCardModel["mode"];
  exportedDate: string;
}) {
  return (
    <footer className="px-10 pb-8 pt-4 text-center">
      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="h-px w-10 bg-paper-border" />
        <span className="h-1 w-1 rotate-45 bg-terracotta/55" />
        <span className="h-px w-10 bg-paper-border" />
      </div>
      <p className="font-aether-serif text-[12px] italic tracking-[0.08em] text-text-muted">
        {SHARE_FIXED_COPY.footerSlogan}
      </p>
      {mode === "summary" ? (
        // Summary vertical space is tight; keep the URL on the date line so
        // the footer height (and the summary box budget) stays unchanged.
        <p className="mt-1 font-mono text-[8px] tracking-[0.08em] text-text-muted/80">
          {SHARE_FIXED_COPY.exportedLabel} {exportedDate}
          <span className="mx-1.5 text-text-muted/50">·</span>
          {SHARE_FIXED_COPY.brandUrl}
        </p>
      ) : (
        <p className="mt-1.5 font-mono text-[9px] font-medium tracking-[0.22em] text-text-muted/70">
          {SHARE_FIXED_COPY.brandUrl}
        </p>
      )}
    </footer>
  );
}

export function ReadingShareCard({ model }: ReadingShareCardProps) {
  const {
    mode,
    cards,
    themes,
    question,
    synthesis,
    guidance,
    safetyNote,
    confidenceNote,
  } = model;
  const budget = getContentBudget(cards.length);
  const exportedDate = formatExportedDate(model.exportedAt);
  const isHighCardCount = cards.length >= 8;
  const isDenseMinimal = mode === "minimal" && cards.length >= 9;

  // Summary mode competes for vertical space with the card grid.
  // Cap text aggressively so the summary box never needs overflow-hidden.
  // At 8+ cards the grid becomes a compact text list, freeing space for text.
  const synthesisLines = safetyNote
    ? 1
    : Math.min(budget.maxSynthesisLines, isHighCardCount ? 4 : 3);
  const questionLines = safetyNote
    ? 1
    : Math.min(budget.maxQuestionLines, 2);
  const confidenceLines = 1;
  const guidanceCount = safetyNote ? 0 : isHighCardCount ? 2 : 1;

  return (
    <div
      data-testid="reading-share-card"
      className="relative overflow-hidden bg-paper font-aether-serif text-text-body"
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        backgroundImage:
          "radial-gradient(circle at 50% -8%, rgba(201,100,66,0.10), transparent 34%), linear-gradient(180deg, #F8F4EA 0%, #F5F2E8 48%, #F1EBDD 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-[14px] rounded-[6px] border border-[#DDD4C5]/80" />

      <div className="relative flex h-full flex-col">
        <BrandHeader exportedDate={exportedDate} />

        {mode === "minimal" ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center px-8 pb-4 pt-3">
            <div className="flex flex-col items-center">
              <SpreadHeading
                spreadName={model.spreadName}
                cardCount={cards.length}
              />
              <div className={cn("w-full", isDenseMinimal ? "mt-3" : "mt-6")}>
                <CardGrid model={model} />
              </div>
              <div
                className={cn(
                  "w-full max-w-[500px]",
                  isDenseMinimal ? "mt-3" : "mt-6",
                )}
              >
                <Themes themes={themes} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-8 pt-3">
            <SpreadHeading
              spreadName={model.spreadName}
              cardCount={cards.length}
            />

            {question && (
              <div className="mt-3">
                <QuestionBlock
                  question={question}
                  maxLines={questionLines}
                />
              </div>
            )}

            <div className="mt-3 px-1">
              {isHighCardCount ? (
                <CompactCardList cards={cards} />
              ) : (
                <CardGrid model={model} compactSummary={Boolean(safetyNote)} />
              )}
            </div>

            <div className="mt-3">
              <Themes themes={themes} compact />
            </div>

            <div
              data-testid="reading-share-summary"
              className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-paper-border"
            >
              {safetyNote && (
                <SafetySection text={safetyNote} />
              )}

              <TextSection
                label={SHARE_FIXED_COPY.synthesisLabel}
                text={synthesis}
                maxLines={synthesisLines}
                fontSize={14}
                lineHeight={1.55}
                emphasis
              />

              {confidenceNote && !safetyNote && (
                <TextSection
                  label={SHARE_FIXED_COPY.confidenceLabel}
                  text={confidenceNote}
                  maxLines={confidenceLines}
                  fontSize={12}
                  lineHeight={1.5}
                />
              )}

              <GuidanceList items={guidance} maxCount={guidanceCount} />
            </div>
          </div>
        )}

        <ShareFooter mode={mode} exportedDate={exportedDate} />
      </div>
    </div>
  );
}
