import { ZodError, z } from "zod";
import type { ReadingErrorPayload } from "@aethertarot/shared-types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolvePublicRequestOrigin,
  resolveSafeLocalRedirect,
} from "@/lib/navigation/safe-local-redirect";
import { createClient } from "@/lib/supabase/server";
import { normalizeTesterRow } from "@/server/beta/access";
import { getClientIpHash } from "@/server/beta/ip";
import { consumeAuthEmailQuota } from "@/server/beta/quota";
import { readBoundedJsonBody } from "@/server/http/json-body";
import {
  recordAuthEmailEvent,
  type AuthEmailEventInput,
} from "@/server/observability/auth-email-events";
import {
  isReadingServiceError,
  ReadingServiceError,
} from "@/server/reading/errors";

export const runtime = "nodejs";

const MAX_LOGIN_LINK_REQUEST_BYTES = 4 * 1024;

const loginLinkPayloadSchema = z.object({
  email: z.string().trim().email("邮箱格式无效。").max(254),
  next: z.string().trim().max(512).optional(),
});

type LoginLinkPayload = z.infer<typeof loginLinkPayloadSchema>;

interface SendLoginLinkInput {
  email: string;
  redirectTo: string;
}

interface LoginLinkRouteDependencies {
  getIpHash: (request: Request) => string;
  consumeQuota: (input: { email: string; ipHash: string }) => Promise<void>;
  findActiveTesterEmail: (email: string) => Promise<string | null>;
  sendLoginLink: (input: SendLoginLinkInput) => Promise<void>;
  recordEvent: (input: AuthEmailEventInput) => Promise<void>;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function findActiveTesterEmail(email: string) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "登录发信白名单未配置 Supabase service role key。",
      503,
    );
  }

  const { data, error } = await adminClient
    .from("beta_testers")
    .select("email, role, is_active")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "登录发信白名单查询失败，请稍后再试。",
      503,
    );
  }

  return normalizeTesterRow(data)?.email ?? null;
}

async function sendSupabaseLoginLink({ email, redirectTo }: SendLoginLinkInput) {
  const supabase = await createClient();

  if (!supabase) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "Supabase 尚未配置，暂时无法登录。",
      503,
    );
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    throw new ReadingServiceError(
      "provider_unavailable",
      "登录服务暂时不可用，请稍后重试。",
      503,
      undefined,
      undefined,
      { provider_error: error.message },
    );
  }
}

const DEFAULT_DEPENDENCIES: LoginLinkRouteDependencies = {
  getIpHash: getClientIpHash,
  consumeQuota: consumeAuthEmailQuota,
  findActiveTesterEmail,
  sendLoginLink: sendSupabaseLoginLink,
  recordEvent: recordAuthEmailEvent,
};

function buildErrorResponse(
  code: ReadingErrorPayload["error"]["code"],
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  const payload: ReadingErrorPayload = {
    error: {
      code,
      message,
      details,
    },
  };

  return Response.json(payload, { status });
}

function getPublicOrigin(request: Request) {
  const requestUrl = new URL(request.url);

  return resolvePublicRequestOrigin({
    requestUrl,
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  });
}

function getCallbackRedirectTo(request: Request, next: string | undefined) {
  const publicOrigin = getPublicOrigin(request);
  const safeNextUrl = resolveSafeLocalRedirect(next ?? "/", publicOrigin);
  const safeNextPath = `${safeNextUrl.pathname}${safeNextUrl.search}${safeNextUrl.hash}`;
  const callbackUrl = new URL("/auth/callback", publicOrigin);

  callbackUrl.searchParams.set("next", safeNextPath);

  return callbackUrl.toString();
}

function getEventBase({
  email,
  ipHash,
  startedAt,
}: {
  email: string | null;
  ipHash: string;
  startedAt: number;
}) {
  return {
    email,
    ipHash,
    durationMs: Date.now() - startedAt,
  };
}

export async function handleLoginLinkPost(
  request: Request,
  dependencies: Partial<LoginLinkRouteDependencies> = {},
) {
  const deps = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const startedAt = Date.now();
  const ipHash = deps.getIpHash(request);
  let payload: unknown;
  let email: string | null = null;

  const recordEvent = async (input: AuthEmailEventInput) => {
    await deps.recordEvent(input);
  };

  try {
    payload = await readBoundedJsonBody(
      request,
      MAX_LOGIN_LINK_REQUEST_BYTES,
      "登录发信",
    );
  } catch (error) {
    await recordEvent({
      ...getEventBase({ email, ipHash, startedAt }),
      status: "failure",
      errorCode: "invalid_request",
    });
    if (isReadingServiceError(error)) {
      return buildErrorResponse(error.code, error.message, error.status);
    }

    return buildErrorResponse("invalid_request", "请求体不是有效的 JSON。", 400);
  }

  try {
    const parsedPayload: LoginLinkPayload = loginLinkPayloadSchema.parse(payload);
    email = normalizeEmail(parsedPayload.email);

    await deps.consumeQuota({ email, ipHash });

    const activeTesterEmail = await deps.findActiveTesterEmail(email);

    if (!activeTesterEmail) {
      await recordEvent({
        ...getEventBase({ email, ipHash, startedAt }),
        status: "failure",
        errorCode: "not_whitelisted",
      });

      return Response.json({ ok: true });
    }

    await deps.sendLoginLink({
      email: activeTesterEmail,
      redirectTo: getCallbackRedirectTo(request, parsedPayload.next),
    });

    await recordEvent({
      ...getEventBase({ email: activeTesterEmail, ipHash, startedAt }),
      status: "success",
      errorCode: null,
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0]?.message ?? "请求参数无效。";
      await recordEvent({
        ...getEventBase({ email, ipHash, startedAt }),
        status: "failure",
        errorCode: "invalid_request",
      });
      return buildErrorResponse("invalid_request", firstIssue, 400);
    }

    if (isReadingServiceError(error)) {
      await recordEvent({
        ...getEventBase({ email, ipHash, startedAt }),
        status: "failure",
        errorCode: error.code,
      });
      return buildErrorResponse(
        error.code,
        error.message,
        error.status,
        error.details,
      );
    }

    await recordEvent({
      ...getEventBase({ email, ipHash, startedAt }),
      status: "failure",
      errorCode: "generation_failed",
    });
    return buildErrorResponse(
      "generation_failed",
      "登录链接发送失败，请稍后再试。",
      500,
    );
  }
}

export async function POST(request: Request) {
  return handleLoginLinkPost(request);
}
