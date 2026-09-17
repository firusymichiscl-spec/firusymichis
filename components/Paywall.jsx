"use client";

import { useRouter } from "next/navigation";
import { getPetIcon } from "@/lib/petSpecies";

const calcAge = (birthDate) => {
  if (!birthDate) return "Sin datos";
  const [by, bm] = birthDate.split("-").map(Number);
  const now = new Date();
  const totalMonths = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm);
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} mes${m !== 1 ? "es" : ""}`;
  return `${y} año${y !== 1 ? "s" : ""}${m > 0 ? ` ${m} mes${m !== 1 ? "es" : ""}` : ""}`;
};

const getPetAvatar = (species, breed) => getPetIcon(species, breed);

export default function Paywall({ lastPetSnapshot }) {
  const router = useRouter();

  const pet = lastPetSnapshot;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, fontFamily: "'Nunito', sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700;800&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Fondo: snapshot difuminado de la última mascota */}
      <div style={{
        position: "absolute", inset: 0, background: "#FFF8F3", padding: 24,
        filter: "blur(1.5px)", opacity: 0.75, pointerEvents: "none", overflow: "hidden",
      }}>
        {pet && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 4px 24px rgba(61,31,10,0.08)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF0EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden", flexShrink: 0 }}>
                  {pet.photo_url
                    ? <img src={pet.photo_url} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : getPetAvatar(pet.species, pet.breed)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: "#3D1F0A" }}>{pet.name}</div>
                  <div style={{ fontSize: 13, color: "#8A5530" }}>{pet.breed || "Sin raza"} · {calcAge(pet.birth_date)}{pet.weight_kg ? ` · ${pet.weight_kg} kg` : ""}</div>
                </div>
              </div>
            </div>

            {pet.medications?.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 4px 24px rgba(61,31,10,0.08)" }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                  💊 Medicamentos activos
                </div>
                {pet.medications.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F5E6DA" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#3D1F0A" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: "#8A5530" }}>{m.dose} · {m.frequency}</div>
                    </div>
                    {m.stock != null && (
                      <div style={{ alignSelf: "center", fontSize: 12, fontWeight: 700, color: "#8A5530" }}>{m.stock} {m.unit || ""}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,248,243,0.6)", backdropFilter: "blur(1px)" }} />

      {/* Modal */}
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: "32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(61,31,10,0.25)", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: "#3D1F0A", marginBottom: 6 }}>
            Tu período de prueba terminó
          </div>
          <div style={{ fontSize: 14, color: "#8A5530", marginBottom: 24 }}>
            Tus datos están seguros y te esperan.
          </div>

          <div style={{ textAlign: "left", background: "#FFF0EB", borderRadius: 14, padding: 16, marginBottom: 22 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: "#3D1F0A", marginBottom: 4 }}>Plan PRO</div>
            <div style={{ fontSize: 12.5, color: "#7A4522" }}>✓ Hasta 3 mascotas · Asistente IA · Exportar PDF</div>
            <div style={{ fontSize: 12, color: "#8A5530", marginTop: 6 }}>Elige 3, 6 o 12 meses en el siguiente paso.</div>
          </div>

          <button onClick={() => router.push("/pago")} style={{
            width: "100%", padding: 14, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg,#FF6B35,#e85d2e)", color: "#fff",
            fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 20px rgba(255,107,53,0.3)",
          }}>
            Ver planes y continuar →
          </button>

          <a href="mailto:contacto@firusymichis.cl" style={{
            display: "block", width: "100%", padding: 12, borderRadius: 14, marginTop: 10,
            background: "transparent", border: "1.5px solid #FFD9C8", color: "#7A4522",
            fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, textDecoration: "none",
            boxSizing: "border-box",
          }}>
            Hablar con soporte
          </a>

          <div style={{ fontSize: 11, color: "#B08968", marginTop: 16 }}>
            🔒 Pago seguro · Cancela cuando quieras
          </div>
        </div>
      </div>
    </div>
  );
}
