import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

const DEFAULT_JWT_SECRET = "9router-default-secret-change-me";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || DEFAULT_JWT_SECRET
);

export async function POST(request) {
  try {
    if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET)) {
      return NextResponse.json(
        { error: "Server misconfigured: set JWT_SECRET in production" },
        { status: 503 }
      );
    }
    const { password } = await request.json();
    const settings = await getSettings();

    // Default password is '123456' if not set
    const storedHash = settings.password;

    let isValid = false;
    if (storedHash) {
      isValid = await bcrypt.compare(password, storedHash);
    } else {
      // Use env var or default
      const initialPassword = process.env.INITIAL_PASSWORD || "123456";
      isValid = password === initialPassword;
    }

    if (isValid) {
      const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const isHttpsRequest = forwardedProto === "https";
      const useSecureCookie = forceSecureCookie || isHttpsRequest;

      const token = await new SignJWT({ authenticated: true })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h")
        .sign(SECRET);

      const cookieStore = await cookies();
      cookieStore.set("auth_token", token, {
        httpOnly: true,
        secure: useSecureCookie,
        sameSite: "lax",
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
