import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/machines/:path*",
    "/alarms/:path*",
    "/maintenance/:path*",
    "/users/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/audit/:path*",
    "/requests/:path*",
    "/history/:path*",
  ],
};
