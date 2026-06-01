"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

const RELATIONSHIPS = ["Dueño", "Familiar", "Veterinario", "Vecino", "Otro"];
const EMAIL_DOMAINS = ["@gmail.com", "@hotmail.com", "@outlook.com", "@yahoo.com", "@icloud.com", "@live.com", "@yahoo.es"];

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
};

const parsePhone = (phone) => {
  if (!phone) return "";
  return phone.replace(/^\+?569?/, "").slice(0, 8);
};

const formatPhone = (digits) => digits ? `+569${digits.replace(/\D/g, "").slice(0, 8)}` : "";

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid #FFD9C8", background: "#fff",
  fontFamily: "'Nunito', sans-serif", fontSize: 14,
  color: "#3D1F0A", outline: "none", boxSizing: "border-box",
};

const fieldLabel = (text) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{text}</div>
);

export default function TutorTab({ pet }) {
  const supabase = createClient();
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const emptyForm = {
    full_name: "", phone: "", email: "",
    street: "", street_number: "", comuna: "", ciudad: "", region: "",
    relationship: "", notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailDrop, setEmailDrop] = useState([]);
  const [addressManual, setAddressManual] = useState(false);
  const [copyFromPrimary, setCopyFromPrimary] = useState(false);

  useEffect(() => { loadTutors(); }, []);

  // Load Google Maps Places
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.maps?.places) { setGoogleLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener("load", () => setGoogleLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setGoogleLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init Places Autocomplete when modal opens
  useEffect(() => {
    if (!editingType || !googleLoaded) return;
    const timer = setTimeout(() => {
      if (!addressInputRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: "cl" },
        fields: ["address_components"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const comps = place.address_components || [];
        const get = (type) => comps.find(c => c.types.includes(type))?.long_name || "";
        setForm(f => ({
          ...f,
          street: get("route"),
          street_number: get("street_number"),
          comuna: get("locality") || get("sublocality_level_1"),
          ciudad: get("administrative_area_level_2") || get("locality"),
          region: get("administrative_area_level_1"),
        }));
        setAddressManual(true);
      });
      autocompleteRef.current = ac;
    }, 100);
    return () => clearTimeout(timer);
  }, [editingType, googleLoaded]);

  // Copy address from primary
  useEffect(() => {
    if (!copyFromPrimary || !primary) return;
    setForm(f => ({
      ...f,
      street: primary.street || "",
      street_number: primary.street_number || "",
      comuna: primary.comuna || "",
      ciudad: primary.ciudad || "",
      region: primary.region || "",
    }));
  }, [copyFromPrimary]);

  const loadTutors = async () => {
    setLoading(true);
    const { data } = await supabase.from("tutors").select("*").eq("pet_id", pet.id);
    setPrimary(data?.find(t => t.type === "primary") || null);
    setSecondary(data?.find(t => t.type === "secondary") || null);
    setLoading(false);
  };

  const openEdit = (type) => {
    const tutor = type === "primary" ? primary : secondary;
    setForm({
      full_name: tutor?.full_name || "",
      phone: parsePhone(tutor?.phone || ""),
      email: tutor?.email || "",
      street: tutor?.street || "",
      street_number: tutor?.street_number || "",
      comuna: tutor?.comuna || "",
      ciudad: tutor?.ciudad || "",
      region: tutor?.region || "",
      relationship: tutor?.relationship || "",
      notes: tutor?.notes || "",
    });
    setCopyFromPrimary(false);
    setAddressManual(!!(tutor?.street));
    setEmailDrop([]);
    setEditingType(type);
    setSaved(false);
  };

  const closeEdit = () => {
    setEditingType(null);
    setSaved(false);
    setEmailDrop([]);
    setCopyFromPrimary(false);
    setAddressManual(false);
  };

  const handleEmailChange = (val) => {
    setForm(f => ({ ...f, email: val }));
    const atIdx = val.indexOf("@");
    if (atIdx >= 0) {
      const afterAt = val.slice(atIdx + 1).toLowerCase();
      const filtered = EMAIL_DOMAINS.filter(d => d.slice(1).startsWith(afterAt));
      setEmailDrop(filtered.length && afterAt !== filtered[0].slice(1) ? filtered : []);
    } else {
      setEmailDrop([]);
    }
  };

  const selectEmailDomain = (domain) => {
    setForm(f => ({ ...f, email: f.email.split("@")[0] + domain }));
    setEmailDrop([]);
  };

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);
    const existing = editingType === "primary" ? primary : secondary;
    const payload = { ...form, phone: formatPhone(form.phone), pet_id: pet.id, type: editingType };
    if (existing?.id) {
      await supabase.from("tutors").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("tutors").insert(payload);
    }
    setSaving(false);
    setSaved(true);
    await loadTutors();
    setTimeout(() => closeEdit(), 800);
  };

  const handleDelete = async () => {
    const existing = editingType === "primary" ? primary : secondary;
    if (!existing?.id) return;
    if (!confirm(`¿Eliminar al tutor ${existing.full_name}? Esta acción no se puede deshacer.`)) return;
    await supabase.from("tutors").delete().eq("id", existing.id);
    await loadTutors();
    closeEdit();
  };

  const hasAddress = (t) => t && (t.street || t.comuna || t.ciudad);

  const DataRow = ({ icon, value }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D1F0A", padding: "4px 0" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span>{value}</span>
    </div>
  );

  const renderCard = (type) => {
    const tutor = type === "primary" ? primary : secondary;
    const isPrimary = type === "primary";
    const color = isPrimary ? "#FF6B35" : "#2EC4B6";
    const bgBadge = isPrimary ? "#FFF0EB" : "#E8FAF9";
    const label = isPrimary ? "Titular" : "Suplente";
    const icon = isPrimary ? "👤" : "👥";
    const addressLine = tutor
      ? [tutor.street, tutor.street_number, tutor.comuna, tutor.ciudad].filter(Boolean).join(", ")
      : "";

    return (
      <div key={type} style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1 }}>
            {icon} Tutor {label}
          </div>
          {tutor && (
            <button onClick={() => openEdit(type)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#FF6B35", fontWeight: 700, cursor: "pointer" }}>
              ✏️ Editar
            </button>
          )}
        </div>

        {tutor ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {getInitials(tutor.full_name)}
              </div>
              <div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#3D1F0A", lineHeight: 1.2 }}>{tutor.full_name}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ background: bgBadge, color, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{label}</span>
                  {tutor.relationship && <span style={{ fontSize: 11, color: "#C4845A", marginLeft: 6 }}>{tutor.relationship}</span>}
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #FFF0EB", paddingTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {tutor.phone && <DataRow icon="📞" value={tutor.phone} />}
              {tutor.email && <DataRow icon="✉️" value={tutor.email} />}
              {addressLine && <DataRow icon="📍" value={addressLine} />}
              {tutor.region && <DataRow icon="🗺️" value={tutor.region} />}
              {tutor.notes && <DataRow icon="📝" value={tutor.notes} />}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 13, color: "#C4845A", marginBottom: 14 }}>Sin tutor {label.toLowerCase()} registrado</div>
            <button onClick={() => openEdit(type)} style={{ padding: "10px 24px", borderRadius: 12, background: color, color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              + Agregar tutor {label.toLowerCase()}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#C4845A", fontSize: 14 }}>Cargando tutores...</div>;
  }

  const editingTutor = editingType === "primary" ? primary : secondary;
  const editingLabel = editingType === "primary" ? "Titular" : "Suplente";
  const showCopyAddress = editingType === "secondary" && hasAddress(primary);

  return (
    <div className="fade-up">
      {renderCard("primary")}
      {renderCard("secondary")}

      {/* MODAL */}
      {editingType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

            {/* HEADER */}
            <div style={{ background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {editingTutor ? `✏️ Editar tutor ${editingLabel}` : `➕ Agregar tutor ${editingLabel}`}
              </div>
              <button onClick={closeEdit} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
                ✕ Cerrar
              </button>
            </div>

            <div style={{ padding: 20 }}>

              {/* NOMBRE */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel("Nombre completo *")}
                <input style={inputStyle} type="text" placeholder="Ej: María González"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>

              {/* TELÉFONO */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel("Teléfono")}
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #FFD9C8", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
                  <span style={{ padding: "9px 10px 9px 12px", background: "#FFF0EB", color: "#FF6B35", fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, borderRight: "1.5px solid #FFD9C8", flexShrink: 0 }}>
                    +56 9
                  </span>
                  <input
                    style={{ flex: 1, padding: "9px 12px", border: "none", outline: "none", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", background: "transparent" }}
                    type="tel"
                    placeholder="12345678"
                    maxLength={8}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div style={{ marginBottom: 12, position: "relative" }}>
                {fieldLabel("Email")}
                <input style={inputStyle} type="email" placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onBlur={() => setTimeout(() => setEmailDrop([]), 150)}
                />
                {emailDrop.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #FFD9C8", borderRadius: 10, zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)", overflow: "hidden" }}>
                    {emailDrop.map(d => (
                      <div key={d}
                        onMouseDown={() => selectEmailDomain(d)}
                        style={{ padding: "9px 14px", fontSize: 13, color: "#3D1F0A", cursor: "pointer", borderBottom: "1px solid #FFF0EB" }}>
                        {form.email.split("@")[0]}<strong>{d}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DIRECCIÓN — Google Places */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel("Buscar dirección")}
                <input
                  ref={addressInputRef}
                  style={inputStyle}
                  type="text"
                  placeholder={googleLoaded ? "Escribe una dirección..." : "Cargando Maps..."}
                  disabled={!googleLoaded}
                />
                {!googleLoaded && (
                  <div style={{ fontSize: 10, color: "#C4845A", marginTop: 3 }}>Google Maps cargando...</div>
                )}
              </div>

              {/* COPY FROM PRIMARY */}
              {showCopyAddress && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: "#7A4522", fontWeight: 600 }}>
                  <input type="checkbox" checked={copyFromPrimary}
                    onChange={e => setCopyFromPrimary(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#FF6B35" }} />
                  Usar misma dirección que el tutor titular
                </label>
              )}

              {/* CAMPOS DE DIRECCIÓN */}
              {(addressManual || form.street || form.comuna) && (
                <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35", marginBottom: 8 }}>📍 Dirección descompuesta</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                    <div>
                      {fieldLabel("Calle")}
                      <input style={inputStyle} placeholder="Nombre de la calle" value={form.street}
                        onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />
                    </div>
                    <div style={{ width: 90 }}>
                      {fieldLabel("Número")}
                      <input style={inputStyle} placeholder="N°" value={form.street_number}
                        onChange={e => setForm(f => ({ ...f, street_number: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      {fieldLabel("Comuna")}
                      <input style={inputStyle} placeholder="Comuna" value={form.comuna}
                        onChange={e => setForm(f => ({ ...f, comuna: e.target.value }))} />
                    </div>
                    <div>
                      {fieldLabel("Ciudad")}
                      <input style={inputStyle} placeholder="Ciudad" value={form.ciudad}
                        onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    {fieldLabel("Región")}
                    <input style={inputStyle} placeholder="Región" value={form.region}
                      onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
                  </div>
                </div>
              )}

              {!addressManual && !form.street && !form.comuna && (
                <button onClick={() => setAddressManual(true)}
                  style={{ fontSize: 11, color: "#C4845A", background: "transparent", border: "none", cursor: "pointer", marginBottom: 12, textDecoration: "underline" }}>
                  Ingresar dirección manualmente
                </button>
              )}

              {/* RELACIÓN */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel("Relación con la mascota")}
                <select style={{ ...inputStyle, background: "#fff" }}
                  value={form.relationship}
                  onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* NOTAS */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel("Notas")}
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
                  placeholder="Información adicional..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button onClick={handleSave} disabled={saving || !form.full_name}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: saved ? "#2EC4B6" : "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s", marginBottom: 8 }}>
                {saved ? "✓ Guardado" : saving ? "Guardando..." : `✓ Guardar tutor ${editingLabel}`}
              </button>

              {editingTutor && (
                <button onClick={handleDelete}
                  style={{ width: "100%", padding: 11, borderRadius: 13, background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  🗑️ Eliminar tutor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
