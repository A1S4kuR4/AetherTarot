"use client";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="border-y border-error/30 py-8">
      <h2 className="font-serif text-2xl text-ink">连接受阻</h2>
      <p className="mt-3 leading-relaxed text-text-body">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-11 border border-terracotta-ink bg-terracotta-ink px-5 py-2 font-serif text-sm text-paper transition-colors hover:bg-terracotta-active"
      >
        重新尝试
      </button>
    </div>
  );
}
