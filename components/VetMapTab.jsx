"use client";
import { useState, useEffect, useRef } from "react";

const RADII = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
];

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
  const [selectedVet, setSelectedVet] = useState(null);
  const [copied, setCopied] = useState(false);

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

  // Buscar veterinarias
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
        ...(openNow ? { open_now: true } : {}),
      });
      const res = await fetch(`/api/places?${params}`);
      const data = await res.json();
      const results = data.results || [];
      setVets(results);
      updateMarkers(results);
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

  useEffect(() => {
    if (location && googleLoaded) searchVets();
  }, [radius, openNow]);

  const copyVetInfo = (vet) => {
    const info = [vet.name, vet.vicinity, vet.formatted_phone_number].filter(Boolean).join("\n");
    navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDistance = (vetLocation) => {
    if (!location || !vetLocation) return null;
    const R = 6371000;
    const dLat = (vetLocation.lat - location.lat) * Math.PI / 180;
    const dLng = (vetLocation.lng - location.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(location.lat * Math.PI/180) * Math.cos(vetLocation.lat * Math.PI/180) * Math.sin(dLng/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return dist < 1000 ? `${Math.round(dist)} m` : `${(dist/1000).toFixed(1)} km`;
  };

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
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#7A4522", fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={openNow} onChange={e => setOpenNow(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#FF6B35" }} />
          Solo abiertas ahora
        </label>
      </div>

      {/* Error de ubicación */}
      {locationError && (
        <div style={{ background: "#fef2f2", borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginBottom: 6 }}>⚠️ {locationError}</div>
          <button onClick={getLocation} style={{ padding: "6px 14px", borderRadius: 8, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Reintentar
          </button>
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
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2EC4B6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏥 Clínicas visitadas por {pet.name}</div>
          {historyVets.map((vet, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < historyVets.length - 1 ? "1px solid #FFF0EB" : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>{vet}</div>
              <button onClick={() => { navigator.clipboard.writeText(vet); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ padding: "4px 10px", borderRadius: 8, background: "#E8FAF9", color: "#2EC4B6", border: "1px solid #9FE1CB", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {copied ? "✓" : "Copiar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lista de veterinarias */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        {loading ? "Buscando veterinarias..." : `${vets.length} veterinarias encontradas`}
      </div>

      {vets.map((vet, i) => {
        const dist = getDistance(vet.geometry?.location);
        const isFromHistory = historyVets.some(h => h.toLowerCase().includes(vet.name.toLowerCase()));
        return (
          <div key={i} style={{ ...css.card, border: selectedVet?.place_id === vet.place_id ? "2px solid #FF6B35" : "none" }}
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
                  {vet.opening_hours?.open_now !== undefined && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: vet.opening_hours.open_now ? "#059669" : "#dc2626" }}>
                      {vet.opening_hours.open_now ? "● Abierto" : "● Cerrado"}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); copyVetInfo(vet); }}
                style={{ padding: "5px 10px", borderRadius: 8, background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>
                {copied ? "✓" : "Copiar"}
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
    </div>
  );
}
