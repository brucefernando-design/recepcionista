import { NextResponse } from "next/server";
import { findUserByEmail, getBusiness } from "@/lib/db";
import { comparePassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Por favor ingresa tu correo y contraseña." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const business = await getBusiness(user.businessId);

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
    console.error("Login error:", err);
    return NextResponse.json(
      { error: err.message || "Error al iniciar sesión." },
      { status: 500 }
    );
  }
}
