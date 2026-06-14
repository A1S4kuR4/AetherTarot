"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ safeNextPath }: { safeNextPath: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("邮箱或密码错误，请重试。");
      } else {
        // Force a hard reload to ensure the new session propagates perfectly
        window.location.assign(safeNextPath);
      }
    } catch (err) {
      setError("登录失败，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-body">
            邮箱
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-text-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-body">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-text-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
          />
        </div>
        <button type="submit" disabled={isLoading} className="btn-primary w-full disabled:opacity-50">
          {isLoading ? "登录中..." : "登录"}
        </button>
      </form>
    </>
  );
}
