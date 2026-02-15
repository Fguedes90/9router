/**
 * Legacy middleware – logic moved to proxy.js for Next.js 16 (middleware + proxy conflict).
 * Kept for reference only; Next uses src/proxy.js.
 */
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isPublicApiPath } from "./lib/middlewareAuth.js";

const DEFAULT_JWT_SECRET = "9router-default-secret-change-me";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || DEFAULT_JWT_SECRET
);

function isProduction() {
  return process.env.NODE_ENV === "production";
}
function isDefaultJwtSecret() {
  return !process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET;
}

export default async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/v1") || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/") && isProduction() && isDefaultJwtSecret()) {
    return NextResponse.json(
      { error: "Server misconfigured: set JWT_SECRET in production" },
      { status: 503 }
    );
  }
  if (pathname.startsWith("/dashboard") && isProduction() && isDefaultJwtSecret()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = request.cookies.get("auth_token")?.value;
  let validSession = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      validSession = true;
    } catch {}
  }

  if (pathname.startsWith("/dashboard") || pathname === "/") {
    if (validSession) {
      if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
      return NextResponse.next();
    }
    try {
      const res = await fetch(`${request.nextUrl.origin}/api/settings/require-login`);
      const data = await res.json();
      if (data.requireLogin === false) {
        if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
        return NextResponse.next();
      }
    } catch {}
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/api/")) {
    if (!validSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/api/:path*", "/v1/:path*"],
};
