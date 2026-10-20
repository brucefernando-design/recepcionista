// Verifies that voice webhooks really come from Twilio (X-Twilio-Signature).
// Without this, anyone who finds your URL could drive your phone agent.
import twilio from "twilio";
import type { NextRequest } from "next/server";

export function isValidTwilioRequest(
  req: NextRequest,
  form: FormData
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  // Dev mode: no token configured → skip validation so local testing works.
  if (!token) return true;

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) {
    console.warn("[Twilio Auth] Missing x-twilio-signature header");
    return false;
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const defaultBaseUrl = host ? `${proto}://${host}` : "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || defaultBaseUrl;
  const url = `${baseUrl}${req.nextUrl.pathname}${req.nextUrl.search}`;

  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  const valid = twilio.validateRequest(token, signature, url, params);
  if (!valid) {
    console.warn(`[Twilio Auth] Signature verification failed for URL: ${url}`);
  }
  return valid;
}
