import { createHmac, timingSafeEqual } from "node:crypto";

export function validateTelegramInitData(initData: string, botToken: string) {
  if (!initData) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const calculated = Buffer.from(calculatedHash, "hex");
  const received = Buffer.from(hash, "hex");

  return calculated.length === received.length && timingSafeEqual(calculated, received);
}
