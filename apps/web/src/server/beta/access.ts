import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReadingServiceError } from "@/server/reading/errors";

export type BetaTesterRole = "tester" | "admin";

export interface AuthenticatedTester {
  userId: string;
  email: string;
  role: BetaTesterRole;
}

export interface AnonymousFeatureActor {
  userId: null;
  email: null;
  role: "anonymous";
}

export type PublicFeatureActor = AuthenticatedTester | AnonymousFeatureActor;

interface TesterRow {
  email?: unknown;
  role?: unknown;
  is_active?: unknown;
}

interface AppUserRow {
  id?: unknown;
}

interface SessionUser {
  id?: unknown;
  sub?: unknown;
  email?: unknown;
}

interface AuthSession {
  user?: SessionUser | null;
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

async function getAuthSession() {
  const { auth } = await import("@/auth");
  return auth();
}

export function isAuthenticatedTester(
  actor: PublicFeatureActor,
): actor is AuthenticatedTester {
  return actor.role !== "anonymous";
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

export function normalizeAuthSession(
  session: AuthSession | null,
): { subject: string; email: string } | null {
  const user = session?.user;
  const subject =
    typeof user?.id === "string"
      ? user.id.trim()
      : typeof user?.sub === "string"
        ? user.sub.trim()
        : "";
  const email = typeof user?.email === "string" ? normalizeEmail(user.email) : "";

  if (!subject || !email) {
    return null;
  }

  return { subject, email };
}

async function resolveAppUserId({
  authSubject,
  email,
}: {
  authSubject: string;
  email: string;
}) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测访问控制未配置服务端 Supabase service role key。",
      503,
    );
  }

  const { data, error } = await adminClient
    .from("app_users")
    .upsert(
      {
        auth_provider: "credentials",
        auth_subject: authSubject,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_provider,auth_subject" },
    )
    .select("id")
    .single();

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测账号映射失败，请稍后再试。",
      503,
    );
  }

  const id = (data as AppUserRow | null)?.id;

  if (typeof id !== "string" || !id) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测账号映射返回无效，请稍后再试。",
      503,
    );
  }

  return id;
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

async function resolveAuthenticatedTester({
  identity,
  requiredRole,
}: {
  identity: { subject: string; email: string };
  requiredRole?: BetaTesterRole;
}) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "内测访问控制未配置服务端 Supabase service role key。",
      503,
    );
  }

  const { data, error: testerError } = await adminClient
    .from("beta_testers")
    .select("email, role, is_active")
    .eq("email", identity.email)
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
    userId: await resolveAppUserId({
      authSubject: identity.subject,
      email: testerRow.email,
    }),
    email: testerRow.email,
    role: testerRow.role,
  } satisfies AuthenticatedTester;

  assertRequiredRole({ tester, requiredRole });

  return tester;
}

async function getBypassTester() {
  const bypassTester =
    getE2eAccessBypassTester() ??
    getE2eAccessBypassTester(await getE2eAccessBypassHeader());

  return bypassTester;
}

export async function requireBetaTesterAccess(
  requiredRole?: BetaTesterRole,
): Promise<AuthenticatedTester> {
  const bypassTester = await getBypassTester();

  if (bypassTester) {
    assertRequiredRole({ tester: bypassTester, requiredRole });
    return bypassTester;
  }

  const identity = normalizeAuthSession(await getAuthSession());

  if (!identity) {
    throw new ReadingServiceError(
      "unauthorized",
      "请先登录后再使用内测 reading 服务。",
      401,
    );
  }

  return resolveAuthenticatedTester({ identity, requiredRole });
}

export async function resolvePublicFeatureActor(): Promise<PublicFeatureActor> {
  const bypassTester = await getBypassTester();

  if (bypassTester) {
    return bypassTester;
  }

  const session = await getAuthSession();

  if (!session?.user) {
    return { userId: null, email: null, role: "anonymous" };
  }

  const identity = normalizeAuthSession(session);

  if (!identity) {
    throw new ReadingServiceError(
      "forbidden",
      "当前登录状态不完整，请重新登录。",
      403,
    );
  }

  return resolveAuthenticatedTester({ identity });
}
