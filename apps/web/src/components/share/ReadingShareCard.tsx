"use client";

import { getRevealCardImageUrl } from "@/lib/card-assets";
import { cn } from "@/lib/utils";
import {
  getContentBudget,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_FIXED_COPY,
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

function CardGrid({ model }: { model: ShareCardModel }) {
  const { cards, mode } = model;
  const count = cards.length;

  if (count === 1) {
    return (
      <div className="flex items-center justify-center">
        <CardFigure
          card={cards[0]}
          size={mode === "summary" ? "summaryLarge" : "large"}
          showPositionLabel
        />
      </div>
    );
  }

  if (count <= 3) {
    return (
      <div
        className={cn(
          "flex items-start justify-center",
          mode === "summary" ? "gap-3" : "gap-4",
        )}
      >
        {cards.map((card) => (
          <CardFigure
            key={card.positionId}
            card={card}
            size={mode === "summary" ? "summaryMedium" : "medium"}
            showPositionLabel
          />
        ))}
      </div>
    );
  }

  const isCompact = count >= 8;
  const cols = count <= 6 ? 3 : count === 7 ? 4 : 5;
  const size =
    mode === "summary"
      ? isCompact
        ? "compact"
        : "dense"
      : isCompact
        ? "dense"
        : "small";

  return (
    <div
      className={cn(
        "grid justify-center",
        isCompact ? "gap-x-2 gap-y-1" : "gap-3",
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {cards.map((card) => (
        <CardFigure
          key={card.positionId}
          card={card}
          size={size}
          showPositionLabel
        />
      ))}
    </div>
  );
}

interface CardFigureProps {
  card: ShareCardModel["cards"][number];
  size:
    | "large"
    | "medium"
    | "summaryLarge"
    | "summaryMedium"
    | "small"
    | "dense"
    | "compact";
  showPositionLabel: boolean;
}

const SIZE_MAP = {
  large: { width: 238, label: "text-[15px]" },
  medium: { width: 142, label: "text-[13px]" },
  summaryLarge: { width: 170, label: "text-[13px]" },
  summaryMedium: { width: 118, label: "text-[11px]" },
  small: { width: 92, label: "text-[10px]" },
  dense: { width: 74, label: "text-[9px]" },
  compact: { width: 62, label: "text-[8px]" },
} as const;

function CardFigure({ card, size, showPositionLabel }: CardFigureProps) {
  const { width, label } = SIZE_MAP[size];
  const aspectRatio = 1 / 1.7;
  const height = Math.round(width / aspectRatio);
  const revealUrl = getRevealCardImageUrl(card.imageUrl);
  const isDense = size === "dense" || size === "compact";

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
  important = false,
}: {
  label: string;
  text: string;
  maxLines: number;
  fontSize?: number;
  lineHeight?: number;
  important?: boolean;
}) {
  const maxHeight = maxLines * fontSize * lineHeight;
  const charsPerLine = Math.floor(520 / fontSize);
  const maxChars = maxLines * charsPerLine;
  const truncated = truncateByCharBudget(text, maxChars);

  return (
    <div
      className={cn(
        "border-t border-paper-border/70 px-4 py-2.5 first:border-t-0",
        important &&
          "mx-2 mt-2 rounded-xl border border-safety/20 bg-safety-bg/40",
      )}
    >
      <p
        className={cn(
          "mb-1 font-sans text-[9px] font-medium tracking-[0.15em]",
          important ? "text-safety" : "text-text-muted",
        )}
      >
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
  const synthesisLines = safetyNote
    ? Math.min(budget.maxSynthesisLines, 4)
    : Math.min(budget.maxSynthesisLines, 7);

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
                  maxLines={budget.maxQuestionLines}
                />
              </div>
            )}

            <div className="mt-3 px-1">
              <CardGrid model={model} />
            </div>

            <div className="mt-3">
              <Themes themes={themes} compact />
            </div>

            <div
              data-testid="reading-share-summary"
              className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-paper-border bg-paper-raised/60 shadow-[0_3px_12px_rgba(24,23,19,0.04)]"
            >
              {safetyNote && (
                <div data-testid="reading-share-safety-note">
                  <TextSection
                    label="安全提醒"
                    text={safetyNote}
                    maxLines={3}
                    important
                    fontSize={13}
                    lineHeight={1.5}
                  />
                </div>
              )}

              <TextSection
                label={SHARE_FIXED_COPY.synthesisLabel}
                text={synthesis}
                maxLines={synthesisLines}
                fontSize={14}
                lineHeight={1.55}
              />

              {confidenceNote && (
                <TextSection
                  label="置信说明"
                  text={confidenceNote}
                  maxLines={2}
                  fontSize={12}
                  lineHeight={1.5}
                />
              )}

              <GuidanceList
                items={guidance}
                maxCount={safetyNote ? 0 : Math.min(budget.maxGuidanceCount, 2)}
              />
            </div>
          </main>
        )}

        <ShareFooter mode={mode} exportedDate={exportedDate} />
      </div>
    </div>
  );
}
