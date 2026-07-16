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

  return (
    <div
      data-testid="reading-share-card-item"
      className="flex flex-col items-center text-center"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[10px] border border-[#D9CEBC] bg-paper-raised shadow-[0_5px_16px_rgba(24,23,19,0.10)]",
          card.orientation === "reversed" && "rotate-180",
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
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-paper-muted text-text-muted text-xs">
            {card.name}
          </div>
        )}
      </div>
      {showPositionLabel && !isDense && (
        <div
          className={cn("mt-2 leading-snug text-text-muted", label)}
          style={{ width: Math.max(width, 108) }}
        >
          <span className="block truncate font-sans">{card.position}</span>
          <span className="mt-0.5 block truncate text-text-accent">
            {card.name}
            <span className="ml-1 text-text-muted">
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
          <span className="block truncate font-sans">{card.position}</span>
          <span className="mt-0.5 block truncate text-text-accent">
            {card.name} · {card.orientation === "reversed" ? "逆" : "正"}
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
        <span className="font-sans text-[9px] font-medium tracking-[0.18em] text-text-muted">
          本次主题
        </span>
        <span className="h-px w-8 bg-terracotta/25" />
      </div>
      <div
        className={cn(
          "flex flex-wrap justify-center",
          compact ? "gap-1.5" : "gap-2",
        )}
      >
        {themes.map((theme) => (
          <span
            key={theme}
            className={cn(
              "inline-flex items-center rounded-full border border-paper-border bg-paper-raised/80 font-sans text-text-body",
              compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
            )}
          >
            {theme}
          </span>
        ))}
      </div>
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
  const charsPerLine = Math.floor(480 / fontSize);
  const truncated = truncateByCharBudget(question, maxLines * charsPerLine);

  return (
    <div className="rounded-2xl border border-paper-border bg-paper-raised/65 px-4 py-3 shadow-[0_2px_8px_rgba(24,23,19,0.03)]">
      <p className="mb-1.5 flex items-center gap-2 font-sans text-[9px] font-medium tracking-[0.16em] text-text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-terracotta/70" />
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
}: {
  label: string;
  text: string;
  maxLines: number;
  fontSize?: number;
  lineHeight?: number;
}) {
  const maxHeight = maxLines * fontSize * lineHeight;
  const charsPerLine = Math.floor(520 / fontSize);
  const maxChars = maxLines * charsPerLine;
  const truncated = truncateByCharBudget(text, maxChars);

  return (
    <div className="border-t border-paper-border/70 px-4 py-2.5 first:border-t-0">
      <p className="mb-1 font-sans text-[9px] font-medium tracking-[0.15em] text-text-muted">
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
      className="mx-2 mt-2 shrink-0 rounded-xl border border-safety/20 bg-safety-bg/40 px-4 py-2.5"
    >
      <p className="mb-1 font-sans text-[9px] font-medium tracking-[0.15em] text-safety">
        安全提醒
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
      className="border-t border-paper-border/70 px-4 py-2.5"
    >
      <p className="mb-1.5 font-sans text-[9px] font-medium tracking-[0.15em] text-text-muted">
        {SHARE_FIXED_COPY.guidanceLabel}
      </p>
      <ul className="space-y-1">
        {truncated.map((item, index) => (
          <li
            key={index}
            className="flex gap-2 text-[12px] leading-snug text-text-body"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-terracotta/70" />
            <span className="font-aether-serif">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandHeader({ exportedDate }: { exportedDate: string }) {
  return (
    <header className="px-10 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-aether-serif text-[23px] leading-none text-ink">
            {SHARE_FIXED_COPY.brand}
          </div>
          <div className="mt-1.5 font-sans text-[8px] font-medium uppercase tracking-[0.28em] text-text-muted">
            {SHARE_FIXED_COPY.brandEnglish}
          </div>
        </div>
        <span className="pt-1 font-sans text-[10px] tracking-[0.05em] text-text-muted">
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

function SpreadHeading({ spreadName }: { spreadName: string }) {
  return (
    <div className="text-center">
      <p className="font-sans text-[9px] font-medium tracking-[0.2em] text-text-muted">
        {SHARE_FIXED_COPY.spreadLabel}
      </p>
      <h2 className="mt-1 font-aether-serif text-[18px] leading-tight text-ink">
        {spreadName}
      </h2>
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
        <span className="h-1 w-1 rounded-full bg-terracotta/55" />
        <span className="h-px w-10 bg-paper-border" />
      </div>
      <p className="font-aether-serif text-[12px] italic tracking-[0.08em] text-text-muted">
        {SHARE_FIXED_COPY.footerSlogan}
      </p>
      {mode === "summary" && (
        <p className="mt-1 font-sans text-[8px] tracking-[0.08em] text-text-muted/80">
          {SHARE_FIXED_COPY.exportedLabel} {exportedDate}
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

  // Summary mode competes for vertical space with the card grid.
  // Cap text aggressively so the summary box never needs overflow-hidden.
  const synthesisLines = safetyNote
    ? 1
    : isHighCardCount
      ? 2
      : Math.min(budget.maxSynthesisLines, 3);
  const questionLines = safetyNote
    ? 1
    : isHighCardCount
      ? 1
      : Math.min(budget.maxQuestionLines, 2);
  const confidenceLines = 1;
  const guidanceCount = safetyNote ? 0 : 1;

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
      <div className="pointer-events-none absolute inset-[14px] rounded-[26px] border border-[#DDD4C5]/80" />

      <div className="relative flex h-full flex-col">
        <BrandHeader exportedDate={exportedDate} />

        {mode === "minimal" ? (
          <main className="flex min-h-0 flex-1 flex-col justify-center px-8 pb-4 pt-3">
            <div className="flex flex-col items-center">
              <SpreadHeading spreadName={model.spreadName} />
              <div className="mt-6 w-full">
                <CardGrid model={model} />
              </div>
              <div className="mt-6 w-full max-w-[500px]">
                <Themes themes={themes} />
              </div>
            </div>
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col px-8 pt-3">
            <SpreadHeading spreadName={model.spreadName} />

            {question && (
              <div className="mt-3">
                <QuestionBlock
                  question={question}
                  maxLines={questionLines}
                />
              </div>
            )}

            <div className="mt-3 px-1">
              <CardGrid model={model} compactSummary={Boolean(safetyNote)} />
            </div>

            <div className="mt-3">
              <Themes themes={themes} compact />
            </div>

            <div
              data-testid="reading-share-summary"
              className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-paper-border bg-paper-raised/60 shadow-[0_3px_12px_rgba(24,23,19,0.04)]"
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
              />

              {confidenceNote && !safetyNote && (
                <TextSection
                  label="置信说明"
                  text={confidenceNote}
                  maxLines={confidenceLines}
                  fontSize={12}
                  lineHeight={1.5}
                />
              )}

              <GuidanceList items={guidance} maxCount={guidanceCount} />
            </div>
          </main>
        )}

        <ShareFooter mode={mode} exportedDate={exportedDate} />
      </div>
    </div>
  );
}
