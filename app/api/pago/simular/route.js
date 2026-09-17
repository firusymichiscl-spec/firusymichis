import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const PLAN_PRICES = { 3: 7990, 6: 14990, 12: 24990 };

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

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
  if (!price) {
    return NextResponse.json({ error: "Duración de plan inválida" }, { status: 400 });
  }

  // Pago simulado: no hay pasarela real todavía, así que este endpoint
  // hace el UPDATE directamente. RLS de profiles no permite UPDATE a
  // usuarios normales (ver 20260610_seguridad_cuotas.sql) — se usa
  // service role, acotado a esta única fila (auth.uid() ya validado
  // arriba, nunca un id que venga del body).
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const { error } = await svc.from("profiles")
    .update({ plan: "pro", plan_expires_at: expiresAt.toISOString(), plan_started_at: now.toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from("purchases").insert({
    user_id: user.id,
    plan_id: `pro_${months}m`,
    months,
    amount_clp: price,
    status: "simulado",
  });

  // Correo de comprobante — claramente marcado como simulación, no un
  // cobro real, hasta que se conecte una pasarela de pago de verdad.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fechaTexto = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    await resend.emails.send({
      from: "Firus&Michis <notificaciones@firusymichis.cl>",
      to: [user.email],
      subject: `Comprobante — Plan PRO ${months} meses (prueba interna)`,
      html: `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background-color:#FFF8F3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF8F3;"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;">
<tr><td align="center" bgcolor="#FF6B35" style="background-color:#FF6B35;padding:24px 20px;border-radius:16px 16px 0 0;">
<span style="font-size:24px;font-weight:bold;color:#ffffff;">&#128062; Firus&amp;Michis</span>
</td></tr>
<tr><td style="padding:24px 20px;color:#3D1F0A;">
<p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#dc2626;text-transform:uppercase;">Prueba interna — no es un cobro real</p>
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;">Comprobante de activación</p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Plan: <strong>PRO — ${esc(String(months))} meses</strong></p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Monto: <strong>$${price.toLocaleString("es-CL")} CLP</strong></p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Fecha: <strong>${esc(fechaTexto)}</strong></p>
<p style="margin:16px 0 0;font-size:12px;color:#B08968;">Este correo se generó como parte de pruebas internas del sistema de pagos de Firus&amp;Michis. Ningún cobro real fue procesado.</p>
</td></tr>
<tr><td style="padding:16px 20px;text-align:center;font-size:13px;color:#C4845A;border-top:1px solid #F5E6DA;">Firus&amp;Michis &middot; firusymichis.cl</td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (e) {
    console.error("[pago/simular] error enviando comprobante:", e);
  }

  return NextResponse.json({ ok: true, plan: "pro", plan_expires_at: expiresAt.toISOString() });
}
