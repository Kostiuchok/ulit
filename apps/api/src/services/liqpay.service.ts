import crypto from "crypto";

export interface LiqPayParams {
  orderId: string;
  amount: number;
  description: string;
  currency?: string;
  resultUrl?: string;
  serverUrl?: string;
}

export function generateLiqPayForm(params: LiqPayParams): { data: string; signature: string } {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY || "sandbox_public_key";
  const privateKey = process.env.LIQPAY_PRIVATE_KEY || "sandbox_private_key";

  const dataObj = {
    version: 3,
    public_key: publicKey,
    action: "pay",
    amount: params.amount,
    currency: params.currency ?? "UAH",
    description: params.description,
    order_id: params.orderId,
    result_url: params.resultUrl,
    server_url: params.serverUrl,
    language: "uk",
  };

  const data = Buffer.from(JSON.stringify(dataObj)).toString("base64");
  const signature = signLiqPay(privateKey, data);
  return { data, signature };
}

export function verifyLiqPaySignature(data: string, signature: string): boolean {
  const privateKey = process.env.LIQPAY_PRIVATE_KEY || "sandbox_private_key";
  return signLiqPay(privateKey, data) === signature;
}

export function parseLiqPayData(data: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
}

function signLiqPay(privateKey: string, data: string): string {
  return crypto.createHash("sha1").update(privateKey + data + privateKey).digest("base64");
}

export const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
