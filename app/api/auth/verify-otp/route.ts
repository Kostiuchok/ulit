import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { signToken } from "@/lib/jwt";

const OTP_KEY = (phone: string) => `otp:${phone}`;
const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone: string = body?.phone?.trim();
  const code: string = body?.code?.trim();

  if (!phone || !code) {
    return NextResponse.json({ error: "Відсутні дані" }, { status: 400 });
  }

  const stored = await redis.get(OTP_KEY(phone));
  if (!stored || stored !== code) {
    return NextResponse.json({ error: "Невірний або застарілий код" }, { status: 401 });
  }

  await redis.del(OTP_KEY(phone));

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    user = await db.user.create({
      data: { phone, role: "CUSTOMER", status: "ACTIVE" },
    });
  }

  const token = signToken({ userId: user.id, role: user.role, phone });

  const res = NextResponse.json({ ok: true, userId: user.id, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return res;
}
