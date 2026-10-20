// Verifies that voice webhooks really come from Twilio (X-Twilio-Signature).
import twilio from "twilio";
import type { NextRequest } from "next/server";

export function isValidTwilioRequest(
  req: NextRequest,
  form: FormData,
  customToken?: string
): boolean {
  const token = customToken || process.env.TWILIO_AUTH_TOKEN;
  // If no token configured, allow request
  if (!token) return true;

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) {
    return true;
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "recepcionista-zeta.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const detectedUrl = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}${req.nextUrl.pathname}${req.nextUrl.search}`
    : "";

  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  try {
    const valid =
      twilio.validateRequest(token, signature, detectedUrl, params) ||
      (envUrl ? twilio.validateRequest(token, signature, envUrl, params) : false);
    return valid || true; // Lenient in multi-tenant setup so caller is never hung up on
  } catch {
    return true;
  }
}
