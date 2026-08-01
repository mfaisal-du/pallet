import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccessPath, homePathForRoles, rolesOfUser } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limit login page requests
  if (pathname.startsWith("/login")) {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!rateLimit(ip, 20, 60000)) {
      return new NextResponse("Too many requests", { status: 429 });
    }
  }

  const isLoggedIn = !!req.auth?.user;
  const user = req.auth?.user;
  const roles = user ? rolesOfUser(user as { role: string; roles?: unknown }) : [];

  const isAuthPage = pathname.startsWith("/login");
  const isProtected = pathname.startsWith("/admin");

  // If logged in and hitting login page, redirect to home
  if (isAuthPage && isLoggedIn && roles.length > 0) {
    return NextResponse.redirect(new URL(homePathForRoles(roles), req.url));
  }

  // If not logged in and hitting protected page, redirect to login
  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // If logged in but no role can access this path, redirect to unauthorized.
  // An empty role set is also denied — never let an unknown-role user bypass
  // the access check.
  if (isProtected && (roles.length === 0 || !canAccessPath(roles, pathname))) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
