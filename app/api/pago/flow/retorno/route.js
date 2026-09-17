import { NextResponse } from "next/server";

export async function POST(req) {
  const formData = await req.formData();
  const token = formData.get("token") || "";
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://firusymichis.cl";
  return NextResponse.redirect(`${origin}/pago/resultado?token=${encodeURIComponent(token)}`, { status: 303 });
}
