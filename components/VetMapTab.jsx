"use client";
import { useState, useEffect, useRef } from "react";

const RADII = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
];

// Lote R Fix 3 — instrucciones para activar la ubicación cuando el
// navegador la bloqueó. Texto en español chileno, sin jerga técnica, pasos
// numerados y accionables. "generic" es el fallback si la detección de
// navegador/SO falla o no reconoce el caso — siempre debe existir y cubrir
// el flujo genérico de "candado → permisos → ubicación → permitir".
const LOCATION_INSTRUCTIONS = {
  "ios-safari": {
    label: "Safari en iPhone",
    steps: [
      "Abre la app Ajustes de tu iPhone.",
      "Baja y toca Safari.",
      "Toca Ubicación y elige Preguntar o Permitir.",
      "Si con eso no basta: Ajustes → Privacidad y seguridad → Localización → activa el interruptor general y busca Safari en la lista.",
      'Vuelve a esta página y toca "Reintentar".',
    ],
  },
  "android-chrome": {
    label: "Chrome en Android",
    steps: [
      "Toca el candado 🔒 (o los tres puntos ⋮) junto a la dirección del sitio, arriba de la pantalla.",
      "Toca Permisos.",
      "Busca Ubicación y elige Permitir.",
      'Vuelve a esta página y toca "Reintentar".',
    ],
  },
  "desktop-chrome": {
    label: "Chrome / Edge en computador",
    steps: [
      "Haz clic en el ícono de candado 🔒 a la izquierda de la dirección del sitio.",
      "Busca Ubicación en la lista de permisos.",
      "Cámbiala a Permitir.",
      'Recarga la página y toca "Reintentar".',
    ],
  },
  firefox: {
    label: "Firefox",
    steps: [
      "Haz clic en el candado 🔒 a la izquierda de la dirección del sitio.",
      "Toca Conexión segura y luego Más información.",
      "Ve a la pestaña Permisos.",
      'Busca "Acceder a tu ubicación" y quita el bloqueo (o elige Permitir).',
      'Recarga la página y toca "Reintentar".',
    ],
  },
  generic: {
    label: "Otro navegador",
    steps: [
      "Busca el ícono de candado 🔒 o de información junto a la dirección del sitio.",
      "Entra a los permisos o la configuración del sitio.",
      "Busca Ubicación y cámbiala a Permitir.",
      'Recarga la página y toca "Reintentar".',
    ],
  },
};

// Detección best-effort por user agent — nunca puede fallar duro: cualquier
// caso no reconocido cae a "generic", que siempre existe y sirve como guía
// universal. El selector de pestañas (3.3) cubre el resto de los casos.
function detectLocationHelpPlatform() {
  if (typeof navigator === "undefined") return "generic";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) return "ios-safari";
  if (/Android/.test(ua) && /Chrome/.test(ua)) return "android-chrome";
  if (/Firefox/.test(ua)) return "firefox";
  if (/Chrome|Edg\//.test(ua)) return "desktop-chrome";
  return "generic";
}

export default function VetMapTab({ pet, history }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(3000);
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState("distance");
  const [selectedVet, setSelectedVet] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null); // { key, ok }
  // Lote R Fix 3 — tutorial de permiso de ubicación. helpPlatform arranca
  // en la detección automática; el usuario puede cambiarla a mano si la
  // detección falló (3.3).
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [helpPlatform, setHelpPlatform] = useState(detectLocationHelpPlatform);

  // Veterinarias del historial de la mascota
  const historyVets = [...new Set(
    history?.filter(h => h.vet_clinic).map(h => h.vet_clinic) || []
  )];

  // Cargar Google Maps
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.maps) { setGoogleLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener("load", () => setGoogleLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => setGoogleLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Obtener ubicación del usuario
  const getLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("No se pudo obtener tu ubicación. Verifica los permisos.")
    );
  };

  useEffect(() => { getLocation(); }, []);

  // Inicializar mapa cuando hay ubicación y Google cargado
  useEffect(() => {
    if (!googleLoaded || !location || !mapRef.current) return;
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: location,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });
    searchVets();
  }, [googleLoaded, location]);

  // Buscar veterinarias. open_now NO se envía a la API: se trae siempre el
  // set completo (abiertas y cerradas) y el filtro/orden se aplica en el
  // cliente, para no gastar cuota de Places con cada toggle.
  const searchVets = async () => {
    if (!location) return;
    setLoading(true);
    setSelectedVet(null);
    try {
      const params = new URLSearchParams({
        q: "veterinaria clínica veterinaria",
        lat: location.lat,
        lng: location.lng,
        radius,
      });
      const res = await fetch(`/api/places?${params}`);
      const data = await res.json();
      setVets(data.results || []);
    } catch {
      setVets([]);
    }
    setLoading(false);
  };

  // Actualizar marcadores en el mapa
  const updateMarkers = (results) => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    results.forEach((vet, i) => {
      if (!vet.geometry?.location) return;
      const marker = new window.google.maps.Marker({
        position: vet.geometry.location,
        map: mapInstanceRef.current,
        title: vet.name,
        label: { text: `${i + 1}`, color: "#fff", fontWeight: "bold", fontSize: "11px" },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: "#FF6B35",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => setSelectedVet(vet));
      markersRef.current.push(marker);
    });
    // Marcador de usuario
    new window.google.maps.Marker({
      position: location,
      map: mapInstanceRef.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#2EC4B6",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      title: "Tu ubicación",
    });
    // Círculo de radio
    new window.google.maps.Circle({
      strokeColor: "#FF6B35",
      strokeOpacity: 0.3,
      strokeWeight: 1,
      fillColor: "#FF6B35",
      fillOpacity: 0.05,
      map: mapInstanceRef.current,
      center: location,
      radius,
    });
  };

  // Solo el radio dispara una nueva búsqueda a la API — es un set de
  // resultados distinto. openNow y sortBy se resuelven abajo en el cliente.
  useEffect(() => {
    if (location && googleLoaded) searchVets();
  }, [radius]);

  // Copia solo el nombre (para pegar en el campo "Veterinaria" de un evento
  // médico o vacuna). Si el navegador no soporta clipboard o falla, deja un
  // fallback discreto en vez de fallar en silencio.
  const copyText = async (text, key) => {
    let ok = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard no soportado");
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    setCopyStatus({ key, ok });
    setTimeout(() => setCopyStatus(s => (s?.key === key ? null : s)), 2000);
  };

  const getDistanceMeters = (vetLocation) => {
    if (!location || !vetLocation) return Infinity;
    const R = 6371000;
    const dLat = (vetLocation.lat - location.lat) * Math.PI / 180;
    const dLng = (vetLocation.lng - location.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(location.lat * Math.PI/180) * Math.cos(vetLocation.lat * Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const getDistance = (vetLocation) => {
    const dist = getDistanceMeters(vetLocation);
    if (!isFinite(dist)) return null;
    return dist < 1000 ? `${Math.round(dist)} m` : `${(dist/1000).toFixed(1)} km`;
  };

  // Google no siempre trae opening_hours para todos los locales de un
  // resultado; si NINGUNO de los resultados actuales lo trae, ocultamos el
  // filtro/orden por horario en vez de mostrar un control que no hace nada.
  const hasOpenNowData = vets.some(v => v.opening_hours?.open_now !== undefined);

  const sortedVets = [...vets].sort((a, b) => {
    if (sortBy === "rating") {
      const diff = (b.rating || 0) - (a.rating || 0);
      return diff !== 0 ? diff : (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
    }
    if (sortBy === "open") {
      const aOpen = a.opening_hours?.open_now ? 1 : 0;
      const bOpen = b.opening_hours?.open_now ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
    }
    return getDistanceMeters(a.geometry?.location) - getDistanceMeters(b.geometry?.location);
  });

  const displayVets = (openNow && hasOpenNowData)
    ? sortedVets.filter(v => v.opening_hours?.open_now)
    : sortedVets;

  // Los marcadores del mapa siguen exactamente lo que se muestra en la
  // lista (orden y filtro), no el resultado crudo de la API.
  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers(displayVets);
  }, [vets, sortBy, openNow]);

  const css = {
    card: { background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" },
  };

  return (
    <div className="fade-up">

      {/* Filtros */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Radio de búsqueda</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {RADII.map(r => (
            <div key={r.value} onClick={() => setRadius(r.value)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${radius === r.value ? "#FF6B35" : "#FFD9C8"}`, background: radius === r.value ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: 700, color: radius === r.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
              {r.label}
            </div>
          ))}
        </div>
        {hasOpenNowData && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#7A4522", fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
            <input type="checkbox" checked={openNow} onChange={e => {
              const checked = e.target.checked;
              setOpenNow(checked);
              // "Ordenar por abiertas" no tiene sentido si ya se filtra solo por abiertas.
              if (checked && sortBy === "open") setSortBy("distance");
            }} style={{ width: 14, height: 14, accentColor: "#FF6B35" }} />
            Solo abiertas ahora
          </label>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Ordenar por</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "distance", label: "Cercanía" },
            { id: "rating", label: "Mejor evaluadas" },
            ...(hasOpenNowData && !openNow ? [{ id: "open", label: "Abiertas ahora" }] : []),
          ].map(o => (
            <div key={o.id} onClick={() => setSortBy(o.id)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${sortBy === o.id ? "#FF6B35" : "#FFD9C8"}`, background: sortBy === o.id ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: 700, color: sortBy === o.id ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
              {o.label}
            </div>
          ))}
        </div>
      </div>

      {/* Error de ubicación */}
      {locationError && (
        <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginBottom: 10 }}>⚠️ {locationError}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={getLocation} style={{ padding: "6px 14px", borderRadius: 8, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Reintentar
            </button>
            <button onClick={() => setShowLocationHelp(v => !v)}
              style={{ background: "transparent", border: "none", color: "#dc2626", fontSize: 12, fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
              {showLocationHelp ? "Ocultar instrucciones" : "¿Cómo activar la ubicación?"}
            </button>
          </div>

          {showLocationHelp && (
            <div style={{ marginTop: 12, background: "#fff", borderRadius: 10, border: "1px solid #fecaca", padding: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {Object.entries(LOCATION_INSTRUCTIONS).map(([id, info]) => (
                  <div key={id} onClick={() => setHelpPlatform(id)}
                    style={{ padding: "4px 10px", borderRadius: 16, border: `1.5px solid ${helpPlatform === id ? "#FF6B35" : "#FFD9C8"}`, background: helpPlatform === id ? "#FFF0EB" : "#fff", fontSize: 10, fontWeight: 700, color: helpPlatform === id ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                    {info.label}
                  </div>
                ))}
              </div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {LOCATION_INSTRUCTIONS[helpPlatform].steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: "#3D1F0A", lineHeight: 1.6, marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Mapa */}
      {location && (
        <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
          <div ref={mapRef} style={{ width: "100%", height: 240 }} />
        </div>
      )}

      {/* Veterinarias del historial */}
      {historyVets.length > 0 && (
        <div style={css.card}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2EC4B6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>🏥 Clínicas visitadas por {pet.name}</div>
          <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 10 }}>Copia el nombre para pegarlo al registrar un evento médico o vacuna.</div>
          {historyVets.map((vet, i) => {
            const key = `hist-${i}`;
            const status = copyStatus?.key === key ? copyStatus : null;
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < historyVets.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{vet}</div>
                <button onClick={() => copyText(vet, key)}
                  style={{ padding: "4px 10px", borderRadius: 8, background: status?.ok ? "#e8faf4" : status && !status.ok ? "#fef2f2" : "#E8FAF9", color: status?.ok ? "#059669" : status && !status.ok ? "#dc2626" : "#2EC4B6", border: `1px solid ${status?.ok ? "#a7f3d0" : status && !status.ok ? "#fecaca" : "#9FE1CB"}`, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {status?.ok ? "✓ Copiado" : status && !status.ok ? "No se pudo copiar" : "📋 Copiar nombre"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de veterinarias */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
        {loading ? "Buscando veterinarias..." : `${displayVets.length} veterinarias encontradas`}
      </div>
      {!loading && (
        <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 10 }}>Copia el nombre para pegarlo al registrar un evento médico o vacuna.</div>
      )}

      {displayVets.map((vet, i) => {
        const dist = getDistance(vet.geometry?.location);
        const isFromHistory = historyVets.some(h => h.toLowerCase().includes(vet.name.toLowerCase()));
        const key = vet.place_id || i;
        const status = copyStatus?.key === key ? copyStatus : null;
        return (
          <div key={key} style={{ ...css.card, border: selectedVet?.place_id === vet.place_id ? "2px solid #FF6B35" : "none" }}
            onClick={() => { setSelectedVet(vet === selectedVet ? null : vet); mapInstanceRef.current?.panTo(vet.geometry.location); mapInstanceRef.current?.setZoom(16); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A" }}>{vet.name}</div>
                  {isFromHistory && <span style={{ background: "#E8FAF9", color: "#0F6E56", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6 }}>✓ Visitada</span>}
                </div>
                {vet.vicinity && <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 3 }}>📍 {vet.vicinity}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {dist && <span style={{ fontSize: 10, fontWeight: 700, color: "#7A4522" }}>📏 {dist}</span>}
                  {vet.rating && <span style={{ fontSize: 10, fontWeight: 700, color: "#FFD166" }}>⭐ {vet.rating} ({vet.user_ratings_total || 0})</span>}
                  {vet.opening_hours?.open_now === true && <span style={{ fontSize: 10, fontWeight: 700, color: "#059669" }}>🟢 Abierto</span>}
                  {vet.opening_hours?.open_now === false && <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626" }}>🔴 Cerrado</span>}
                  {vet.opening_hours?.open_now === undefined && <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>Sin dato de horario</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); copyText(vet.name, key); }}
                style={{ padding: "5px 10px", borderRadius: 8, background: status?.ok ? "#e8faf4" : status && !status.ok ? "#fef2f2" : "#FFF0EB", color: status?.ok ? "#059669" : status && !status.ok ? "#dc2626" : "#FF6B35", border: `1px solid ${status?.ok ? "#a7f3d0" : status && !status.ok ? "#fecaca" : "#FFD0BC"}`, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, marginLeft: 8, whiteSpace: "nowrap" }}>
                {status?.ok ? "✓ Copiado" : status && !status.ok ? "No se pudo copiar" : "📋 Copiar nombre"}
              </button>
            </div>
          </div>
        );
      })}

      {!loading && vets.length === 0 && location && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🏥</div>
            <p>No se encontraron veterinarias en este radio</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Intenta aumentar el radio de búsqueda</p>
          </div>
        </div>
      )}

      {!loading && vets.length > 0 && displayVets.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🕒</div>
            <p>Ninguna está abierta ahora</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Desactiva &ldquo;Solo abiertas ahora&rdquo; para ver todas</p>
          </div>
        </div>
      )}
    </div>
  );
}
