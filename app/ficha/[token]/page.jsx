import { createClient } from "@supabase/supabase-js";

const formatDate = (d) => {
  if (!d) return "Sin fecha";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const calcAge = (birthDate) => {
  if (!birthDate) return "Sin datos";
  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return `${y} año${y !== 1 ? "s" : ""}${m > 0 ? ` ${m} mes${m !== 1 ? "es" : ""}` : ""}`;
};

export default async function FichaPublica({ params }) {
  const { token } = await params;
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("SERVICE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("token buscado:", token);

  const { data: share, error: shareError } = await supabaseAdmin
    .from("pet_shares")
    .select("*")
    .eq("token", token)
    .eq("active", true)
    .single();

  console.log("share result:", share);
  console.log("share error:", shareError);

  if (!share) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFF8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: "#FF6B35", marginBottom: 8 }}>Ficha no encontrada</div>
          <div style={{ fontSize: 14, color: "#C4845A" }}>Este enlace no existe o fue revocado.</div>
        </div>
      </div>
    );
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFF8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: "#FF6B35", marginBottom: 8 }}>Enlace expirado</div>
          <div style={{ fontSize: 14, color: "#C4845A" }}>El tutor debe generar un nuevo código QR.</div>
        </div>
      </div>
    );
  }

  const { data: pet } = await supabaseAdmin.from("pets").select("*").eq("id", share.pet_id).single();
  const { data: meds } = share.show_medications
    ? await supabaseAdmin.from("medications").select("*").eq("pet_id", share.pet_id).eq("active", true)
    : { data: [] };
  const { data: history } = share.show_history || share.show_vaccines
    ? await supabaseAdmin.from("medical_history").select("*").eq("pet_id", share.pet_id).order("event_date", { ascending: false }).limit(20)
    : { data: [] };

  const vaccines = history?.filter(h => h.type === "vaccine") || [];
  const medHistory = history?.filter(h => h.type !== "vaccine") || [];
  const speciesIcon = pet?.species === "cat" ? "🐱" : pet?.species === "other" ? "🐰" : "🐶";
  const sexLabel = pet?.sex === "male" ? "♂️ Macho" : pet?.sex === "female" ? "♀️ Hembra" : null;

  const daysLeft = share.expires_at
    ? Math.ceil((new Date(share.expires_at) - new Date()) / 86400000)
    : null;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700;800&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Nunito', sans-serif" }}>

        {/* HEADER */}
        <div style={{ background: "linear-gradient(160deg, #FF6B35 0%, #E63900 100%)", padding: "24px 20px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🐾</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Firus<span style={{ color: "#FFD166" }}>&</span>Michis
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: "3px solid rgba(255,255,255,0.4)" }}>
              {pet?.photo_url
                ? <img src={pet.photo_url} alt={pet.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : speciesIcon}
            </div>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{pet?.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{pet?.breed} · {calcAge(pet?.birth_date)}</div>
            </div>
          </div>
          {daysLeft !== null && (
            <div style={{ marginTop: 14, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 12px", display: "inline-block" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                ⏰ Ficha disponible por {daysLeft} día{daysLeft !== 1 ? "s" : ""} más
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>

          {/* DATOS BÁSICOS */}
          {share.show_basics && pet && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🐶 Datos básicos</div>
              {[
                ["Nombre", pet.name],
                ["Especie", pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"],
                ["Raza", pet.breed || "Sin datos"],
                sexLabel ? ["Sexo", sexLabel] : null,
                ["Edad", calcAge(pet.birth_date)],
                pet.weight_kg ? ["Peso", `${pet.weight_kg} kg`] : null,
              ].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F5E6DA", fontSize: 13 }}>
                  <span style={{ color: "#7A4522", fontSize: 12 }}>{l}</span>
                  <span style={{ fontWeight: 700, color: "#3D1F0A" }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* CONDICIONES */}
          {share.show_conditions && pet?.conditions?.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🏥 Condiciones de salud</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pet.conditions.map(c => (
                  <span key={c} style={{ background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* ALERGIAS */}
          {share.show_allergies && pet?.allergies?.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>⚠️ Alergias a medicamentos</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pet.allergies.map(a => (
                  <span key={a} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* MEDICAMENTOS ACTIVOS */}
          {share.show_medications && meds?.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💊 Medicamentos activos</div>
              {meds.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #F5E6DA" }}>
                  <div style={{ width: 4, height: "100%", minHeight: 36, background: m.color || "#FF6B35", borderRadius: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#3D1F0A" }}>{m.name}</div>
                    {m.dose && <div style={{ fontSize: 12, color: "#C4845A" }}>{m.dose}</div>}
                    {m.frequency && <div style={{ fontSize: 12, color: "#C4845A" }}>{m.frequency}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VACUNAS */}
          {share.show_vaccines && vaccines.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💉 Vacunas</div>
              {vaccines.map(v => {
                const days = v.next_date ? Math.ceil((new Date(v.next_date) - new Date()) / 86400000) : null;
                const cls = days === null ? "warn" : days < 0 ? "danger" : days < 60 ? "warn" : "ok";
                const colors = { ok: { bg: "#e8faf4", text: "#059669" }, warn: { bg: "#fff7ed", text: "#d97706" }, danger: { bg: "#fef2f2", text: "#dc2626" } };
                return (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F5E6DA" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{v.event}</div>
                      <div style={{ fontSize: 11, color: "#C4845A" }}>Aplicada: {formatDate(v.event_date)}{v.next_date ? ` · Próx: ${formatDate(v.next_date)}` : ""}</div>
                    </div>
                    {days !== null && (
                      <span style={{ background: colors[cls].bg, color: colors[cls].text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>
                        {days < 0 ? "VENCIDA" : `${days}d`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORIAL */}
          {share.show_history && medHistory.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📅 Historial médico</div>
              {medHistory.slice(0, 8).map(h => (
                <div key={h.id} style={{ padding: "8px 0", borderBottom: "1px solid #F5E6DA" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#3D1F0A" }}>{h.event}</div>
                    <div style={{ fontSize: 11, color: "#C4845A", flexShrink: 0, marginLeft: 8 }}>{formatDate(h.event_date)}</div>
                  </div>
                  {h.vet_clinic && <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>🏥 {h.vet_clinic}</div>}
                  {h.notes && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 2 }}>{h.notes}</div>}
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: "#C4845A" }}>
            Ficha generada por Firus&Michis · firusymichis.cl
          </div>
        </div>
      </div>
    </>
  );
}
