import { signIn } from "@/auth";
import { resolveSafeLocalRedirect } from "@/lib/navigation/safe-local-redirect";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

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

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "邮箱或密码错误，请重试。",
  Default: "登录失败，请稍后再试。",
};

async function signInWithCredentials(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");
  const next = formData.get("next");

  try {
    await signIn("credentials", {
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      redirectTo: resolveSafeNextPath(typeof next === "string" ? next : "/"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const url = new URL("/login", LOGIN_REDIRECT_ORIGIN);
      url.searchParams.set("error", error.type ?? "Default");
      if (typeof next === "string" && next) {
        url.searchParams.set("next", next);
      }
      redirect(`${url.pathname}${url.search}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: LoginSearchParams;
}) {
  const params = await searchParams;
  const safeNextPath = resolveSafeNextPath(firstSearchValue(params?.next));
  const errorCode = firstSearchValue(params?.error);
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Beta Access
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">内测登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          请输入内测账号邮箱和密码登录。账号由管理员分配，不开放注册。
        </p>
        {errorMessage && (
          <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
        <form action={signInWithCredentials} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={safeNextPath} />
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-body"
            >
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-text-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-body"
            >
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-text-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            登录
          </button>
        </form>
      </section>
    </main>
  );
}
