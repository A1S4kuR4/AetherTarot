"use client";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="reading-card">
      <h2 className="font-serif text-2xl text-ink">连接受阻</h2>
      <p className="mt-3 leading-relaxed text-text-body">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-primary mt-5"
      >
        重新尝试
      </button>
    </div>
  );
}
