const RATE_LIMITS = {
  p_email_hourly_limit: 10,
  p_email_daily_limit: 30,
  p_ip_hourly_limit: 20,
  p_global_hourly_limit: 200,
} as const;

type AuthRateLimitClient = {
  rpc: (
    name: "consume_auth_email_quota",
    params: {
      p_email: string;
      p_ip_hash: string;
      p_email_hourly_limit: number;
      p_email_daily_limit: number;
      p_ip_hourly_limit: number;
      p_global_hourly_limit: number;
    },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function checkAuthRateLimit(
  admin: AuthRateLimitClient,
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
      console.error("[auth] rate limit RPC failed; denying login");
      return false;
    }

    const result = data as { allowed?: unknown } | null;
    return result?.allowed === true;
  } catch {
    console.error("[auth] rate limit check threw; denying login");
    return false;
  }
}
