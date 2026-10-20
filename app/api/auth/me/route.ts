import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBusiness, findUserById } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const business = await getBusiness(user.businessId);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      businessId: user.businessId,
      role: user.role,
    },
    business,
  });
}
