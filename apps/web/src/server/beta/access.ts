import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ReadingServiceError } from "@/server/reading/errors";

export type BetaTesterRole = "tester" | "admin";

export interface AuthenticatedTester {
  userId: string;
  email: string;
  role: BetaTesterRole;
}

interface TesterRow {
  email?: unknown;
  role?: unknown;
  is_active?: unknown;
}

export const E2E_ACCESS_BYPASS_HEADER = "x-aethertarot-e2e-access";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isE2eAccessBypassEnabled(triggerValue?: string | null) {
  return (
    process.env.NODE_ENV !== "production" &&
    (triggerValue ?? process.env.AETHERTAROT_E2E_BYPASS_BETA_ACCESS) === "1"
  );
}

export function getE2eAccessBypassTester(
  triggerValue?: string | null,
): AuthenticatedTester | null {
  if (!isE2eAccessBypassEnabled(triggerValue)) {
    return null;
  }

  return {
    userId: "00000000-0000-0000-0000-0000000000e2",
    email: "playwright@example.com",
    role: "admin",
  };
}

async function getE2eAccessBypassHeader() {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get(E2E_ACCESS_BYPASS_HEADER);
  } catch {
    return null;
  }
}

export function normalizeTesterRow(
  row: TesterRow | null,
): { email: string; role: BetaTesterRole } | null {
  if (!row || row.is_active !== true) {
    return null;
  }

  const email = typeof row.email === "string" ? normalizeEmail(row.email) : null;
  const role: BetaTesterRole | null =
    row.role === "admin" ? "admin" : row.role === "tester" ? "tester" : null;

  if (!email || !role) {
    return null;
  }

  return { email, role };
}

export function assertRequiredRole({
  tester,
  requiredRole,
}: {
  tester: AuthenticatedTester;
  requiredRole?: BetaTesterRole;
}) {
  if (requiredRole === "admin" && tester.role !== "admin") {
    throw new ReadingServiceError(
      "forbidden",
      "当前账号没有管理后台权限。",
      403,
    );
  }
}

export async function requireBetaTesterAccess(
  requiredRole?: BetaTesterRole,
): Promise<AuthenticatedTester> {
  const bypassTester =
    getE2eAccessBypassTester() ??
    getE2eAccessBypassTester(await getE2eAccessBypassHeader());

  if (bypassTester) {
    assertRequiredRole({ tester: bypassTester, requiredRole });
    return bypassTester;
  }

  const supabase = await createClient();

  if (!supabase) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测访问控制未配置 Supabase。请先配置 Supabase URL 与 anon key。",
      503,
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new ReadingServiceError(
      "unauthorized",
      "请先登录后再使用内测 reading 服务。",
      401,
    );
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测访问控制未配置服务端 Supabase service role key。",
      503,
    );
  }

  const email = normalizeEmail(user.email);
  const { data, error: testerError } = await adminClient
    .from("beta_testers")
    .select("email, role, is_active")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (testerError) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测白名单查询失败，请稍后再试。",
      503,
    );
  }

  const testerRow = normalizeTesterRow(data as TesterRow | null);

  if (!testerRow) {
    throw new ReadingServiceError(
      "forbidden",
      "当前邮箱不在第一轮内测白名单中。",
      403,
    );
  }

  const tester = {
    userId: user.id,
    email: testerRow.email,
    role: testerRow.role,
  } satisfies AuthenticatedTester;

  assertRequiredRole({ tester, requiredRole });

  return tester;
}
