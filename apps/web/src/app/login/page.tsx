import { signIn } from "@/auth";
import { resolveSafeLocalRedirect } from "@/lib/navigation/safe-local-redirect";

type LoginSearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

const LOGIN_REDIRECT_ORIGIN = "https://aethertarot.local";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSafeNextPath(next: string | null | undefined) {
  const safeUrl = resolveSafeLocalRedirect(next ?? "/", LOGIN_REDIRECT_ORIGIN);
  return `${safeUrl.pathname}${safeUrl.search}${safeUrl.hash}`;
}

async function signInWithKeycloak(formData: FormData) {
  "use server";

  const next = formData.get("next");
  await signIn("keycloak", {
    redirectTo: resolveSafeNextPath(typeof next === "string" ? next : "/"),
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: LoginSearchParams;
}) {
  const params = await searchParams;
  const safeNextPath = resolveSafeNextPath(firstSearchValue(params?.next));

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Beta Access
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">内测登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          当前仅支持已邀请账号通过 Keycloak 登录。账号由管理员预先创建，不开放注册、邮件登录或找回密码。
        </p>
        <form action={signInWithKeycloak} className="mt-6">
          <input type="hidden" name="next" value={safeNextPath} />
          <button type="submit" className="btn-primary w-full">
            进入 Keycloak 登录
          </button>
        </form>
      </section>
    </main>
  );
}
