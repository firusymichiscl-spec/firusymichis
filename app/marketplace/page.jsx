"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function MarketplacePage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("explorar");
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewListing, setShowNewListing] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [userMeds, setUserMeds] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const [priceChecking, setPriceChecking] = useState(false);
  const [priceAnalysis, setPriceAnalysis] = useState(null);
  const filePhotoRef = useRef();
  const fileReceiptRef = useRef();

  const [listingForm, setListingForm] = useState({
    name: "", quantity: "", unit: "comp.", price_clp: "", description: "",
    expires_at: "", medication_id: "", pet_id: "",
    photo: null, photoPreview: null, receipt: null, receiptPreview: null,
  });

  const [requestForm, setRequestForm] = useState({
    medication_name: "", quantity_needed: "", unit: "comp.", max_price_clp: "", pet_id: "",
  });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUser(user);

    const { data: pets } = await supabase.from("pets").select("*").eq("user_id", user.id);
    setUserPets(pets || []);

    if (pets?.length > 0) {
      const petIds = pets.map(p => p.id);
      const { data: meds } = await supabase.from("medications").select("*").in("pet_id", petIds).eq("active", true);
      setUserMeds(meds || []);
    }

    await loadAll(user.id);
    setLoading(false);
  };

  const loadAll = async (uid) => {
    const [listRes, myListRes, myReqRes, myMatchRes] = await Promise.all([
      supabase.from("marketplace_listings").select("*").eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("marketplace_listings").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("marketplace_requests").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("marketplace_matches").select("*, marketplace_listings(name, quantity, unit), marketplace_requests(medication_name)").or(`buyer_user_id.eq.${uid},seller_user_id.eq.${uid}`).order("created_at", { ascending: false }),
    ]);
    setListings(listRes.data?.filter(l => l.user_id !== uid) || []);
    setMyListings(myListRes.data || []);
    setMyRequests(myReqRes.data || []);
    setMyMatches(myMatchRes.data || []);
  };

  const checkPrice = async () => {
    if (!listingForm.name || !listingForm.quantity || !listingForm.price_clp) return;
    if (parseInt(listingForm.price_clp) < 3000) {
      alert("El monto mínimo de venta es $3.000 CLP");
      return;
    }
    setPriceChecking(true);
    setPriceAnalysis(null);
    try {
      const res = await fetch("/api/ai-price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listingForm.name, quantity: listingForm.quantity, unit: listingForm.unit, price_clp: parseInt(listingForm.price_clp) }),
      });
      const data = await res.json();
      setPriceAnalysis(data);
    } catch { setPriceAnalysis({ error: "No se pudo verificar el precio" }); }
    setPriceChecking(false);
  };

  const uploadFile = async (file, folder) => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("marketplace").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("marketplace").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveListing = async () => {
    if (!listingForm.name || !listingForm.quantity || !listingForm.price_clp) {
      alert("Completa nombre, cantidad y precio");
      return;
    }
    if (parseInt(listingForm.price_clp) < 3000) {
      alert("El monto mínimo es $3.000 CLP");
      return;
    }
    if (!listingForm.photo) {
      alert("La foto del medicamento es obligatoria");
      return;
    }

    setLoading(true);
    const photoUrl = await uploadFile(listingForm.photo, "photos");
    const receiptUrl = listingForm.receipt ? await uploadFile(listingForm.receipt, "receipts") : null;

    const { data: newListing } = await supabase.from("marketplace_listings").insert({
      user_id: user.id,
      pet_id: listingForm.pet_id || null,
      medication_id: listingForm.medication_id || null,
      name: listingForm.name,
      description: listingForm.description || null,
      quantity: parseFloat(listingForm.quantity),
      unit: listingForm.unit,
      price_clp: parseInt(listingForm.price_clp),
      ai_suggested_price: priceAnalysis?.precio_sugerido_venta || null,
      ai_price_analysis: priceAnalysis?.analisis || null,
      photo_url: photoUrl,
      receipt_url: receiptUrl,
      expires_at: listingForm.expires_at || null,
      status: "active",
    }).select().single();

    if (newListing) {
      await fetch("/api/marketplace-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: newListing.id }),
      });
    }

    setShowNewListing(false);
    setListingForm({ name: "", quantity: "", unit: "comp.", price_clp: "", description: "", expires_at: "", medication_id: "", pet_id: "", photo: null, photoPreview: null, receipt: null, receiptPreview: null });
    setPriceAnalysis(null);
    await loadAll(user.id);
    setLoading(false);
    setTab("mis-publicaciones");
  };

  const saveRequest = async () => {
    if (!requestForm.medication_name) { alert("Ingresa el nombre del medicamento"); return; }
    await supabase.from("marketplace_requests").insert({
      user_id: user.id,
      pet_id: requestForm.pet_id || null,
      medication_name: requestForm.medication_name,
      quantity_needed: requestForm.quantity_needed ? parseFloat(requestForm.quantity_needed) : null,
      unit: requestForm.unit,
      max_price_clp: requestForm.max_price_clp ? parseInt(requestForm.max_price_clp) : null,
      status: "searching",
    });
    setShowNewRequest(false);
    setRequestForm({ medication_name: "", quantity_needed: "", unit: "comp.", max_price_clp: "", pet_id: "" });
    await loadAll(user.id);
    setTab("mis-solicitudes");
  };

  const simulatePayment = async (matchId) => {
    if (!confirm("¿Simular pago? (en producción aquí se procesaría el pago real)")) return;
    await supabase.from("marketplace_matches").update({
      payment_simulated: true,
      status: "paid",
      dispatch_status: "preparing",
      dispatch_date: new Date().toISOString().split("T")[0],
      estimated_delivery: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    }).eq("id", matchId);
    await loadAll(user.id);
  };

  const formatPrice = (p) => `$${p?.toLocaleString("es-CL")} CLP`;

  const inputS = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #FFD9C8", background: "#fff", fontFamily: "'Nunito', sans-serif", fontSize: 14, color: "#3D1F0A", outline: "none", boxSizing: "border-box" };
  const card = { background: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" };
  const sLabel = (t) => <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{t}</div>;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FFF8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💊</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 700, color: "#FF6B35" }}>Cargando marketplace...</div>
      </div>
    </div>
  );

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700;800&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Nunito', sans-serif" }}>

        {/* HEADER */}
        <div style={{ background: "linear-gradient(160deg, #2EC4B6 0%, #1a9e92 100%)", padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => router.push("/dashboard")} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "6px 12px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Volver</button>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: "#fff" }}>💊 Marketplace</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowNewRequest(true)} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "6px 12px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔍 Necesito</button>
              <button onClick={() => setShowNewListing(true)} style={{ background: "#fff", border: "none", borderRadius: 10, padding: "6px 12px", color: "#2EC4B6", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Vender</button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: "flex" }}>
            {[
              { id: "explorar", label: "🏪 Explorar" },
              { id: "mis-publicaciones", label: "📦 Mis ventas" },
              { id: "mis-solicitudes", label: "🔍 Solicitudes" },
              { id: "matches", label: "🤝 Matches" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: "8px 4px", border: "none", color: tab === t.id ? "#2EC4B6" : "rgba(255,255,255,0.7)", fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: "10px 10px 0 0", background: tab === t.id ? "#FFF8F3" : "transparent" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 12, padding: "10px 16px", margin: "12px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🚧</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35" }}>Módulo en desarrollo</div>
            <div style={{ fontSize: 11, color: "#7A4522" }}>El marketplace estará disponible próximamente. Esta es una versión de prueba interna.</div>
          </div>
        </div>

        <div style={{ padding: "16px 16px", maxWidth: 520, margin: "0 auto" }}>

          {/* EXPLORAR */}
          {tab === "explorar" && (
            <div>
              <div style={{ fontSize: 12, color: "#C4845A", marginBottom: 12, fontStyle: "italic" }}>
                Medicamentos disponibles de otros tutores · Despacho en 3 días hábiles · Monto mínimo $3.000
              </div>
              {listings.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>💊</div>
                  <div style={{ fontSize: 14, color: "#C4845A" }}>No hay medicamentos disponibles aún</div>
                  <div style={{ fontSize: 12, color: "#C4845A", marginTop: 4 }}>¡Sé el primero en publicar!</div>
                </div>
              ) : listings.map(l => (
                <div key={l.id} style={card}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {l.photo_url && <img src={l.photo_url} alt={l.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "#C4845A" }}>{l.quantity} {l.unit}</div>
                      {l.description && <div style={{ fontSize: 11, color: "#7A4522", marginTop: 2 }}>{l.description}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: "#2EC4B6" }}>{formatPrice(l.price_clp)}</div>
                        <button onClick={async () => {
                          if (!confirm(`¿Confirmar compra de ${l.name} por ${formatPrice(l.price_clp)}?`)) return;
                          const { data: match } = await supabase.from("marketplace_matches").insert({
                            listing_id: l.id,
                            buyer_user_id: user.id,
                            seller_user_id: l.user_id,
                            final_price_clp: l.price_clp,
                            platform_fee_clp: Math.round(l.price_clp * 0.25),
                            seller_payout_clp: Math.round(l.price_clp * 0.75),
                            status: "pending",
                          }).select().single();
                          if (match) { await loadAll(user.id); setTab("matches"); }
                        }} style={{ padding: "7px 16px", borderRadius: 10, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          Comprar
                        </button>
                      </div>
                      {l.ai_suggested_price && l.ai_suggested_price !== l.price_clp && (
                        <div style={{ fontSize: 10, color: "#059669", marginTop: 4 }}>✓ Precio verificado por IA</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MIS PUBLICACIONES */}
          {tab === "mis-publicaciones" && (
            <div>
              <button onClick={() => setShowNewListing(true)} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
                + Nueva publicación
              </button>
              {myListings.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: 24 }}>
                  <div style={{ fontSize: 13, color: "#C4845A" }}>No tienes publicaciones activas</div>
                </div>
              ) : myListings.map(l => (
                <div key={l.id} style={{ ...card, borderLeft: `4px solid ${l.status === "active" ? "#2EC4B6" : "#C4845A"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A" }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "#C4845A" }}>{l.quantity} {l.unit} · {formatPrice(l.price_clp)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: l.status === "active" ? "#E8FAF9" : "#FFF0EB", color: l.status === "active" ? "#0F6E56" : "#FF6B35" }}>
                        {l.status === "active" ? "Activo" : l.status}
                      </span>
                      <button onClick={async () => {
                        if (!confirm("¿Retirar esta publicación?")) return;
                        await supabase.from("marketplace_listings").update({ status: "withdrawn" }).eq("id", l.id);
                        await loadAll(user.id);
                      }} style={{ padding: "2px 8px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Retirar
                      </button>
                    </div>
                  </div>
                  {l.ai_price_analysis && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#7A4522", background: "#FFF0EB", borderRadius: 8, padding: "6px 10px" }}>
                      🤖 {l.ai_price_analysis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* MIS SOLICITUDES */}
          {tab === "mis-solicitudes" && (
            <div>
              <button onClick={() => setShowNewRequest(true)} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
                + Nueva solicitud
              </button>
              {myRequests.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: 24 }}>
                  <div style={{ fontSize: 13, color: "#C4845A" }}>No tienes solicitudes activas</div>
                </div>
              ) : myRequests.map(r => (
                <div key={r.id} style={{ ...card, borderLeft: "4px solid #FF6B35" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A" }}>{r.medication_name}</div>
                      <div style={{ fontSize: 12, color: "#C4845A" }}>
                        {r.quantity_needed ? `${r.quantity_needed} ${r.unit}` : "Cantidad flexible"}
                        {r.max_price_clp ? ` · Máx ${formatPrice(r.max_price_clp)}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#FFF0EB", color: "#FF6B35" }}>
                        {r.status === "searching" ? "Buscando..." : r.status}
                      </span>
                      <button onClick={async () => {
                        await supabase.from("marketplace_requests").update({ status: "cancelled" }).eq("id", r.id);
                        await loadAll(user.id);
                      }} style={{ padding: "2px 8px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MATCHES */}
          {tab === "matches" && (
            <div>
              {myMatches.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: 32 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🤝</div>
                  <div style={{ fontSize: 13, color: "#C4845A" }}>Sin matches aún</div>
                  <div style={{ fontSize: 11, color: "#C4845A", marginTop: 4 }}>Los matches aparecen cuando alguien compra tu medicamento o se encuentra lo que buscas</div>
                </div>
              ) : myMatches.map(m => {
                const isBuyer = m.buyer_user_id === user.id;
                const medName = m.marketplace_listings?.name || m.marketplace_requests?.medication_name || "Medicamento";
                return (
                  <div key={m.id} style={{ ...card, borderLeft: `4px solid ${isBuyer ? "#8B5CF6" : "#2EC4B6"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A" }}>{medName}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: isBuyer ? "#f5f3ff" : "#E8FAF9", color: isBuyer ? "#7c3aed" : "#0F6E56" }}>
                        {isBuyer ? "Comprando" : "Vendiendo"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#C4845A", marginBottom: 8 }}>
                      Total: <strong style={{ color: "#3D1F0A" }}>{formatPrice(m.final_price_clp)}</strong>
                      {!isBuyer && ` · Recibes: ${formatPrice(m.seller_payout_clp)}`}
                    </div>
                    <div style={{ fontSize: 11, color: "#7A4522", marginBottom: 10 }}>
                      Estado despacho: <strong>{m.dispatch_status === "pending" || !m.dispatch_status ? "⏳ Pendiente" : m.dispatch_status === "preparing" ? "📦 Preparando" : m.dispatch_status === "shipped" ? "🚚 En camino" : "✓ Entregado"}</strong>
                      {m.estimated_delivery && <span> · Entrega estimada: {new Date(m.estimated_delivery).toLocaleDateString("es-CL")}</span>}
                    </div>
                    {!m.payment_simulated && isBuyer && (
                      <button onClick={() => simulatePayment(m.id)}
                        style={{ width: "100%", padding: 10, borderRadius: 10, background: "#8B5CF6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        💳 Simular pago (demo)
                      </button>
                    )}
                    {m.payment_simulated && (
                      <div style={{ background: "#E8FAF9", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#0F6E56", fontWeight: 700 }}>
                        ✓ Pago simulado · Despacho en proceso
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL NUEVA PUBLICACIÓN */}
      {showNewListing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg, #2EC4B6, #1a9e92)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>💊 Publicar medicamento</div>
              <button onClick={() => { setShowNewListing(false); setPriceAnalysis(null); }} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>

              {userMeds.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {sLabel("Desde tu stock de medicamentos")}
                  <select style={{ ...inputS, background: "#fff" }} value={listingForm.medication_id}
                    onChange={e => {
                      const med = userMeds.find(m => m.id === e.target.value);
                      if (med) setListingForm(f => ({ ...f, medication_id: med.id, name: med.name, unit: med.unit || "comp.", quantity: med.stock?.toString() || "", pet_id: med.pet_id }));
                      else setListingForm(f => ({ ...f, medication_id: "" }));
                    }}>
                    <option value="">Seleccionar medicamento registrado...</option>
                    {userMeds.map(m => <option key={m.id} value={m.id}>{m.name} — Stock: {m.stock} {m.unit}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                {sLabel("Nombre del medicamento *")}
                <input style={inputS} placeholder="ej: Apoquel 16mg" value={listingForm.name} onChange={e => setListingForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  {sLabel("Cantidad *")}
                  <input style={inputS} type="number" min="1" placeholder="ej: 10" value={listingForm.quantity} onChange={e => setListingForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  {sLabel("Unidad")}
                  <select style={{ ...inputS, background: "#fff" }} value={listingForm.unit} onChange={e => setListingForm(f => ({ ...f, unit: e.target.value }))}>
                    {["comp.", "cáps.", "ml.", "sobre", "ampolla"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                {sLabel("Precio de venta (CLP) * — Mínimo $3.000")}
                <input style={inputS} type="number" min="3000" placeholder="ej: 5000" value={listingForm.price_clp} onChange={e => setListingForm(f => ({ ...f, price_clp: e.target.value }))} />
              </div>

              <button onClick={checkPrice} disabled={priceChecking}
                style={{ width: "100%", padding: 10, borderRadius: 10, background: "#FFF0EB", color: "#FF6B35", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                {priceChecking ? "Verificando con IA..." : "🤖 Verificar precio con IA"}
              </button>

              {priceAnalysis && !priceAnalysis.error && (
                <div style={{ background: "#E8FAF9", borderRadius: 12, padding: 14, marginBottom: 12, border: "1.5px solid #2EC4B6" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>Análisis de precio IA</div>
                  <div style={{ fontSize: 12, color: "#3D1F0A", marginBottom: 6 }}>
                    Precio mercado estimado: <strong>{formatPrice(priceAnalysis.precio_mercado_estimado)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#3D1F0A", marginBottom: 6 }}>
                    Evaluación: <strong style={{ color: priceAnalysis.evaluacion === "justo" ? "#059669" : priceAnalysis.evaluacion === "alto" ? "#dc2626" : "#d97706" }}>
                      {priceAnalysis.evaluacion === "justo" ? "✓ Precio justo" : priceAnalysis.evaluacion === "alto" ? "⚠️ Precio alto" : "↓ Precio bajo"}
                    </strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#3D1F0A", marginBottom: 6 }}>
                    Precio sugerido al comprador: <strong>{formatPrice(priceAnalysis.precio_sugerido_venta)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#3D1F0A", marginBottom: 8 }}>
                    Tú recibirías: <strong style={{ color: "#0F6E56" }}>{formatPrice(priceAnalysis.pago_vendedor)}</strong> · Plataforma: {formatPrice(priceAnalysis.precio_plataforma)}
                  </div>
                  <div style={{ fontSize: 11, color: "#7A4522", background: "#fff", borderRadius: 8, padding: "8px 10px" }}>
                    {priceAnalysis.analisis}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                {sLabel("Descripción (opcional)")}
                <textarea style={{ ...inputS, resize: "vertical", minHeight: 60 }} placeholder="Estado, condiciones, observaciones..." value={listingForm.description} onChange={e => setListingForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div style={{ marginBottom: 12 }}>
                {sLabel("Fecha de vencimiento")}
                <input type="date" style={inputS} value={listingForm.expires_at} min={new Date().toISOString().split("T")[0]} onChange={e => setListingForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>

              <div style={{ marginBottom: 12 }}>
                {sLabel("📸 Foto del medicamento * (obligatoria)")}
                <div onClick={() => filePhotoRef.current.click()} style={{ border: "2px dashed #2EC4B6", borderRadius: 12, padding: 16, textAlign: "center", background: "#E8FAF9", cursor: "pointer" }}>
                  {listingForm.photoPreview
                    ? <img src={listingForm.photoPreview} alt="foto" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 8, objectFit: "contain" }} />
                    : <><div style={{ fontSize: 28, marginBottom: 4 }}>📷</div><div style={{ fontSize: 12, color: "#0F6E56", fontWeight: 700 }}>Toca para subir foto</div></>
                  }
                  <input ref={filePhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                    const f = e.target.files[0];
                    if (f) setListingForm(p => ({ ...p, photo: f, photoPreview: URL.createObjectURL(f) }));
                  }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                {sLabel("🧾 Boleta/recibo (opcional)")}
                <div onClick={() => fileReceiptRef.current.click()} style={{ border: "2px dashed #FFD9C8", borderRadius: 12, padding: 12, textAlign: "center", background: "#FFF0EB", cursor: "pointer" }}>
                  {listingForm.receiptPreview
                    ? <img src={listingForm.receiptPreview} alt="boleta" style={{ maxWidth: "100%", maxHeight: 100, borderRadius: 8, objectFit: "contain" }} />
                    : <><div style={{ fontSize: 24, marginBottom: 4 }}>🧾</div><div style={{ fontSize: 12, color: "#FF6B35", fontWeight: 700 }}>Subir boleta (opcional)</div></>
                  }
                  <input ref={fileReceiptRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                    const f = e.target.files[0];
                    if (f) setListingForm(p => ({ ...p, receipt: f, receiptPreview: URL.createObjectURL(f) }));
                  }} />
                </div>
              </div>

              <button onClick={saveListing} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#2EC4B6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                ✓ Publicar medicamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SOLICITUD */}
      {showNewRequest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg, #FF6B35, #e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>🔍 Necesito un medicamento</div>
              <button onClick={() => setShowNewRequest(false)} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                {sLabel("Medicamento que necesitas *")}
                <input style={inputS} placeholder="ej: Apoquel 16mg" value={requestForm.medication_name} onChange={e => setRequestForm(f => ({ ...f, medication_name: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  {sLabel("Cantidad")}
                  <input style={inputS} type="number" min="1" placeholder="ej: 10" value={requestForm.quantity_needed} onChange={e => setRequestForm(f => ({ ...f, quantity_needed: e.target.value }))} />
                </div>
                <div>
                  {sLabel("Unidad")}
                  <select style={{ ...inputS, background: "#fff" }} value={requestForm.unit} onChange={e => setRequestForm(f => ({ ...f, unit: e.target.value }))}>
                    {["comp.", "cáps.", "ml.", "sobre", "ampolla"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                {sLabel("Precio máximo que pagarías (CLP)")}
                <input style={inputS} type="number" min="3000" placeholder="ej: 8000" value={requestForm.max_price_clp} onChange={e => setRequestForm(f => ({ ...f, max_price_clp: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                {sLabel("¿Para qué mascota?")}
                <select style={{ ...inputS, background: "#fff" }} value={requestForm.pet_id} onChange={e => setRequestForm(f => ({ ...f, pet_id: e.target.value }))}>
                  <option value="">Seleccionar mascota...</option>
                  {userPets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button onClick={saveRequest} style={{ width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                ✓ Publicar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
