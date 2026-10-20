import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { signToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, businessName, businessType, businessPhone } = body;

    if (!email || !password || !name || !businessName) {
      return NextResponse.json(
        { error: "Por favor completa todos los campos obligatorios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const { user, business } = await createUser({
      email,
      password,
      name,
      businessName,
      businessType: businessType || "clinic",
      businessPhone: businessPhone || "+1 (555) 000-0000",
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessId: user.businessId,
      name: user.name,
    });

    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessId: user.businessId,
      },
      business,
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return res;
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: err.message || "Error al registrar la cuenta." },
      { status: 400 }
    );
  }
}
