import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { flowCreatePayment } from "@/lib/flow";

const PLAN_PRICES = { 3: 7990, 6: 14990, 12: 24990 };

export async function POST(req) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { months } = await req.json();
  const price = PLAN_PRICES[months];
  if (!price) return NextResponse.json({ error: "Duración de plan inválida" }, { status: 400 });

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // El id de la compra ES el commerceOrder que le pasamos a Flow — así,
  // cuando Flow confirme el pago, encontramos la fila directo por ese
  // mismo id sin necesidad de una columna aparte.
  const commerceOrder = crypto.randomUUID();
  const { error: insertError } = await svc.from("purchases").insert({
    id: commerceOrder,
    user_id: user.id,
    plan_id: `pro_${months}m`,
    months,
    amount_clp: price,
    status: "pendiente",
  });
  if (insertError) return NextResponse.json({ error: "No se pudo iniciar la compra" }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://firusymichis.cl";

  try {
    const flowRes = await flowCreatePayment({
      commerceOrder,
      subject: `Firus&Michis - Plan PRO ${months} meses`,
      amount: price,
      email: user.email,
      urlConfirmation: `${origin}/api/pago/flow/confirmacion`,
      urlReturn: `${origin}/api/pago/flow/retorno`,
    });
    return NextResponse.json({ url: `${flowRes.url}?token=${flowRes.token}` });
  } catch (e) {
    await svc.from("purchases").update({ status: "error" }).eq("id", commerceOrder);
    return NextResponse.json({ error: e.message || "No se pudo conectar con Flow" }, { status: 500 });
  }
}
