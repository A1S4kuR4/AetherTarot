import { type ReactNode, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface PromptCategory {
  id: string;
  label: string;
}

interface InquiryPaneProps {
  activeCategory: string;
  categories: PromptCategory[];
  currentPrompts: string[];
  isRefreshing: boolean;
  onCategoryChange: (category: string) => void;
  onClearQuestion: () => void;
  onPromptSelect: (prompt: string) => void;
  onRefreshPrompts: () => void;
  onQuestionChange: (question: string) => void;
  question: string;
  repeatedThemeNotice: { label: string; question: string } | null;
  showDecisionGuidance: boolean;
  draftStatus: "restored" | "saved" | null;
}

export function InquiryPane({
  activeCategory,
  categories,
  currentPrompts,
  isRefreshing,
  onCategoryChange,
  onClearQuestion,
  onPromptSelect,
  onRefreshPrompts,
  onQuestionChange,
  question,
  repeatedThemeNotice,
  showDecisionGuidance,
  draftStatus,
}: InquiryPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const needsQuestionReframe = /要不要|该不该|是不是该/.test(question);
  const isRelationshipQuestion = /关系|感情|伴侣|喜欢|爱|分手|复合|他|她|对方/.test(question);
  let guidanceSlot: ReactNode = null;
  if (repeatedThemeNotice) {
    guidanceSlot = (
      <>
        <strong>重复主题提醒</strong>
        <span>最近问过相近的{repeatedThemeNotice.label}：{repeatedThemeNotice.question}</span>
      </>
    );
  } else if (showDecisionGuidance) {
    guidanceSlot = <span>可以把“是否要做某个决定”改写成“我需要看清哪些条件与代价”，让牌面协助整理线索，而非替你裁定答案。</span>;
  } else if (needsQuestionReframe) {
    guidanceSlot = <span>试着把“要不要”改写成“我需要看清什么”，让牌面帮助你整理线索，而非替你决定。</span>;
  } else if (isRelationshipQuestion) {
    guidanceSlot = <span>这个问题和关系有关。圣三角形或四个面向会帮你从过去、现在与不同面向去梳理。</span>;
  }

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 110)}px`;
  }, [question]);

  return (
    <section aria-labelledby="new-reading-inquiry-title" className="new-reading-inquiry">
      <div>
        <p className="new-reading-section-mark">RETROSPECT / 问询</p>
        <h1 id="new-reading-inquiry-title" className="new-reading-title">落笔成问</h1>
      </div>

      <div>
        <label className="sr-only" htmlFor="new-reading-question">你的问询</label>
        <textarea
          ref={textareaRef}
          id="new-reading-question"
          className="new-reading-question-input"
          placeholder="今天，你想向内心询问什么？"
          maxLength={200}
          rows={3}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
        />
        <div className="new-reading-input-meta" aria-live="polite">
          <span>
            {draftStatus === "restored" ? "已恢复上次草稿" : null}
            {draftStatus === "saved" ? "草稿已自动保存" : null}
            {question ? (
              <button type="button" onClick={onClearQuestion} className="new-reading-clear-question">
                清空草稿
              </button>
            ) : null}
          </span>
          <span>{question.length} / 200</span>
        </div>
      </div>

      {guidanceSlot ? (
        <aside className="new-reading-guidance-slot" aria-live="polite">
          {guidanceSlot}
        </aside>
      ) : null}

      <section aria-labelledby="new-reading-prompt-title" className="new-reading-prompts">
        <div className="new-reading-prompts-header">
          <h2 id="new-reading-prompt-title">不知道问什么？从这些问题开始</h2>
          <button
            type="button"
            onClick={onRefreshPrompts}
            className="new-reading-text-button"
          >
            <span className={cn("inline-block transition-transform duration-300", isRefreshing && "rotate-180")}>↻</span>
            换一批
          </button>
        </div>

        <div className="new-reading-category-list" role="group" aria-label="灵感问题类别">
          {categories.map((category) => {
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onCategoryChange(category.id)}
                className={cn("new-reading-category", isActive && "new-reading-category-active")}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div data-testid="suggested-prompt-list" className="new-reading-prompt-list">
          {currentPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="new-reading-prompt"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
