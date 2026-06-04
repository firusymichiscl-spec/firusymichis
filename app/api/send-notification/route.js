import { Resend } from "resend";

export async function POST(req) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { to, subject, type, petName, medicationName, scheduledTime, stockRemaining } = await req.json();

  const templates = {
    medication: {
      subject: `⏰ Hora de darle ${medicationName} a ${petName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #FFF8F3; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #FF6B35, #e85d2e); padding: 24px; text-align: center;">
            <h1 style="color: #fff; font-size: 24px; margin: 0;">🐾 Firus&amp;Michis</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Recordatorio de medicamento</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #3D1F0A; font-size: 20px;">💊 Es hora de medicar a ${petName}</h2>
            <div style="background: #fff; border-radius: 12px; padding: 16px; border-left: 4px solid #FF6B35; margin: 16px 0;">
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: #3D1F0A;">${medicationName}</p>
              <p style="margin: 4px 0 0; color: #C4845A; font-size: 14px;">Hora programada: ${scheduledTime}</p>
            </div>
            <p style="color: #7A4522; font-size: 13px;">Recuerda registrar la dosis en la app una vez administrada.</p>
            <a href="https://firusymichis.cl/dashboard" style="display: block; background: #FF6B35; color: #fff; text-align: center; padding: 12px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 16px;">Abrir Firus&amp;Michis</a>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 11px; color: #C4845A;">
            Firus&amp;Michis · firusymichis.cl · Para desactivar estas alertas, ve a Configuración en la app.
          </div>
        </div>
      `,
    },
    vaccine: {
      subject: `💉 Vacuna próxima a vencer — ${petName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #FFF8F3; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #FF6B35, #e85d2e); padding: 24px; text-align: center;">
            <h1 style="color: #fff; font-size: 24px; margin: 0;">🐾 Firus&amp;Michis</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #3D1F0A;">💉 Vacuna próxima para ${petName}</h2>
            <div style="background: #fff; border-radius: 12px; padding: 16px; border-left: 4px solid #2EC4B6; margin: 16px 0;">
              <p style="margin: 0; font-weight: bold; color: #3D1F0A;">${medicationName}</p>
              <p style="margin: 4px 0 0; color: #C4845A; font-size: 14px;">Fecha: ${scheduledTime}</p>
            </div>
            <a href="https://firusymichis.cl/dashboard" style="display: block; background: #2EC4B6; color: #fff; text-align: center; padding: 12px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 16px;">Ver vacunas en la app</a>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 11px; color: #C4845A;">
            Firus&amp;Michis · firusymichis.cl
          </div>
        </div>
      `,
    },
    low_stock: {
      subject: `📦 Stock bajo — ${medicationName} para ${petName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #FFF8F3; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #FF6B35, #e85d2e); padding: 24px; text-align: center;">
            <h1 style="color: #fff; font-size: 24px; margin: 0;">🐾 Firus&amp;Michis</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #3D1F0A;">📦 Stock bajo de medicamento</h2>
            <div style="background: #fff; border-radius: 12px; padding: 16px; border-left: 4px solid #FFD166; margin: 16px 0;">
              <p style="margin: 0; font-weight: bold; color: #3D1F0A;">${medicationName} — ${petName}</p>
              <p style="margin: 4px 0 0; color: #C4845A; font-size: 14px;">Stock restante: ${stockRemaining} unidades</p>
            </div>
            <p style="color: #7A4522; font-size: 13px;">Te recomendamos comprar pronto para no quedarte sin medicamento.</p>
            <a href="https://firusymichis.cl/marketplace" style="display: block; background: #FFD166; color: #3D1F0A; text-align: center; padding: 12px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 16px;">Ver Marketplace</a>
          </div>
          <div style="padding: 16px; text-align: center; font-size: 11px; color: #C4845A;">
            Firus&amp;Michis · firusymichis.cl
          </div>
        </div>
      `,
    },
  };

  const template = templates[type] || templates.medication;

  try {
    const { data, error } = await resend.emails.send({
      from: "Firus&Michis <notificaciones@firusymichis.cl>",
      to: [to],
      subject: template.subject,
      html: template.html,
    });

    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ success: true, id: data.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
