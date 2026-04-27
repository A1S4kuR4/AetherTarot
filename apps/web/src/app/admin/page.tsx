import { redirect } from "next/navigation";
import { getAdminSummary } from "@/server/beta/admin-summary";
import { isReadingServiceError } from "@/server/reading/errors";

export const dynamic = "force-dynamic";
type AdminSummary = Awaited<ReturnType<typeof getAdminSummary>>;

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-paper-border bg-paper p-5">
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl text-ink">{value}</p>
    </div>
  );
}

function KeyValueList({ items }: { items: Record<string, number> }) {
  const entries = Object.entries(items);

  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">暂无数据</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span className="text-text-body">{key}</span>
          <span className="font-medium text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ForbiddenAdmin() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <h1 className="font-serif text-3xl text-ink">无法访问管理后台</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          当前账号没有 admin 权限。
        </p>
      </section>
    </main>
  );
}

function AdminSummaryView({ summary }: { summary: AdminSummary }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-24 lg:px-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Admin
        </p>
        <h1 className="mt-2 font-serif text-4xl text-ink">内测观测台</h1>
        <p className="mt-3 text-sm text-text-muted">
          统计窗口从 {new Date(summary.since).toLocaleString("zh-CN")} 开始。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Reading 请求" value={summary.readingRequests} />
        <SummaryCard label="用户数" value={summary.activeUsers} />
        <SummaryCard label="估算成本" value={formatUsd(summary.estimatedCostUsd)} />
        <SummaryCard label="Token" value={summary.totalTokens} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="reading-card">
          <h2 className="font-serif text-2xl text-ink">成功 / 失败</h2>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>成功</span>
              <span className="font-medium text-ink">{summary.successCount}</span>
            </div>
            <div className="flex justify-between">
              <span>失败</span>
              <span className="font-medium text-ink">{summary.failureCount}</span>
            </div>
          </div>
          <div className="mt-6">
            <KeyValueList items={summary.failureByCode} />
          </div>
        </div>

        <div className="reading-card">
          <h2 className="font-serif text-2xl text-ink">Two-stage</h2>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Initial 成功</span>
              <span className="font-medium text-ink">{summary.initialSuccess}</span>
            </div>
            <div className="flex justify-between">
              <span>Final 成功</span>
              <span className="font-medium text-ink">{summary.finalSuccess}</span>
            </div>
            <div className="flex justify-between">
              <span>完成率</span>
              <span className="font-medium text-ink">
                {(summary.twoStageCompletionRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="reading-card">
          <h2 className="font-serif text-2xl text-ink">用户反馈</h2>
          <p className="mt-2 text-sm text-text-muted">
            共 {summary.feedbackCount} 条反馈
          </p>
          <div className="mt-6">
            <KeyValueList items={summary.feedbackByLabel} />
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function AdminPage() {
  let summary: AdminSummary | null = null;
  let isForbidden = false;

  try {
    summary = await getAdminSummary();
  } catch (error) {
    if (isReadingServiceError(error) && error.code === "unauthorized") {
      redirect("/login?next=/admin");
    }

    if (isReadingServiceError(error) && error.code === "forbidden") {
      isForbidden = true;
    } else {
      throw error;
    }
  }

  if (isForbidden) {
    return <ForbiddenAdmin />;
  }

  if (!summary) {
    throw new Error("Admin summary is unavailable.");
  }

  return <AdminSummaryView summary={summary} />;
}
