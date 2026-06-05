import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/server/auth/password";
import { getClientIpHash } from "@/server/beta/ip";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
    };
  }
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

// --- Rate limiting ---

// 硬编码的登录限流阈值。内测阶段不通过环境变量暴露，
// 如需调整，直接修改此对象后重新部署。
const RATE_LIMITS = {
  p_email_hourly_limit: 10,
  p_email_daily_limit: 30,
  p_ip_hourly_limit: 20,
  p_global_hourly_limit: 200,
} as const;

async function checkAuthRateLimit(
  admin: AdminClient,
  email: string,
  ipHash: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("consume_auth_email_quota", {
      p_email: email,
      p_ip_hash: ipHash,
      ...RATE_LIMITS,
    });

    if (error) {
      console.error("[auth] rate limit RPC failed, degrading to allow:", error);
      return true;
    }

    const result = data as { allowed?: boolean } | null;
    return result?.allowed !== false;
  } catch (err) {
    console.error("[auth] rate limit check threw, degrading to allow:", err);
    return true;
  }
}

// --- Audit logging ---

interface AuthEventParams {
  email: string;
  ipHash: string;
  status: "success" | "failure";
  errorCode: string | null;
  durationMs: number;
}

async function logAuthEvent(
  admin: AdminClient,
  params: AuthEventParams,
): Promise<void> {
  try {
    await admin.from("auth_email_events").insert({
      email: params.email,
      ip_hash: params.ipHash,
      status: params.status,
      error_code: params.errorCode,
      duration_ms: params.durationMs,
    });
  } catch (err) {
    console.error("[auth] audit log insert failed:", err);
  }
}

// --- Authorize ---

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials, request) {
        const start = Date.now();

        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) return null;

        const admin = createAdminClient();
        if (!admin) return null;

        const ipHash = getClientIpHash(request);

        // Rate limit check — before password verification
        const allowed = await checkAuthRateLimit(admin, email, ipHash);
        if (!allowed) {
          await logAuthEvent(admin, {
            email,
            ipHash,
            status: "failure",
            errorCode: "rate_limited",
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Lookup user
        const { data } = await admin
          .from("beta_testers")
          .select("email, role, is_active, password_hash")
          .eq("email", email)
          .eq("is_active", true)
          .maybeSingle();

        if (!data || !data.password_hash) {
          await logAuthEvent(admin, {
            email,
            ipHash,
            status: "failure",
            errorCode: "email_not_found",
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Password verification
        const valid = verifyPassword(password, data.password_hash);
        if (!valid) {
          await logAuthEvent(admin, {
            email,
            ipHash,
            status: "failure",
            errorCode: "invalid_password",
            durationMs: Date.now() - start,
          });
          return null;
        }

        // Success
        await logAuthEvent(admin, {
          email,
          ipHash,
          status: "success",
          errorCode: null,
          durationMs: Date.now() - start,
        });

        return { id: data.email, email: data.email };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.email) {
        token.sub = user.email;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
