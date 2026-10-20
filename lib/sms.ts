// SMS confirmations & reminders via Twilio. Degrades gracefully when Twilio
// credentials aren't configured (returns false instead of throwing).
import twilio from "twilio";
import type { Business } from "./types";

function getClient(business?: Business) {
  const sid = business?.twilioSid || process.env.TWILIO_ACCOUNT_SID;
  const token = business?.twilioToken || process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

// Best-effort E.164 normalization so "555 010 1001" style numbers from
// speech transcription still deliver.
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+1${cleaned}`; // NANP default
  return `+${cleaned}`;
}

export async function sendSms(
  rawTo: string,
  body: string,
  business?: Business
): Promise<boolean> {
  const to = normalizePhone(rawTo);
  const client = getClient(business);
  const fromNumber =
    business?.twilioPhone ||
    business?.phone ||
    process.env.TWILIO_PHONE_NUMBER;

  if (!client || !fromNumber) {
    console.log(`[sms skipped — no Twilio creds] to=${to}: ${body}`);
    return false;
  }
  try {
    await client.messages.create({
      to,
      from: fromNumber,
      body,
    });
    return true;
  } catch (err) {
    console.error("sms send failed", err);
    return false;
  }
}
