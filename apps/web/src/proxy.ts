export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/reading/:path*",
    "/api/reading-feedback/:path*",
    "/api/encyclopedia/query/:path*",
  ],
};
