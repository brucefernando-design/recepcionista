import { NextResponse } from "next/server";
import { getBusinesses, getBusiness } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (session?.businessId) {
    const biz = await getBusiness(session.businessId);
    if (biz) return NextResponse.json([biz]);
  }
  const businesses = await getBusinesses();
  return NextResponse.json(businesses);
}
