import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", background: "#FFF8F3", padding: 40 },
  header: { backgroundColor: "#FF6B35", borderRadius: 12, padding: 24, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 16 },
  headerText: { flex: 1 },
  petName: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  petBreed: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  avatar: { width: 72, height: 72, borderRadius: 36, border: "3px solid rgba(255,255,255,0.4)" },
  brand: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 8 },
  section: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 14, border: "1px solid #F5E6DA" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#FFF0EB" },
  rowLabel: { fontSize: 11, color: "#C4845A" },
  rowValue: { fontSize: 11, fontWeight: "bold", color: "#3D1F0A" },
  pill: { backgroundColor: "#FFF0EB", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, marginRight: 5, marginBottom: 5 },
  pillText: { fontSize: 10, color: "#FF6B35", fontWeight: "bold" },
  pillDanger: { backgroundColor: "#fef2f2" },
  pillDangerText: { color: "#dc2626" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  medRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#FFF0EB", gap: 10 },
  medAccent: { width: 4, height: 36, borderRadius: 2 },
  medName: { fontSize: 12, fontWeight: "bold", color: "#3D1F0A" },
  medDetail: { fontSize: 10, color: "#C4845A", marginTop: 2 },
  vaccineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#FFF0EB" },
  vaccineName: { fontSize: 12, fontWeight: "bold", color: "#3D1F0A" },
  vaccineDate: { fontSize: 10, color: "#C4845A", marginTop: 2 },
  badge: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  badgeOk: { backgroundColor: "#e8faf4" },
  badgeWarn: { backgroundColor: "#fff7ed" },
  badgeDanger: { backgroundColor: "#fef2f2" },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  histRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#FFF0EB" },
  histEvent: { fontSize: 12, fontWeight: "bold", color: "#3D1F0A" },
  histDetail: { fontSize: 10, color: "#C4845A", marginTop: 2 },
  footer: { marginTop: 20, textAlign: "center", fontSize: 9, color: "#C4845A" },
  weightNote: { fontSize: 10, color: "#7A4522", fontStyle: "italic" },
});

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

export async function GET(req, { params }) {
  const { token } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: share } = await supabaseAdmin
    .from("pet_shares")
    .select("*")
    .eq("token", token)
    .eq("active", true)
    .single();

  if (!share) {
    return new Response("Ficha no encontrada", { status: 404 });
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return new Response("Enlace expirado", { status: 410 });
  }

  const { data: pet } = await supabaseAdmin.from("pets").select("*").eq("id", share.pet_id).single();
  const { data: meds } = await supabaseAdmin.from("medications").select("*").eq("pet_id", share.pet_id).eq("active", true);
  const { data: history } = await supabaseAdmin.from("medical_history").select("*").eq("pet_id", share.pet_id).order("event_date", { ascending: false }).limit(15);
  const { data: weights } = await supabaseAdmin.from("weight_logs").select("*").eq("pet_id", share.pet_id).order("logged_date", { ascending: true });

  const vaccines = history?.filter(h => h.type === "vaccine") || [];
  const medHistory = history?.filter(h => h.type !== "vaccine") || [];

  const sexLabel = pet?.sex === "male" ? "Macho" : pet?.sex === "female" ? "Hembra" : "Sin datos";
  const speciesLabel = pet?.species === "dog" ? "Perro" : pet?.species === "cat" ? "Gato" : "Otro";

  const weightByYear = {};
  weights?.forEach(w => {
    const y = w.logged_date?.slice(0, 4);
    if (y) {
      if (!weightByYear[y]) weightByYear[y] = [];
      weightByYear[y].push(parseFloat(w.weight_kg));
    }
  });
  const weightSummary = Object.entries(weightByYear).map(([year, vals]) => ({
    year,
    avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    min: Math.min(...vals).toFixed(1),
    max: Math.max(...vals).toFixed(1),
  }));

  const MyDoc = () => (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>Firus&Michis · firusymichis.cl</Text>
            <Text style={styles.petName}>{pet?.name}</Text>
            <Text style={styles.petBreed}>{pet?.breed} · {calcAge(pet?.birth_date)}</Text>
          </View>
          {pet?.photo_url && (
            <Image style={styles.avatar} src={pet.photo_url} />
          )}
        </View>

        {/* DATOS BÁSICOS */}
        {share.show_basics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos básicos</Text>
            {[
              ["Especie", speciesLabel],
              ["Raza", pet?.breed || "Sin datos"],
              ["Sexo", sexLabel],
              ["Edad", calcAge(pet?.birth_date)],
              ["Peso actual", pet?.weight_kg ? `${pet.weight_kg} kg` : "Sin datos"],
              ["Fecha nacimiento", formatDate(pet?.birth_date)],
            ].map(([l, v]) => (
              <View style={styles.row} key={l}>
                <Text style={styles.rowLabel}>{l}</Text>
                <Text style={styles.rowValue}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CONDICIONES */}
        {share.show_conditions && pet?.conditions?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condiciones de salud</Text>
            <View style={styles.pillRow}>
              {pet.conditions.map(c => (
                <View style={styles.pill} key={c}>
                  <Text style={styles.pillText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ALERGIAS */}
        {share.show_allergies && pet?.allergies?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alergias a medicamentos</Text>
            <View style={styles.pillRow}>
              {pet.allergies.map(a => (
                <View style={[styles.pill, styles.pillDanger]} key={a}>
                  <Text style={[styles.pillText, styles.pillDangerText]}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* MEDICAMENTOS */}
        {share.show_medications && meds?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medicamentos activos</Text>
            {meds.map(m => (
              <View style={styles.medRow} key={m.id}>
                <View style={[styles.medAccent, { backgroundColor: m.color || "#FF6B35" }]} />
                <View>
                  <Text style={styles.medName}>{m.name}</Text>
                  {m.dose && <Text style={styles.medDetail}>{m.dose}</Text>}
                  {m.frequency && <Text style={styles.medDetail}>{m.frequency}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* VACUNAS */}
        {share.show_vaccines && vaccines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vacunas</Text>
            {vaccines.map(v => {
              const days = v.next_date ? Math.ceil((new Date(v.next_date) - new Date()) / 86400000) : null;
              const badgeStyle = days === null ? styles.badgeWarn : days < 0 ? styles.badgeDanger : days < 60 ? styles.badgeWarn : styles.badgeOk;
              const badgeColor = days === null ? "#d97706" : days < 0 ? "#dc2626" : days < 60 ? "#d97706" : "#059669";
              const badgeLabel = days === null ? "Sin fecha" : days < 0 ? "VENCIDA" : `${days}d`;
              return (
                <View style={styles.vaccineRow} key={v.id}>
                  <View>
                    <Text style={styles.vaccineName}>{v.event}</Text>
                    <Text style={styles.vaccineDate}>Aplicada: {formatDate(v.event_date)}{v.next_date ? ` · Prox: ${formatDate(v.next_date)}` : ""}</Text>
                  </View>
                  <View style={[styles.badge, badgeStyle]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* PESO */}
        {weightSummary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evolucion de peso</Text>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: "bold" }]}>Ano</Text>
              <Text style={[styles.rowLabel, { fontWeight: "bold" }]}>Promedio</Text>
              <Text style={[styles.rowLabel, { fontWeight: "bold" }]}>Min</Text>
              <Text style={[styles.rowLabel, { fontWeight: "bold" }]}>Max</Text>
            </View>
            {weightSummary.map(w => (
              <View style={styles.row} key={w.year}>
                <Text style={styles.rowValue}>{w.year}</Text>
                <Text style={styles.rowValue}>{w.avg} kg</Text>
                <Text style={styles.rowLabel}>{w.min} kg</Text>
                <Text style={styles.rowLabel}>{w.max} kg</Text>
              </View>
            ))}
          </View>
        )}

        {/* HISTORIAL */}
        {share.show_history && medHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial medico</Text>
            {medHistory.slice(0, 10).map(h => (
              <View style={styles.histRow} key={h.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.histEvent}>{h.event}</Text>
                  <Text style={styles.histDetail}>{formatDate(h.event_date)}</Text>
                </View>
                {h.vet_clinic && <Text style={styles.histDetail}>Clinica: {h.vet_clinic}</Text>}
                {h.notes && <Text style={styles.histDetail}>{h.notes}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* FOOTER */}
        <Text style={styles.footer}>
          Ficha generada por Firus&Michis · firusymichis.cl · {new Date().toLocaleDateString("es-CL")}
        </Text>

      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(<MyDoc />);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-${pet?.name?.toLowerCase()}.pdf"`,
    },
  });
}
