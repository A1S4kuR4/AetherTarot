import { NextResponse, type NextRequest } from "next/server";
import {
  resolvePublicRequestOrigin,
  resolveSafeLocalRedirect,
} from "@/lib/navigation/safe-local-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const publicOrigin = resolvePublicRequestOrigin({
    requestUrl,
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  });

  if (code) {
    const supabase = await createClient();
    await supabase?.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(resolveSafeLocalRedirect(next, publicOrigin));
}
