"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getPetIcon } from "@/lib/petSpecies";
import { generoPalabra } from "@/lib/genero";
import DrugClassLabel from "@/components/DrugClassLabel";

const TIPO_LABEL = { vaccine: "Vacuna", surgery: "Cirugía", illness: "Enfermedad", exam: "Examen", procedure: "Procedimiento" };
// dose_log.status solo puede ser "dada" u "omitida" (ver
// supabase/migrations/20260815_dose_log.sql) — mismos labels que usa
// DoseTracker.jsx ("Dada — clic para marcar omitida", etc.).
const DOSE_STATUS_LABEL = { dada: "Dada", omitida: "Omitida" };

function calcAgeLocal(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years <= 0) return `${months} mes${months === 1 ? "" : "es"}`;
  return `${years} año${years === 1 ? "" : "s"}${months > 0 ? ` ${months} mes${months === 1 ? "" : "es"}` : ""}`;
}

const css = {
  page: { minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Nunito', sans-serif", paddingBottom: 40 },
  banner: { background: "linear-gradient(135deg,#2EC4B6,#25a99e)", color: "#fff", padding: "14px 20px", textAlign: "center", fontSize: 13, fontWeight: 700 },
  header: { background: "linear-gradient(160deg,#FF6B35,#E63900)", padding: "24px 20px", display: "flex", alignItems: "center", gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 },
  name: { fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: "#fff" },
  breed: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  content: { maxWidth: 480, margin: "0 auto", padding: "20px 16px" },
  card: { background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" },
  cardTitle: { fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  row: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F5E6DA", fontSize: 13 },
  rowLabel: { color: "#C4845A", fontSize: 12 },
  rowValue: { fontWeight: 700, textAlign: "right", color: "#3D1F0A" },
  itemCard: { borderLeft: "4px solid #FF6B35", background: "#FFF8F3", borderRadius: 10, padding: "10px 12px", marginBottom: 8 },
  itemName: { fontWeight: 800, color: "#3D1F0A", fontSize: 14 },
  itemDetail: { fontSize: 12, color: "#7A4522", marginTop: 2 },
  empty: { fontSize: 12, color: "#C4845A", fontStyle: "italic" },
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", color: "#7A4522", textAlign: "center", padding: 20 },
};

export default function MascotaCompartidaPage() {
  const { petId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [marking, setMarking] = useState(null); // id del treatment_item en curso
  const [markStatus, setMarkStatus] = useState(null); // { id, ok, message }
  const [siblingPets, setSiblingPets] = useState([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    if (!petId) return;
    fetch(`/api/mascota-compartida/${petId}`)
      .then(async res => {
        if (res.status === 401) { setNeedsLogin(true); return; }
        const json = await res.json();
        if (!res.ok) setError(json.error || "No se pudo cargar la ficha.");
        else setData(json);
      })
      .catch(() => setError("No se pudo cargar la ficha."));
  }, [petId]);

  // Esta página no guarda el usuario en estado (solo needsLogin), y el
  // endpoint ya degrada a { pets: [] } si no hay sesión (res.ok === false),
  // así que alcanza con pedirlo apenas monta, sin depender de un `user`.
  useEffect(() => {
    fetch("/api/mascota-compartida")
      .then(res => res.ok ? res.json() : { pets: [] })
      .then(json => setSiblingPets(json.pets || []))
      .catch(() => {});
  }, []);

  if (needsLogin) return <div style={css.center}><div><p>Necesitas iniciar sesión para ver esta ficha.</p><a href="/login" style={{ color: "#FF6B35", fontWeight: 700 }}>Ir a iniciar sesión</a></div></div>;
  if (error) return <div style={css.center}>⚠️ {error}</div>;
  if (!data) return <div style={css.center}>Cargando...</div>;

  const { pet, medications, medicalHistory, treatmentItems, doseLog } = data;
  const icon = getPetIcon(pet.species, pet.breed);
  const edadTexto = pet.birth_date ? (pet.birth_date_approximate ? `≈ ${calcAgeLocal(pet.birth_date)}` : calcAgeLocal(pet.birth_date)) : "—";
  const adoptadaTexto = pet.is_adopted
    ? `${generoPalabra(pet.sex, pet.adoption_type === "rescatada" ? "Rescatada" : "Adoptada", pet.adoption_type === "rescatada" ? "Rescatado" : "Adoptado")}${pet.adopted_date ? ` (${pet.adopted_date})` : ""}`
    : "No";
  const ultimasDosis = [...doseLog].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 5);

  const reload = () => {
    fetch(`/api/mascota-compartida/${petId}`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(() => {});
  };

  const marcarDosis = async (treatmentItemId) => {
    setMarking(treatmentItemId);
    setMarkStatus(null);
    try {
      const res = await fetch(`/api/mascota-compartida/${petId}/dosis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatmentItemId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMarkStatus({ id: treatmentItemId, ok: false, message: json.error || "No se pudo registrar." });
      } else {
        setMarkStatus({ id: treatmentItemId, ok: true, message: "✓ Dosis registrada" });
        reload();
      }
    } catch {
      setMarkStatus({ id: treatmentItemId, ok: false, message: "No se pudo registrar." });
    }
    setMarking(null);
  };

  return (
    <div style={css.page}>
      <a href="/dashboard/overview" style={{ display: "block", padding: "10px 16px", background: "#fff", color: "#7A4522", fontSize: 13, fontWeight: 700, textDecoration: "none", borderBottom: "1px solid #F5E6DA" }}>
        ← Volver a mis mascotas
      </a>
      <div style={css.banner}>👀 Estás viendo esta ficha como tutor suplente — solo el tutor titular puede editar la información.</div>
      <div style={css.header}>
        <div style={css.avatar}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={css.name}>{pet.name}</div>
          <div style={css.breed}>{pet.breed} {edadTexto && `· ${edadTexto}`}</div>
          {siblingPets.length > 1 && (
            <button onClick={() => setShowSwitcher(true)}
              style={{ marginTop: 6, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              🐾 Cambiar ▾
            </button>
          )}
        </div>
      </div>

      {showSwitcher && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowSwitcher(false)}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#3D1F0A", marginBottom: 16 }}>🤝 Mascotas compartidas contigo</div>
            {siblingPets.map(p => (
              <a key={p.id} href={`/mascota-compartida/${p.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, marginBottom: 8, textDecoration: "none", background: p.id === pet.id ? "#FFF0EB" : "#fff", border: `1.5px solid ${p.id === pet.id ? "#FF6B35" : "#FFD9C8"}` }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E8FAF9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden", flexShrink: 0 }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : getPetIcon(p.species, p.breed)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#C4845A" }}>Compartida por {p.ownerName || "el titular"}</div>
                </div>
                {p.id === pet.id && <div style={{ fontSize: 12, color: "#FF6B35", fontWeight: 700 }}>✓</div>}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={css.content}>
        <div style={css.card}>
          <div style={css.cardTitle}>🐶 Datos básicos</div>
          {[["Especie", pet.species === "dog" ? "Perro" : pet.species === "cat" ? "Gato" : "Otro"], ["Raza", pet.breed], ["Sexo", pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : "Desconocido"], ["Adoptada", adoptadaTexto]].map(([l, v]) => (
            <div style={css.row} key={l}><span style={css.rowLabel}>{l}</span><span style={css.rowValue}>{v}</span></div>
          ))}
          {pet.conditions?.length > 0 && (
            <div style={css.row}><span style={css.rowLabel}>Condiciones</span><span style={css.rowValue}>{pet.conditions.join(", ")}</span></div>
          )}
        </div>

        <div style={css.card}>
          <div style={css.cardTitle}>💊 Tratamientos activos</div>
          {treatmentItems.length === 0 && <div style={css.empty}>Sin tratamientos activos.</div>}
          {treatmentItems.map(ti => (
            <div style={css.itemCard} key={ti.id}>
              <div style={css.itemName}>{ti.name} <DrugClassLabel drugClass={ti.drug_class} style={{ fontSize: 11 }} /></div>
              {ti.prescribed_dose && <div style={css.itemDetail}>💊 {ti.prescribed_dose}{ti.frequency ? ` · ${ti.frequency}` : ""}</div>}
              {ti.condicion && <div style={{ ...css.itemDetail, color: "#C2410C", fontWeight: 700 }}>🔶 Condicional: {ti.condicion}</div>}
              <button onClick={() => marcarDosis(ti.id)} disabled={marking === ti.id}
                style={{ marginTop: 8, width: "100%", padding: 8, borderRadius: 8, border: "none", background: "#2EC4B6", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: marking === ti.id ? "not-allowed" : "pointer" }}>
                {marking === ti.id ? "Registrando..." : "✓ Marcar dosis de ahora como dada"}
              </button>
              {markStatus?.id === ti.id && (
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: markStatus.ok ? "#059669" : "#dc2626" }}>
                  {markStatus.message}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={css.card}>
          <div style={css.cardTitle}>💉 Medicamentos</div>
          {medications.length === 0 && <div style={css.empty}>Sin medicamentos registrados.</div>}
          {medications.map(m => (
            <div key={m.id} style={{ ...css.itemCard, borderLeftColor: m.color || "#FF6B35" }}>
              <div style={css.itemName}>{m.name}</div>
              {m.dose && <div style={css.itemDetail}>{m.dose}{m.frequency ? ` · ${m.frequency}` : ""}</div>}
              {m.stock != null && <div style={css.itemDetail}>📦 Stock: {m.stock} {m.unit}</div>}
            </div>
          ))}
        </div>

        <div style={css.card}>
          <div style={css.cardTitle}>📅 Últimas dosis registradas</div>
          {ultimasDosis.length === 0 && <div style={css.empty}>Sin dosis registradas todavía.</div>}
          {ultimasDosis.map(d => (
            <div style={css.row} key={d.id}>
              <span style={css.rowLabel}>{d.treatment_items?.name || "Medicamento"} · {new Date(d.scheduled_at).toLocaleString("es-CL")}</span>
              <span style={css.rowValue}>{DOSE_STATUS_LABEL[d.status] || d.status || "—"}</span>
            </div>
          ))}
        </div>

        <div style={css.card}>
          <div style={css.cardTitle}>📋 Historial médico</div>
          {medicalHistory.length === 0 && <div style={css.empty}>Sin eventos registrados.</div>}
          {medicalHistory.map(h => (
            <div style={css.itemCard} key={h.id}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#7A4522", textTransform: "uppercase" }}>{TIPO_LABEL[h.type] || h.type} · {h.event_date}</div>
              <div style={css.itemName}>{h.event}</div>
              {(h.vet_name || h.vet_clinic) && <div style={css.itemDetail}>👩‍⚕️ {[h.vet_name, h.vet_clinic].filter(Boolean).join(" · ")}</div>}
              {h.notes && <div style={css.itemDetail}>{h.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
