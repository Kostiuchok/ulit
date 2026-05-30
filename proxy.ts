import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "CONTENT", "SALES"]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Allow the login page itself
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const payload = verifyToken(token);
  if (!payload || !ADMIN_ROLES.has(payload.role)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
