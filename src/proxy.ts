import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { BUYER_SESSION_COOKIE } from "@/lib/auth/buyer";

// ── Route configuration ────────────────────────────────────────────────────

const PUBLIC_ROUTES = ["/login", "/admin/login"];
const ADMIN_PREFIX = "/admin";
const PORTAL_PREFIX = "/dashboard";

// ── JWT verification (inline — no DB calls in proxy) ──────────────────────

async function getBuyerSessionFromCookie(
  request: NextRequest
): Promise<{ profileId: string; role: string } | null> {
  const token = request.cookies.get(BUYER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || typeof payload.app_role !== "string")
      return null;

    return { profileId: payload.sub, role: payload.app_role };
  } catch {
    return null;
  }
}

// ── Proxy (Next.js 16 replacement for middleware) ──────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public routes and Next.js internals immediately
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ── Admin routes (/admin/*) ──────────────────────────────────────────────
  if (pathname.startsWith(ADMIN_PREFIX)) {
    // Refresh Supabase Auth session tokens on every request (prevents expiry)
    const supabase = createMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return response;
  }

  // ── Portal routes (/dashboard/*) ────────────────────────────────────────
  if (pathname.startsWith(PORTAL_PREFIX)) {
    // Check buyer session first (no DB call — just JWT verification)
    const buyerSession = await getBuyerSessionFromCookie(request);
    if (buyerSession) return response;

    // Check Supabase Auth session (for admins who may also access the portal)
    const supabase = createMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) return response;

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Root redirect ────────────────────────────────────────────────────────
  if (pathname === "/") {
    const buyerSession = await getBuyerSessionFromCookie(request);
    if (buyerSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const supabase = createMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
