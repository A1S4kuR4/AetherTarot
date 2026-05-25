import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/reading/:path*",
    "/api/reading-feedback/:path*",
    "/api/encyclopedia/query/:path*",
  ],
};
