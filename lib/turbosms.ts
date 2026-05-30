const API_URL = "https://api.turbosms.ua/message/send.json";
const SENDER = process.env.TURBOSMS_SENDER || "СКЛАДКОМ";

export async function sendSms(phone: string, text: string): Promise<boolean> {
  const token = process.env.TURBOSMS_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[TurboSMS DEV] To ${phone}: ${text}`);
      return true;
    }
    throw new Error("TURBOSMS_TOKEN not configured");
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipients: [phone],
      sms: { sender: SENDER, text },
    }),
  });

  const data = await res.json();
  return data?.response_code === 0;
}

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
