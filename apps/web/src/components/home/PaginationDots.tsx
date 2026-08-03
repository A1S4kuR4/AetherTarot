"use client";

interface PaginationDotsProps {
  total: number;
  active: number;
  onChange: (index: number) => void;
}

export default function PaginationDots({ total, active, onChange }: PaginationDotsProps) {
  const labels = ["CHAPTER I", "CHAPTER II", "CHAPTER III", "CHAPTER IV"];

  return (
    <nav
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-4 lg:flex"
      aria-label="章节导航"
    >
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-current={active === i ? "true" : undefined}
          className="group relative flex items-center justify-center p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
          aria-label={`跳转至 ${labels[i] ?? `第 ${i + 1} 章`}`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full border border-terracotta transition-all duration-200 ${
              active === i
                ? "scale-125 bg-terracotta shadow-[0_0_0_4px_rgba(201,100,66,0.15)]"
                : "bg-transparent group-hover:scale-110 group-hover:bg-terracotta/30"
            }`}
          />
          <span className="absolute right-8 origin-right scale-0 whitespace-nowrap border border-paper-border bg-paper-raised px-2 py-1 font-sans text-[10px] font-medium tracking-[0.08em] text-ink transition-transform group-hover:scale-100">
            {labels[i]}
          </span>
        </button>
      ))}
    </nav>
  );
}
