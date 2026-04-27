"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const supabase = createClient();

    if (!supabase) {
      setErrorMessage("Supabase 尚未配置，暂时无法登录。");
      return;
    }

    setIsSubmitting(true);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setErrorMessage("登录邮件发送失败，请检查本地 Supabase Auth 是否可用。");
        return;
      }
    } catch {
      setErrorMessage("无法连接登录服务，请确认本地 Supabase stack 已启动。");
      return;
    } finally {
      setIsSubmitting(false);
    }

    setMessage("登录链接已经发送到你的邮箱。");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Beta Access
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">内测登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          第一轮内测需要使用白名单邮箱登录。系统会按邮箱和网络限额控制 reading 调用。
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="font-sans text-sm font-medium text-text-body">
              邮箱
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-paper-border bg-paper px-4 py-3 font-sans text-sm text-ink outline-none focus:border-terracotta/50 focus:ring-1 focus:ring-terracotta/50"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "发送中..." : "发送登录链接"}
          </button>
        </form>
        {message ? (
          <p className="mt-4 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
            {message}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
