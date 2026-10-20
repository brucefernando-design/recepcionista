import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getSuperadminStats } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  const stats = await getSuperadminStats();
  return NextResponse.json(stats);
}
