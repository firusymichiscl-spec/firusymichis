import { NextResponse } from "next/server";
import { flowGetStatus } from "@/lib/flow";

export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Falta token" }, { status: 400 });
  try {
    const status = await flowGetStatus(token);
    return NextResponse.json({ status: status.status, amount: status.amount });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo consultar el estado" }, { status: 500 });
  }
}
