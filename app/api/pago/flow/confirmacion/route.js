import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { flowGetStatus } from "@/lib/flow";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function POST(req) {
  const formData = await req.formData();
  const token = formData.get("token");
  if (!token) return new Response("Falta token", { status: 400 });

  let status;
  try {
    status = await flowGetStatus(token);
  } catch (e) {
    console.error("[flow/confirmacion] error consultando estado:", e);
    return new Response("Error consultando estado", { status: 500 });
  }

  const svc = serviceClient();
  const { data: purchase } = await svc.from("purchases").select("*").eq("id", status.commerceOrder).maybeSingle();
  if (!purchase) return new Response("Orden no encontrada", { status: 404 });

  if (status.status === 2 && purchase.status !== "pagado") {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + purchase.months);

    await svc.from("profiles")
      .update({ plan: "pro", plan_expires_at: expiresAt.toISOString(), plan_started_at: now.toISOString() })
      .eq("id", purchase.user_id);
    await svc.from("purchases").update({ status: "pagado" }).eq("id", purchase.id);

    const { data: authUser } = await svc.auth.admin.getUserById(purchase.user_id);
    const email = authUser?.user?.email;
    if (email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fechaTexto = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
        await resend.emails.send({
          from: "Firus&Michis <notificaciones@firusymichis.cl>",
          to: [email],
          subject: `Comprobante — Plan PRO ${purchase.months} meses`,
          html: `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background-color:#FFF8F3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF8F3;"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;">
<tr><td align="center" bgcolor="#FF6B35" style="background-color:#FF6B35;padding:24px 20px;border-radius:16px 16px 0 0;"><span style="font-size:24px;font-weight:bold;color:#ffffff;">&#128062; Firus&amp;Michis</span></td></tr>
<tr><td style="padding:24px 20px;color:#3D1F0A;">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;">¡Pago confirmado! &#127881;</p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Plan: <strong>PRO — ${esc(String(purchase.months))} meses</strong></p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Monto: <strong>$${purchase.amount_clp.toLocaleString("es-CL")} CLP</strong></p>
<p style="margin:0 0 8px;font-size:14px;color:#7A4522;">Fecha: <strong>${esc(fechaTexto)}</strong></p>
</td></tr>
<tr><td style="padding:16px 20px;text-align:center;font-size:13px;color:#C4845A;border-top:1px solid #F5E6DA;">Firus&amp;Michis &middot; firusymichis.cl</td></tr>
</table></td></tr></table></body></html>`,
        });
      } catch (e) { console.error("[flow/confirmacion] error enviando correo:", e); }
    }
  } else if (status.status === 3 || status.status === 4) {
    await svc.from("purchases").update({ status: status.status === 3 ? "rechazado" : "anulado" }).eq("id", purchase.id);
  }

  // Flow exige responder 200 para no reintentar el webhook.
  return new Response("OK", { status: 200 });
}
