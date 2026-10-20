import { NextRequest, NextResponse } from "next/server";
import { getAppointments, getCalls, getOrders } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregated data for the dashboard.
export async function GET(req: NextRequest) {
  const session = await getSession();
  const requestedBizId = req.nextUrl.searchParams.get("businessId");
  const businessId = session?.businessId || (requestedBizId ?? undefined);

  const [appointments, orders, calls] = await Promise.all([
    getAppointments(businessId),
    getOrders(businessId),
    getCalls(businessId),
  ]);
  return NextResponse.json({ appointments, orders, calls });
}
