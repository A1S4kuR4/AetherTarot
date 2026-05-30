"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [cooldownSeconds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    if (cooldownSeconds > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          next,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        if (response.status === 429) {
          setCooldownSeconds(60);
        }
        setErrorMessage(
          payload?.error?.message
            ?? "无法发送登录链接。请确认你使用的是已邀请账号，或稍后重试。",
        );
        return;
      }
    } catch {
      setErrorMessage("登录服务暂时不可用，请稍后重试。");
      return;
    } finally {
      setIsSubmitting(false);
    }

    setCooldownSeconds(60);
    setMessage("如果该邮箱已被邀请，登录链接会发送到你的邮箱。");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-6 py-20">
      <section className="reading-card">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted">
          Beta Access
        </p>
        <h1 className="mt-2 font-serif text-3xl text-ink">内测登录</h1>
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          当前仅向已邀请并激活的内测账号发送登录链接，不开放新邮箱注册。系统会按登录账号控制每日体验次数，并设置全站每日体验额度。
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
            disabled={isSubmitting || cooldownSeconds > 0}
            className="btn-primary w-full"
          >
            {isSubmitting
              ? "发送中..."
              : cooldownSeconds > 0
                ? `${cooldownSeconds} 秒后可重发`
                : "发送登录链接"}
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
