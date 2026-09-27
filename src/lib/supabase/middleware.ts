import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function loginRedirect(request: NextRequest, copyAuthCookies: (target: NextResponse) => void) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  copyAuthCookies(response);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cookieWrites: Array<(target: NextResponse) => void> = [];
  const copyAuthCookies = (target: NextResponse) => {
    for (const write of cookieWrites) write(target);
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return loginRedirect(request, copyAuthCookies);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookieWrites.push((target) => {
          cookiesToSet.forEach(({ name, value, options }) => target.cookies.set(name, value, options));
          for (const [name, value] of Object.entries(headers)) target.headers.set(name, value);
        });
        response = NextResponse.next({ request });
        copyAuthCookies(response);
      },
    },
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return loginRedirect(request, copyAuthCookies);

    if (request.nextUrl.pathname === "/users") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin") {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        dashboardUrl.search = "";
        const redirectResponse = NextResponse.redirect(dashboardUrl);
        copyAuthCookies(redirectResponse);
        redirectResponse.headers.set("Cache-Control", "private, no-store");
        return redirectResponse;
      }
    }
  } catch {
    return loginRedirect(request, copyAuthCookies);
  }

  if (request.nextUrl.pathname === "/") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    copyAuthCookies(redirectResponse);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  return response;
}
