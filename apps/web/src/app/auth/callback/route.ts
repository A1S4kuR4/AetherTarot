import { NextResponse, type NextRequest } from "next/server";
import { resolveSafeLocalRedirect } from "@/lib/navigation/safe-local-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    await supabase?.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(resolveSafeLocalRedirect(next, requestUrl.origin));
}
