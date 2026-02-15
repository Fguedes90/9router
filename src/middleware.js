import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isPublicApiPath } from "./lib/middlewareAuth.js";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "9router-default-secret-change-me"
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public API and v1 proxy (API key auth in handler)
  if (pathname.startsWith("/v1") || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  // Protect dashboard and all other API routes with session
  const token = request.cookies.get("auth_token")?.value;
  let validSession = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      validSession = true;
    } catch {
      // invalid or expired
    }
  }

  // Dashboard: redirect to login if no valid session and requireLogin is true
  if (pathname.startsWith("/dashboard") || pathname === "/") {
    if (validSession) {
      if (pathname === "/") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.next();
    }
    try {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/settings/require-login`);
      const data = await res.json();
      if (data.requireLogin === false) {
        if (pathname === "/") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next();
      }
    } catch {
      // On error, require login
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protected /api/*: require valid session
  if (pathname.startsWith("/api/")) {
    if (!validSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/:path*",
    "/v1/:path*",
  ],
};
