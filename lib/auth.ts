import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Set it in .env.local / Vercel and restart."
  );
}
const COOKIE_NAME = "aiva_session";

export interface SessionUser {
  userId: string;
  email: string;
  businessId: string;
  name: string;
  role?: string;
}

export const SUPERADMIN_EMAILS = [
  "bruce.fernando@hotmail.com",
];

export function isSuperAdmin(user?: { email?: string; role?: string } | null): boolean {
  if (!user?.email) return false;
  return (
    user.role === "superadmin" ||
    SUPERADMIN_EMAILS.includes(user.email.toLowerCase().trim())
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
