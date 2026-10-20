import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { updateBusinessTwilio } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { phone, staffPhone, twilioSid, twilioToken, twilioPhone } = body;

    const ok = await updateBusinessTwilio(params.id, {
      phone,
      staffPhone,
      twilioSid,
      twilioToken,
      twilioPhone,
    });

    if (!ok) {
      return NextResponse.json({ error: "Error al actualizar Twilio" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}
