import { Resend } from "resend";
import crypto from "node:crypto";
import { createRouteSupabase } from "@/lib/supabase-route";
import { checkEmailTestQuota, recordAiUsage } from "@/lib/ai/quota";

// ── Plantilla responsive ────────────────────────────────────────────
// Reglas de compatibilidad de email (Gmail móvil / Apple Mail iOS / Outlook):
// - Layout con <table> anidadas, nunca flexbox/grid (Outlook de escritorio
//   usa el motor de Word para renderizar HTML y no soporta CSS moderno).
// - max-width:600px + width="100%" en vez de un ancho fijo, para que se
//   adapte al viewport del celular.
// - Estilos INLINE en cada elemento — Gmail elimina el <style> del <head>
//   en la mayoría de sus clientes (web y móvil).
// - <meta name="viewport"> para que Apple Mail / iOS no escale la página.
// - Arial/Helvetica con fallback sans-serif — Baloo 2 y Nunito (Google
//   Fonts) no cargan en clientes de correo, que bloquean requests externos.
// - Botones como tabla con <td bgcolor> + <a style="display:inline-block">
//   en vez de <button>, que Outlook no soporta.
// - Ningún texto por debajo de 14px — iOS Mail auto-agranda el texto chico
//   y puede romper el layout si el diseño no lo contempla.
function buildEmail({ subtitle, bodyHtml, accentColor = "#FF6B35" }) {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Firus&amp;Michis</title>
</head>
<body style="margin:0; padding:0; background-color:#FFF8F3; -webkit-text-size-adjust:100%; text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF8F3;">
    <tr>
      <td align="center" style="padding:20px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:16px;">
          <tr>
            <td align="center" bgcolor="${accentColor}" style="background-color:${accentColor}; padding:24px 20px; border-radius:16px 16px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:Arial, Helvetica, sans-serif; font-size:24px; line-height:28px; font-weight:bold; color:#ffffff;">&#128062; Firus&amp;Michis</td></tr></table>
              ${subtitle ? `<div style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:18px; color:#ffffff; opacity:0.9; margin-top:6px;">${subtitle}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 20px; font-family:Arial, Helvetica, sans-serif; color:#3D1F0A;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px; text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#C4845A; border-top:1px solid #F5E6DA;">
              Firus&amp;Michis &middot; firusymichis.cl<br>
              Para desactivar estas alertas, ve a Configuraci&oacute;n en la app.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(label, href, color = "#FF6B35", textColor = "#ffffff") {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
      <tr>
        <td align="center" bgcolor="${color}" style="border-radius:10px;">
          <a href="${href}" style="display:inline-block; padding:12px 20px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:18px; font-weight:bold; color:${textColor}; text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function card(innerHtml, borderColor) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff8f3; border-radius:12px; margin:16px 0;">
      <tr>
        <td style="padding:14px 16px; border-left:4px solid ${borderColor}; font-family:Arial, Helvetica, sans-serif;">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
}

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// ── Constructores de contenido por tipo ─────────────────────────────

function medicationBody({ petName, medicationName, scheduledTime }) {
  return {
    subject: `⏰ Hora de darle ${medicationName} a ${petName}`,
    subtitle: "Recordatorio de medicamento",
    bodyHtml: `
      <p style="margin:0 0 8px; font-size:18px; line-height:24px; font-weight:bold; color:#3D1F0A;">&#128138; Es hora de medicar a ${esc(petName)}</p>
      ${card(`<p style="margin:0; font-size:16px; line-height:22px; font-weight:bold; color:#3D1F0A;">${esc(medicationName)}</p><p style="margin:4px 0 0; color:#C4845A; font-size:14px; line-height:18px;">Hora programada: ${esc(scheduledTime)}</p>`, "#FF6B35")}
      <p style="color:#7A4522; font-size:14px; line-height:20px;">Recuerda registrar la dosis en la app una vez administrada.</p>
      ${button("Abrir Firus&amp;Michis", "https://firusymichis.cl/dashboard")}
    `,
  };
}

function vaccineBody({ petName, medicationName, scheduledTime }) {
  return {
    subject: `\u{1F489} Vacuna próxima a vencer — ${petName}`,
    subtitle: null,
    bodyHtml: `
      <p style="margin:0 0 8px; font-size:18px; line-height:24px; font-weight:bold; color:#3D1F0A;">&#128137; Vacuna pr&oacute;xima para ${esc(petName)}</p>
      ${card(`<p style="margin:0; font-size:16px; line-height:22px; font-weight:bold; color:#3D1F0A;">${esc(medicationName)}</p><p style="margin:4px 0 0; color:#C4845A; font-size:14px; line-height:18px;">Fecha: ${esc(scheduledTime)}</p>`, "#2EC4B6")}
      ${button("Ver vacunas en la app", "https://firusymichis.cl/dashboard", "#2EC4B6", "#ffffff")}
    `,
  };
}

function lowStockBody({ petName, medicationName, stockRemaining }) {
  return {
    subject: `\u{1F4E6} Stock bajo — ${medicationName} para ${petName}`,
    subtitle: null,
    bodyHtml: `
      <p style="margin:0 0 8px; font-size:18px; line-height:24px; font-weight:bold; color:#3D1F0A;">&#128230; Stock bajo de medicamento</p>
      ${card(`<p style="margin:0; font-size:16px; line-height:22px; font-weight:bold; color:#3D1F0A;">${esc(medicationName)} &mdash; ${esc(petName)}</p><p style="margin:4px 0 0; color:#C4845A; font-size:14px; line-height:18px;">Stock restante: ${esc(stockRemaining)} unidades</p>`, "#FFD166")}
      <p style="color:#7A4522; font-size:14px; line-height:20px;">Te recomendamos comprar pronto para no quedarte sin medicamento.</p>
      ${button("Abrir Firus&amp;Michis", "https://firusymichis.cl/dashboard", "#FFD166", "#3D1F0A")}
    `,
  };
}

// Resumen diario (8:00 AM Chile) — dosis del día, vacunas próximas y stock bajo.
function resumenBody({ petName, doses = [], vaccines = [], stockItems = [] }) {
  const dosesHtml = doses.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${doses.map(d => `<tr><td style="padding:6px 0; border-bottom:1px solid #FFF0EB; font-size:14px; line-height:20px; color:#3D1F0A;"><strong>${esc(d.time)}</strong> &middot; ${esc(d.label)}</td></tr>`).join("")}
      </table>`
    : `<p style="margin:0; font-size:14px; line-height:20px; color:#7A4522;">Sin dosis programadas para hoy.</p>`;

  const vaccinesHtml = vaccines.length
    ? vaccines.map(v => card(`<p style="margin:0; font-size:15px; line-height:20px; font-weight:bold; color:#3D1F0A;">${esc(v.name)}</p><p style="margin:4px 0 0; color:#C4845A; font-size:14px; line-height:18px;">Vence: ${esc(v.date)} (en ${v.daysUntil} d&iacute;a${v.daysUntil === 1 ? "" : "s"})</p>`, "#2EC4B6")).join("")
    : "";

  const stockHtml = stockItems.length
    ? stockItems.map(s => card(`<p style="margin:0; font-size:15px; line-height:20px; font-weight:bold; color:#3D1F0A;">${esc(s.name)}</p><p style="margin:4px 0 0; color:#C4845A; font-size:14px; line-height:18px;">Quedan ${s.daysLeft} d&iacute;a${s.daysLeft === 1 ? "" : "s"} de stock</p>`, "#FFD166")).join("")
    : "";

  return {
    subject: `☀️ Resumen de hoy para ${petName}`,
    subtitle: "Resumen diario",
    bodyHtml: `
      <p style="margin:0 0 4px; font-size:18px; line-height:24px; font-weight:bold; color:#3D1F0A;">Hola &#128075; Esto es lo de hoy para ${esc(petName)}</p>
      <p style="margin:0 0 16px; font-size:15px; line-height:20px; font-weight:bold; color:#FF6B35;">&#128138; Dosis de hoy</p>
      ${dosesHtml}
      ${vaccinesHtml ? `<p style="margin:20px 0 0; font-size:15px; line-height:20px; font-weight:bold; color:#FF6B35;">&#128137; Vacunas pr&oacute;ximas</p>${vaccinesHtml}` : ""}
      ${stockHtml ? `<p style="margin:20px 0 0; font-size:15px; line-height:20px; font-weight:bold; color:#FF6B35;">&#128230; Stock bajo</p>${stockHtml}` : ""}
      ${button("Abrir Firus&amp;Michis", "https://firusymichis.cl/dashboard")}
    `,
  };
}

function trialBody({ daysLeft }) {
  return {
    subject: daysLeft <= 1
      ? `⏳ Tu prueba PRO vence mañana`
      : `⏳ Tu prueba PRO vence en ${daysLeft} días`,
    subtitle: null,
    bodyHtml: `
      <p style="margin:0 0 8px; font-size:18px; line-height:24px; font-weight:bold; color:#3D1F0A;">&#9203; Tu prueba PRO est&aacute; por vencer</p>
      ${card(`<p style="margin:0; font-size:15px; line-height:22px; color:#3D1F0A;">${daysLeft <= 1 ? "Vence ma&ntilde;ana." : `Vence en ${daysLeft} d&iacute;as.`} Despu&eacute;s de esa fecha, el acceso a tus datos quedar&aacute; restringido hasta que actives un plan.</p>`, "#FF6B35")}
      <p style="color:#7A4522; font-size:14px; line-height:20px;">Tus datos no se eliminan: quedan guardados y disponibles apenas actives un plan.</p>
      ${button("Ver planes", "https://firusymichis.cl/pago")}
    `,
  };
}

const BUILDERS = {
  medication: medicationBody,
  vaccine: vaccineBody,
  low_stock: lowStockBody,
  resumen: resumenBody,
  trial: trialBody,
};

// Comparación de tiempo constante para el secreto de cron — evita que un
// atacante infiera el valor correcto midiendo cuánto tarda la respuesta
// carácter a carácter. crypto.timingSafeEqual exige buffers de igual
// longitud (lanza si difieren), así que el chequeo de largo va primero;
// eso sí filtra si el largo coincide o no, pero el largo de un secreto no
// es la parte sensible — el valor sí, y ese sigue comparándose a tiempo
// constante.
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a || "", "utf8");
  const bufB = Buffer.from(b || "", "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// El destino del email SIEMPRE se resuelve acá, nunca confiando en el "to"
// que manda el cliente — así el endpoint deja de servir como relay abierto.
// Usa el email guardado en notification_preferences para esa mascota (si
// existe y es del usuario autenticado); si no, cae al email de la cuenta.
async function resolveDestinationEmail(supabase, user, petId) {
  if (!petId) return user.email;
  const { data: pet } = await supabase.from("pets").select("id").eq("id", petId).eq("user_id", user.id).single();
  if (!pet) return null; // petId no es del usuario autenticado
  const { data: pref } = await supabase
    .from("notification_preferences")
    .select("email")
    .eq("pet_id", petId)
    .eq("user_id", user.id)
    .single();
  return pref?.email || user.email;
}

// Este endpoint tiene dos llamadores legítimos, cada uno con su propia
// validación (Lote K1 — antes no exigía ninguna, ver auditoría):
//
// 1. El cron interno (app/api/cron/notifications/route.js), servidor-a-
//    servidor, ya resolvió el destinatario correcto antes de llamar acá —
//    se autentica con el mismo x-cron-secret que protege esa ruta.
// 2. El botón "Enviar email de prueba" (NotificationSettings.jsx), desde
//    el navegador — exige sesión, y el "to" del body se IGNORA siempre: el
//    destino se resuelve en el servidor a partir de petId.
//
// Cualquier request que no encaje en ninguna de las dos vías recibe el
// mismo 401 genérico, sin indicar cuál validación falló.
export async function POST(req) {
  const payload = await req.json();
  const { type } = payload;

  const cronToken = req.headers.get("x-cron-secret");
  const isCron = !!process.env.CRON_SECRET && timingSafeEqual(cronToken, process.env.CRON_SECRET);

  let to;
  let recordQuotaOnSuccess = null;
  if (isCron) {
    to = payload.to;
    if (!to) return new Response("Unauthorized", { status: 401 });
  } else {
    const supabase = await createRouteSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    to = await resolveDestinationEmail(supabase, user, payload.petId);
    if (!to) return new Response("Unauthorized", { status: 401 });

    const quota = await checkEmailTestQuota(user.id);
    if (!quota.allowed) {
      return Response.json({ error: "Alcanzaste el límite de emails de prueba por hoy. Puedes intentar de nuevo mañana." }, { status: 429 });
    }

    // Se registra recién si el envío es exitoso — ver más abajo.
    recordQuotaOnSuccess = () => recordAiUsage(user.id, "email_test");
  }

  const build = BUILDERS[type] || BUILDERS.medication;
  const { subject, subtitle, bodyHtml } = build(payload);
  const html = buildEmail({ subtitle, bodyHtml });

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: "Firus&Michis <notificaciones@firusymichis.cl>",
      to: [to],
      subject,
      html,
    });

    if (error) return Response.json({ error }, { status: 500 });
    if (recordQuotaOnSuccess) await recordQuotaOnSuccess();
    return Response.json({ success: true, id: data.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
