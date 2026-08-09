import { resolveSafeLocalRedirect } from "@/lib/navigation/safe-local-redirect";
import LoginForm from "@/components/auth/LoginForm";

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOGIN_REDIRECT_ORIGIN = "https://aethertarot.local";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSafeNextPath(next: string | null | undefined) {
  const safeUrl = resolveSafeLocalRedirect(next ?? "/", LOGIN_REDIRECT_ORIGIN);
  return `${safeUrl.pathname}${safeUrl.search}${safeUrl.hash}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: LoginSearchParams;
}) {
  const params = await searchParams;
  const safeNextPath = resolveSafeNextPath(firstSearchValue(params?.next));

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Beta Access
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">内测登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          请输入内测账号邮箱和密码登录。账号由管理员分配，不开放注册。
        </p>
        
        <LoginForm safeNextPath={safeNextPath} />
        
      </section>
    </div>
  );
}
