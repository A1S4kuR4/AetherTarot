import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSummary } from "@/server/beta/admin-summary";
import { isReadingServiceError } from "@/server/reading/errors";
import { 
  Activity, 
  Users, 
  CircleDollarSign, 
  Cpu, 
  CheckCircle2, 
  MessagesSquare, 
  Target,
  BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";
type AdminSummary = Awaited<ReturnType<typeof getAdminSummary>>;

function formatCny(value: number) {
  return `￥${value.toFixed(2)}`;
}

const ERROR_CODE_LABELS: Record<string, string> = {
  "rate_limited": "触发限流",
  "provider_timeout": "模型超时",
  "provider_unavailable": "服务不可用",
  "unauthorized": "未授权",
  "forbidden": "权限不足",
  "unknown": "未知错误",
};

const FEEDBACK_LABELS: Record<string, string> = {
  "helpful": "有帮助",
  "template_like": "太模板",
  "too_agreeable": "太迎合",
  "did_not_answer": "没回答问题",
  // Historical labels remain readable in windows that span the schema change.
  "insightful": "很有启发",
  "accurate": "描述准确",
  "confusing": "令人困惑",
  "inaccurate": "不太准确",
  "too_long": "篇幅过长",
  "too_short": "篇幅过短",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  subtext,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  subtext?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-paper-border bg-paper-raised p-6 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="absolute -right-4 -top-4 opacity-[0.03] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.06]">
        {Icon && <Icon className="h-28 w-28" />}
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-terracotta/70" />}
      </div>
      <p className="relative z-10 mt-3 font-serif text-3xl font-medium tracking-tight text-ink drop-shadow-sm">
        {value}
      </p>
      {subtext && (
        <div className="relative z-10 mt-2 text-[10px] font-medium tracking-wide text-text-muted/80">
          {subtext}
        </div>
      )}
    </div>
  );
}

function GrowthFunnelTable({ summary }: { summary: AdminSummary }) {
  const sourceRows = Object.entries(summary.growthBySource).sort(
    (a, b) => b[1].visits - a[1].visits,
  );

  return (
    <section className="reading-card mt-8 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-paper-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-muted">
              <BarChart3 className="h-5 w-5 text-terracotta/80" />
            </div>
            <h2 className="font-serif text-2xl font-medium text-ink">运营来源漏斗</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            依据首方 UTM 归因统计；“douyin”代表带有 utm_source=douyin 的访问。
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="访问" value={summary.growthFunnel.visits} />
        <SummaryCard label="开始解读" value={summary.growthFunnel.readingStarts} />
        <SummaryCard label="完成解读" value={summary.growthFunnel.readingCompletions} />
        <SummaryCard label="提交反馈" value={summary.growthFunnel.feedbackSubmissions} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-paper-border/60">
        {sourceRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">暂无来源数据</p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">按 UTM 来源拆分的访问和解读转化数据</caption>
            <thead className="bg-paper-muted/70 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">来源</th>
                <th scope="col" className="px-5 py-3 font-semibold">访问</th>
                <th scope="col" className="px-5 py-3 font-semibold">开始解读</th>
                <th scope="col" className="px-5 py-3 font-semibold">完成解读</th>
                <th scope="col" className="px-5 py-3 font-semibold">提交反馈</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map(([source, funnel]) => (
                <tr key={source} className="border-t border-paper-border/50 text-text-body">
                  <th scope="row" className="px-5 py-3 font-medium text-ink">
                    {source === "direct" ? "直接访问" : source}
                  </th>
                  <td className="px-5 py-3 tabular-nums">{funnel.visits}</td>
                  <td className="px-5 py-3 tabular-nums">{funnel.readingStarts}</td>
                  <td className="px-5 py-3 tabular-nums">{funnel.readingCompletions}</td>
                  <td className="px-5 py-3 tabular-nums">{funnel.feedbackSubmissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function KeyValueList({
  items,
  dictionary,
}: {
  items: Record<string, number>;
  dictionary?: Record<string, string>;
}) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-paper-border py-8">
        <p className="text-sm text-text-muted">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="group flex items-center justify-between text-sm">
          <span className="font-medium text-text-body">
            {dictionary ? (dictionary[key] || key) : key}
          </span>
          <div className="mx-4 flex-1 border-b border-dashed border-paper-border/60 transition-colors group-hover:border-terracotta/30"></div>
          <span className="font-semibold text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ForbiddenAdmin() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <h1 className="font-serif text-3xl text-ink">无法访问管理后台</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          当前账号没有 admin 权限。
        </p>
      </section>
    </div>
  );
}

function AdminSummaryView({
  summary,
  currentWindow,
}: {
  summary: AdminSummary;
  currentWindow: string;
}) {
  const formattedSince = new Date(summary.since).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  return (
    <div className="mx-auto max-w-6xl px-6 py-24 lg:px-16">
      {/* 极简网格背景装饰 */}
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px]"></div>

      <header className="mb-12">
        <div className="flex items-center gap-3">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-terracotta/80">
            Observation Deck
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-terracotta/20 to-transparent"></span>
        </div>
        <h1 className="mt-4 font-serif text-5xl font-medium tracking-tight text-ink drop-shadow-sm">
          内测观测台
        </h1>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="chip-muted flex items-center gap-2 border border-paper-border/50 bg-paper/50 backdrop-blur-sm px-4 py-1.5 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-terracotta"></span>
            </span>
            统计窗口自 {formattedSince} 开启
          </span>

          <div className="flex items-center gap-2 rounded-lg bg-paper-muted p-1 border border-paper-border/30 w-fit">
            <Link
              href="?window=1d"
              className={`inline-flex min-h-11 items-center rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${currentWindow === '1d' ? 'bg-paper shadow-sm text-ink border border-paper-border/50' : 'text-text-muted hover:text-ink'}`}
            >
              今日
            </Link>
            <Link
              href="?window=7d"
              className={`inline-flex min-h-11 items-center rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${currentWindow === '7d' ? 'bg-paper shadow-sm text-ink border border-paper-border/50' : 'text-text-muted hover:text-ink'}`}
            >
              近 7 日
            </Link>
            <Link
              href="?window=30d"
              className={`inline-flex min-h-11 items-center rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${currentWindow === '30d' ? 'bg-paper shadow-sm text-ink border border-paper-border/50' : 'text-text-muted hover:text-ink'}`}
            >
              近 30 日
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Reading 请求"
          value={summary.readingRequests}
          icon={Activity}
          subtext={`登录: ${summary.registeredReadingRequests} | 游客: ${summary.guestReadingRequests}`}
        />
        <SummaryCard
          label="百科请求"
          value={summary.encyclopediaRequests}
          icon={Target}
          subtext={`登录: ${summary.registeredEncyclopediaRequests} | 游客: ${summary.guestEncyclopediaRequests}`}
        />
        <SummaryCard
          label="用户数"
          value={summary.activeUsers}
          icon={Users}
          subtext={`登录: ${summary.registeredUsers} | 游客: ${summary.guestUsers}`}
        />
        <SummaryCard label="估算成本" value={formatCny(summary.estimatedCostCny)} icon={CircleDollarSign} />
        <SummaryCard label="Token" value={`${summary.totalTokens} / ${summary.tokenLimit}`} icon={Cpu} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="reading-card group relative overflow-hidden transition-all hover:shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-muted">
              <CheckCircle2 className="h-5 w-5 text-terracotta/80" />
            </div>
            <h2 className="font-serif text-2xl font-medium text-ink">请求成功 / 失败</h2>
          </div>
          
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 border border-paper-border/40">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success"></span>
                <span>成功</span>
              </span>
              <span className="font-semibold text-success">{summary.successCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 border border-paper-border/40">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-error"></span>
                <span>失败</span>
              </span>
              <span className="font-semibold text-error">{summary.failureCount}</span>
            </div>
          </div>
          
          <div className="mt-6 border-t border-paper-border/60 pt-6">
            <p className="mb-3 text-xs leading-relaxed text-text-muted">
              Reading 与百科的幂等请求合计；不等同于用户完成的 reading 数。
            </p>
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">失败状态分布</p>
            <KeyValueList items={summary.failureByCode} dictionary={ERROR_CODE_LABELS} />
          </div>
        </div>

        <div className="reading-card group relative overflow-hidden transition-all hover:shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-muted">
              <Activity className="h-5 w-5 text-terracotta/80" />
            </div>
            <h2 className="font-serif text-2xl font-medium text-ink">Two-stage</h2>
          </div>
          
          <div className="space-y-3 text-sm px-2">
            <div className="flex items-center justify-between border-b border-paper-border/40 pb-3 pt-1">
              <span className="text-text-body">Initial 成功</span>
              <span className="font-semibold text-ink">{summary.initialSuccess}</span>
            </div>
            <div className="flex items-center justify-between border-b border-paper-border/40 pb-3 pt-2">
              <span className="text-text-body">Final 成功</span>
              <span className="font-semibold text-ink">{summary.finalSuccess}</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="font-medium text-text-strong">转化率</span>
              <span className="rounded-md bg-terracotta/10 px-2.5 py-1 text-sm font-bold text-text-accent">
                {(summary.twoStageCompletionRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="reading-card group relative overflow-hidden transition-all hover:shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-muted">
              <MessagesSquare className="h-5 w-5 text-terracotta/80" />
            </div>
            <div className="flex-1">
              <h2 className="font-serif text-2xl font-medium text-ink">用户反馈</h2>
            </div>
            <span className="chip-accent">{summary.feedbackCount} 条</span>
          </div>
          
          <div className="mt-2 border-t border-paper-border/60 pt-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">反馈标签统计</p>
            <KeyValueList items={summary.feedbackByLabel} dictionary={FEEDBACK_LABELS} />
          </div>
        </div>
      </section>

      <GrowthFunnelTable summary={summary} />
    </div>
  );
}

export default async function AdminPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const windowParam = typeof searchParams?.window === "string" ? searchParams.window : "1d";
  const days = windowParam === "7d" ? 7 : windowParam === "30d" ? 30 : 1;

  let summary: AdminSummary | null = null;
  let isForbidden = false;

  try {
    summary = await getAdminSummary(days);
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

  return <AdminSummaryView summary={summary} currentWindow={windowParam} />;
}
