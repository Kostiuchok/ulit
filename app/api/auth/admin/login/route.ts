import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/jwt";

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email: string = body?.email?.trim().toLowerCase();
  const password: string = body?.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Відсутні дані" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Невірний email або пароль" }, { status: 401 });
  }

  const adminRoles = ["SUPER_ADMIN", "ADMIN", "CONTENT", "SALES"];
  if (!adminRoles.includes(user.role)) {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Акаунт деактивовано" }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Невірний email або пароль" }, { status: 401 });
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ userId: user.id, role: user.role, email });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return res;
}
