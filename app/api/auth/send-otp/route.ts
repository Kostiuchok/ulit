import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { generateOtp, sendSms } from "@/lib/turbosms";

const RATE_LIMIT_KEY = (phone: string) => `otp:ratelimit:${phone}`;
const OTP_KEY = (phone: string) => `otp:${phone}`;
const MAX_ATTEMPTS = 3;
const RATE_WINDOW = 600; // 10 minutes
const OTP_TTL = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone: string = body?.phone?.trim();

  if (!phone || !/^\+380\d{9}$/.test(phone)) {
    return NextResponse.json(
      { error: "Невірний формат номера телефону" },
      { status: 400 }
    );
  }

  const rateKey = RATE_LIMIT_KEY(phone);
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, RATE_WINDOW);

  if (attempts > MAX_ATTEMPTS) {
    const ttl = await redis.ttl(rateKey);
    return NextResponse.json(
      { error: `Забагато спроб. Спробуйте через ${Math.ceil(ttl / 60)} хв` },
      { status: 429 }
    );
  }

  const code = generateOtp();
  await redis.set(OTP_KEY(phone), code, "EX", OTP_TTL);

  const sent = await sendSms(phone, `Ваш код: ${code}. Дійсний 5 хвилин.`);
  if (!sent) {
    return NextResponse.json({ error: "Помилка відправки SMS" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
