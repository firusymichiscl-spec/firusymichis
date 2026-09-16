import { Resend } from "resend";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkInviteQuota, recordAiUsage } from "@/lib/ai/quota";
import crypto from "node:crypto";

// Mismo helper que ya usa app/api/send-notification/route.js.
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function POST(req) {
  const supabase = await createRouteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const quota = await checkInviteQuota(user.id);
  if (!quota.allowed) {
    return Response.json({ error: "Alcanzaste el límite diario de invitaciones. Vuelve mañana." }, { status: 429 });
  }

  const { petId } = await req.json();
  if (!petId) return Response.json({ error: "Falta petId." }, { status: 400 });

  const { data: pet } = await supabase.from("pets").select("id, name").eq("id", petId).eq("user_id", user.id).single();
  if (!pet) return Response.json({ error: "Mascota no encontrada." }, { status: 404 });

  // El correo del tutor suplente sale de la tabla tutors, nunca del body
  // — evita que este endpoint se use para mandar invitaciones a
  // cualquier correo arbitrario.
  const { data: secondary } = await supabase
    .from("tutors")
    .select("full_name, email")
    .eq("pet_id", petId)
    .eq("type", "secondary")
    .single();

  if (!secondary?.email) {
    return Response.json({ error: "El tutor suplente necesita tener un correo guardado antes de invitarlo." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("pet_access")
    .select("id, status, invite_token, created_at")
    .eq("pet_id", petId)
    .eq("email", secondary.email)
    .maybeSingle();

  const EXPIRY_MS = 24 * 60 * 60 * 1000;
  let inviteToken;

  if (existing?.status === "accepted") {
    return Response.json({ error: "Este tutor ya tiene acceso a la mascota." }, { status: 400 });
  } else if (existing) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs < EXPIRY_MS) {
      // Invitación todavía vigente — no se reenvía el correo, solo se avisa.
      const horasRestantes = Math.max(1, Math.ceil((EXPIRY_MS - ageMs) / (60 * 60 * 1000)));
      return Response.json({
        success: true,
        message: `Ya le enviamos una invitación a ${secondary.email} — sigue vigente por ${horasRestantes} hora${horasRestantes === 1 ? "" : "s"} más.`,
      });
    }
    // Expiró — se renueva el token y la fecha, y se manda un correo nuevo.
    const { data: updated, error } = await supabase
      .from("pet_access")
      .update({ invite_token: crypto.randomUUID(), created_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("invite_token")
      .single();
    if (error) return Response.json({ error: "No se pudo renovar la invitación." }, { status: 500 });
    inviteToken = updated.invite_token;
  } else {
    const { data: created, error } = await supabase
      .from("pet_access")
      .insert({ pet_id: petId, email: secondary.email, invited_by: user.id })
      .select("invite_token")
      .single();
    if (error) return Response.json({ error: "No se pudo crear la invitación." }, { status: 500 });
    inviteToken = created.invite_token;
  }

  const link = `https://firusymichis.cl/invitacion?token=${inviteToken}`;
  const inviterNameRaw = user.user_metadata?.full_name || user.user_metadata?.name || "Alguien";
  const inviterName = esc(inviterNameRaw);
  const petName = esc(pet.name);
  const secondaryName = secondary.full_name ? esc(secondary.full_name) : "";
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: "Firus&Michis <notificaciones@firusymichis.cl>",
      to: [secondary.email],
      subject: `${inviterNameRaw} te invitó a ${pet.name} en Firus&Michis`,
      html: `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background-color:#FFF8F3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF8F3;"><tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;">
<tr><td align="center" bgcolor="#FF6B35" style="background-color:#FF6B35;padding:24px 20px;border-radius:16px 16px 0 0;">
<span style="font-size:24px;font-weight:bold;color:#ffffff;">&#128062; Firus&amp;Michis</span>
</td></tr>
<tr><td style="padding:24px 20px;color:#3D1F0A;">
<p style="margin:0 0 12px;font-size:18px;font-weight:bold;">Te invitaron a ${petName} &#128062;</p>
<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#7A4522;">${secondaryName ? secondaryName + ", te" : "Te"} invitaron como tutor suplente de ${petName} en Firus&amp;Michis. Vas a poder ver su ficha y registrar cuando le des sus medicamentos.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr><td align="center" bgcolor="#FF6B35" style="border-radius:10px;">
<a href="${link}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Aceptar invitación</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 20px;text-align:center;font-size:13px;color:#C4845A;border-top:1px solid #F5E6DA;">Firus&amp;Michis &middot; firusymichis.cl</td></tr>
</table></td></tr></table>
</body></html>`,
    });
  } catch (e) {
    return Response.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }

  await recordAiUsage(user.id, "tutor_invite");

  return Response.json({ success: true });
}
