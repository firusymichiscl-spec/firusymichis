"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ThemeSelector from "@/components/ThemeSelector";
import WeightChart from "@/components/WeightChart";
import PetPhotoUpload from "@/components/PetPhotoUpload";
import EditPetModal from "@/components/EditPetModal";
import DietTimeline from "@/components/DietTimeline";
import TutorTab from "@/components/TutorTab";
import AITab from "@/components/AITab";
import VetMapTab from "@/components/VetMapTab";
import QRShareModal from "@/components/QRShareModal";
import NotificationSettings from "@/components/NotificationSettings";
import Paywall from "@/components/Paywall";
import ArchivePetModal from "@/components/ArchivePetModal";
import { compressImage } from "@/lib/images/compress";
import { logActivity } from "@/lib/activityLog";

const TYPE_STYLES = {
  surgery:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", icon: "🔪", label: "Cirugía" },
  illness:   { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b", icon: "🤒", label: "Enfermedad" },
  exam:      { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6", icon: "🧪", label: "Examen" },
  procedure: { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6", icon: "⚕️", label: "Procedimiento" },
  vaccine:   { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", icon: "💉", label: "Vacuna" },
  other:     { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", icon: "📝", label: "Otro" },
};

const MEDS_LIST = [
  'Nexgard','Bravecto','Simparica','Frontline','Revolution','Milbemax','Drontal',
  'Meloxicam','Rimadyl','Previcox','Metacam','Tramadol',
  'Amoxicilina','Cefalexina','Metronidazol','Enrofloxacina','Doxiciclina',
  'Levotiroxina','Trilostano','Prednisolona','Dexametasona',
  'Apoquel','Cytopoint','Atopica',
  'Omeprazol','Sucralfato','Metoclopramida','Famotidina',
  'Omega 3 Vet','Condroitín','Glucosamina','Probióticos Vet',
];

const FREQUENCIES = [
  'Cada 12 horas','1 vez al día','2 veces al día','3 veces al día',
  'Cada 48 horas','Semanal','Mensual','Según necesidad',
];

const UNITS = ['comp.','cáps.','ml.','sobre','ampolla'];

const COLORS = [
  { value: '#FF6B35' },{ value: '#2EC4B6' },{ value: '#FFD166' },
  { value: '#8B5CF6' },{ value: '#EF4444' },{ value: '#10B981' },
];

const FREQ_DOSES_PER_DAY = {
  'Cada 12 horas': 2, '1 vez al día': 1, '2 veces al día': 2,
  '3 veces al día': 3, 'Cada 48 horas': 0.5, 'Semanal': 1/7, 'Mensual': 1/30,
};

const VACCINES_DOG = ["Séxtuple", "Rabia", "Bordetella", "Leptospira", "Parvovirus", "Moquillo", "Hepatitis"];
const VACCINES_CAT = ["Triple Felina", "Rabia", "Leucemia Felina", "Calicivirus", "Panleucopenia"];
const VACCINES_OTHER = ["Rabia", "Mixomatosis"];

const emptyMedForm = {
  name:'', dose:'', frequency:'', frequency_custom:'',
  stock:'', unit:'comp.', color:'#FF6B35', in_ayunas: false,
  mg_per_unit:'', prescribed_dose:'',
};

export default function DashboardClient({ pet: initialPet, allPets, medications: initialMeds, history, vaccines, user, lastWeight, userPlan, diasRestantes, initialTheme, initialCustomColor, showTrialBanner, trialExpired, lastPetSnapshot }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [showActivatedToast, setShowActivatedToast] = useState(false);
  const [tab, setTab] = useState("ficha");
  const [editingPet, setEditingPet] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [petData, setPetData] = useState(initialPet);
  const [currentWeight, setCurrentWeight] = useState(lastWeight?.weight_kg || initialPet.weight_kg);
  const [activePetId, setActivePetId] = useState(initialPet.id);
  const [allPetsData, setAllPetsData] = useState(allPets || []);
  const [showPetSwitcher, setShowPetSwitcher] = useState(false);
  const [switchingPet, setSwitchingPet] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showBirthdayBanner, setShowBirthdayBanner] = useState(true);

  const isArchived = !!petData.archived_at;

  // Cumpleaños: comparar día/mes en hora local sin construir un Date desde el
  // string ISO (evita el corrimiento de -1 día en timezones negativos como Chile).
  const isBirthdayToday = (() => {
    if (isArchived || !petData.birth_date) return false;
    const [, bm, bd] = petData.birth_date.split("-").map(Number);
    const today = new Date();
    return bm === today.getMonth() + 1 && bd === today.getDate();
  })();

  const ageYears = (() => {
    if (!petData.birth_date) return null;
    const [by, bm, bd] = petData.birth_date.split("-").map(Number);
    const today = new Date();
    let years = today.getFullYear() - by;
    const hadBirthdayThisYear = today.getMonth() + 1 > bm || (today.getMonth() + 1 === bm && today.getDate() >= bd);
    if (!hadBirthdayThisYear) years--;
    return years;
  })();

  // Medications
  const [meds, setMeds] = useState(initialMeds);
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState(null);
  const [medForm, setMedForm] = useState(emptyMedForm);
  const [medSaving, setMedSaving] = useState(false);
  const [medSaved, setMedSaved] = useState(false);
  const [customFreq, setCustomFreq] = useState(false);

  const [showHistModal, setShowHistModal] = useState(false);
  const [histForm, setHistForm] = useState({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "", vaccine_name: "", vaccine_next_date: "", event_time: "", intensity: "", duration_minutes: "", photo: null, photoPreview: null, is_public: false });
  const histPhotoRef = useRef();
  const [histSaving, setHistSaving] = useState(false);

  const onHistPhotoSelect = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const { blob } = await compressImage(f);
      const preview = URL.createObjectURL(blob);
      setHistForm(p => ({ ...p, photo: blob, photoPreview: preview }));
    } catch (err) {
      setHistErrors(prev => ({ ...prev, photo: err.message }));
    }
  };
  const [histSaved, setHistSaved] = useState(false);
  const [historyData, setHistoryData] = useState(history);
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicSuggestions, setClinicSuggestions] = useState([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const [histErrors, setHistErrors] = useState({});
  const [editingHistId, setEditingHistId] = useState(null);
  const [histExpanded, setHistExpanded] = useState(false);
  const [histFilter, setHistFilter] = useState("all");

  const activeMeds = meds.filter(m => m.active);
  const historyMeds = meds.filter(m => !m.active);
  const [medsView, setMedsView] = useState("todos");
  const [treatmentItems, setTreatmentItems] = useState([]);
  const [momentosExpanded, setMomentosExpanded] = useState({});
  const [selectedTreatmentGroupId, setSelectedTreatmentGroupId] = useState(null);
  const [dosisMsg, setDosisMsg] = useState({});

  const loadTreatmentItems = async () => {
    const { data } = await supabase
      .from("treatment_items")
      .select("*, treatments(diagnostico, doctor, vet_clinic, emission_date, recipe_date)")
      .eq("pet_id", petData.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    setTreatmentItems(data || []);
  };

  useEffect(() => { loadTreatmentItems(); }, []);

  const deleteTreatmentGroup = async (treatmentId) => {
    if (!confirm("¿Eliminar este tratamiento? Esta acción no se puede deshacer.")) return;
    const names = treatmentItems.filter(ti => ti.treatment_id === treatmentId).map(ti => ti.name).join(", ");
    await supabase.from("treatment_items").delete().eq("treatment_id", treatmentId);
    await supabase.from("treatments").delete().eq("id", treatmentId);
    await logActivity(supabase, petData.id, "Eliminó tratamiento", names || null);
    if (selectedTreatmentGroupId === treatmentId) setSelectedTreatmentGroupId(null);
    await loadTreatmentItems();
  };

  useEffect(() => {
    const petParam = searchParams.get("pet");
    if (petParam) {
      // Acepta slug ("kiara") o UUID completo (retrocompatibilidad con URLs viejas).
      const valid = allPetsData.find(p => p.id === petParam || p.slug === petParam);
      if (valid && valid.id !== activePetId) { switchPet(valid.id); return; }
      if (valid) return; // ya es la activa, no hay nada que hacer
    }
    // Sin param válido: seleccionar la mascota activa más nueva (las archivadas
    // nunca son la vista por defecto, solo se llega a ellas desde el switcher).
    const activeCandidates = allPetsData.filter(p => !p.archived_at);
    const pool = activeCandidates.length > 0 ? activeCandidates : allPetsData;
    if (pool.length > 1) {
      const newest = pool.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
      if (newest.id !== activePetId) switchPet(newest.id);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("activated") === "true") {
      setShowActivatedToast(true);
      router.replace("/dashboard", { scroll: false });
      const t = setTimeout(() => setShowActivatedToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  const switchPet = async (newPetId) => {
    if (newPetId === activePetId) { setShowPetSwitcher(false); return; }
    setSwitchingPet(true);
    setShowPetSwitcher(false);

    // Reset inmediato de todos los estados
    setHistoryData([]);
    setMeds([]);
    setCurrentWeight(null);
    setTreatmentItems([]);
    setTab("ficha");
    setMedsView("todos");
    setHistFilter("all");
    setHistExpanded(false);
    setEditingPet(false);
    setShowQRModal(false);
    setShowHistModal(false);
    setShowMedModal(false);

    // Cargar datos de la nueva mascota
    const [petRes, medsRes, histRes, weightRes, treatRes] = await Promise.all([
      supabase.from("pets").select("*").eq("id", newPetId).single(),
      supabase.from("medications").select("*").eq("pet_id", newPetId).order("created_at", { ascending: false }),
      supabase.from("medical_history").select("*").eq("pet_id", newPetId).order("event_date", { ascending: false }),
      supabase.from("weight_logs").select("weight_kg, logged_date").eq("pet_id", newPetId).order("logged_date", { ascending: false }).limit(1).single(),
      supabase.from("treatment_items").select("*, treatments(diagnostico, doctor, vet_clinic, emission_date, recipe_date)").eq("pet_id", newPetId).eq("active", true).order("created_at", { ascending: false }),
    ]);

    setPetData(petRes.data);
    setMeds(medsRes.data || []);
    setHistoryData(histRes.data || []);
    setCurrentWeight(weightRes.data?.weight_kg || petRes.data?.weight_kg || null);
    setTreatmentItems(treatRes.data || []);
    setActivityFeed([]);
    setActivePetId(newPetId);
    // Slug legible en la URL si ya existe (columna slug agregada en migración);
    // si la mascota aún no tiene slug, cae de vuelta al UUID.
    router.replace(`?pet=${petRes.data?.slug || newPetId}`, { scroll: false });
    setSwitchingPet(false);
  };

  // Borra todas las tablas hijas de una mascota en el orden correcto.
  // treatment_items antes que treatments (treatment_items.treatment_id las referencia),
  // todo antes que pets (RLS de treatments requiere que pets exista).
  // medication_logs NO tiene pet_id — se relaciona por medication_id, se borra aparte.
  // Retorna false y loguea si algún paso falla — el caller debe abortar sin borrar pets.
  const deleteChildTables = async (pid) => {
    const { data: petMeds, error: medsLookupError } = await supabase
      .from("medications")
      .select("id")
      .eq("pet_id", pid);
    if (medsLookupError) {
      console.error("[deletePet] Error leyendo medications para medication_logs:", medsLookupError.message);
      return false;
    }
    const medIds = (petMeds || []).map(m => m.id);
    if (medIds.length > 0) {
      const { error: logsError } = await supabase.from("medication_logs").delete().in("medication_id", medIds);
      if (logsError) {
        console.error("[deletePet] Error eliminando medication_logs:", logsError.message);
        return false;
      }
    }

    const steps = [
      ["treatment_items", "pet_id"],
      ["medications",     "pet_id"],
      ["medical_history", "pet_id"],
      ["vaccines",        "pet_id"],
      ["weight_logs",     "pet_id"],
      ["treatments",      "pet_id"],
      ["pet_shares",      "pet_id"],
      ["tutors",          "pet_id"],
    ];
    for (const [table, col] of steps) {
      const { error } = await supabase.from(table).delete().eq(col, pid);
      if (error) {
        console.error(`[deletePet] Error eliminando ${table}:`, error.message);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    if (tab === "actividad") loadActivity();
  }, [tab, activePetId]);

  useEffect(() => {
    if (treatmentItems.length > 0 && !selectedTreatmentGroupId) {
      setSelectedTreatmentGroupId(treatmentItems[0].treatment_id);
    }
  }, [treatmentItems]);

  const [editingTreatmentItem, setEditingTreatmentItem] = useState(null);
  const [tiForm, setTiForm] = useState({});
  const [tiSaving, setTiSaving] = useState(false);
  const [tiSaved, setTiSaved] = useState(false);

  const ACTIVITY_PAGE_SIZE = 50;
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(true);

  const loadActivity = async (reset = true) => {
    setActivityLoading(true);
    const from = reset ? 0 : activityFeed.length;
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("pet_id", activePetId)
      .order("created_at", { ascending: false })
      .range(from, from + ACTIVITY_PAGE_SIZE - 1);
    const newItems = data || [];
    setActivityFeed(prev => reset ? newItems : [...prev, ...newItems]);
    setActivityHasMore(newItems.length === ACTIVITY_PAGE_SIZE);
    setActivityLoading(false);
  };

  const calcTreatmentProgress = (ti) => {
    if (!ti.start_date || !ti.start_time || !ti.frequency) return null;
    const freqMap = {
      "cada 6 horas": 6, "cada 6h": 6,
      "cada 8 horas": 8, "cada 8h": 8,
      "cada 12 horas": 12, "cada 12h": 12,
      "cada 24 horas": 24, "cada 24h": 24,
      "1 vez al día": 24, "una vez al día": 24,
      "2 veces al día": 12, "dos veces al día": 12,
      "3 veces al día": 8, "tres veces al día": 8,
    };
    const freqKey = Object.keys(freqMap).find(k => ti.frequency.toLowerCase().includes(k));
    const intervalHours = freqKey ? freqMap[freqKey] : null;
    if (!intervalHours) return null;
    const start = new Date(`${ti.start_date}T${ti.start_time}:00`);
    const now = new Date();
    const totalDays = ti.duration_days || 0;
    const totalDoses = Math.round((totalDays * 24) / intervalHours);
    const elapsedHours = Math.max(0, (now - start) / 3600000);
    const dosesDone = Math.min(totalDoses, Math.floor(elapsedHours / intervalHours));
    const dosesLeft = Math.max(0, totalDoses - dosesDone);
    const daysDone = Math.floor(dosesDone * intervalHours / 24);
    const daysLeft = Math.max(0, totalDays - daysDone);
    const nextDoseTime = new Date(start.getTime() + (dosesDone + 1) * intervalHours * 3600000);
    const isToday = nextDoseTime.toDateString() === now.toDateString();
    const isTomorrow = nextDoseTime.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    const timeStr = nextDoseTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const nextLabel = dosesDone >= totalDoses ? "Tratamiento finalizado" :
      isToday ? `Hoy a las ${timeStr}` :
      isTomorrow ? `Mañana a las ${timeStr}` :
      nextDoseTime.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }) + ` a las ${timeStr}`;
    const progress = totalDoses > 0 ? Math.round((dosesDone / totalDoses) * 100) : 0;
    const [h] = ti.start_time.split(":").map(Number);
    const momento = h >= 6 && h < 12 ? "mañana" : h >= 12 && h < 15 ? "mediodia" : h >= 15 && h < 19 ? "tarde" : "noche";
    return { intervalHours, totalDoses, dosesDone, dosesLeft, daysDone, daysLeft, totalDays, progress, nextLabel, momento };
  };

  const getMomentoActual = () => {
    const now = new Date();
    const h = now.getHours(); // hora local del browser, no UTC
    if (h >= 6 && h < 12) return "mañana";
    if (h >= 12 && h < 15) return "mediodia";
    if (h >= 15 && h < 19) return "tarde";
    return "noche";
  };

  const saveTreatmentItem = async () => {
    if (!editingTreatmentItem) return;
    setTiSaving(true);
    const startTime = `${tiForm.start_hour.toString().padStart(2, "0")}:${tiForm.start_min}`;
    await supabase.from("treatment_items").update({
      name: tiForm.name, prescribed_dose: tiForm.prescribed_dose, frequency: tiForm.frequency,
      duration_days: tiForm.duration_days ? parseInt(tiForm.duration_days) : null,
      start_date: tiForm.start_date, start_time: startTime,
      mg_per_unit: tiForm.mg_per_unit ? parseFloat(tiForm.mg_per_unit) : null,
      units_per_box: tiForm.units_per_box ? parseInt(tiForm.units_per_box) : null,
    }).eq("id", editingTreatmentItem.id);
    await logActivity(supabase, petData.id, "Editó tratamiento", tiForm.name);
    setTiSaving(false); setTiSaved(true);
    await loadTreatmentItems();
    setTimeout(() => { setEditingTreatmentItem(null); setTiSaved(false); setTiForm({}); }, 800);
  };

  const reloadMeds = async () => {
    const { data } = await supabase.from('medications').select('*').eq('pet_id', petData.id).order('created_at', { ascending: false });
    setMeds(data || []);
  };

  const openMedModal = (med = null) => {
    if (med) {
      const isCustom = !FREQUENCIES.includes(med.frequency);
      setMedForm({ name: med.name||'', dose: med.dose||'', frequency: isCustom?'__custom__':(med.frequency||''), frequency_custom: isCustom?(med.frequency||''):'', stock: med.stock?.toString()||'', unit: med.unit||'comp.', color: med.color||'#FF6B35', in_ayunas: med.in_ayunas||false, mg_per_unit:'', prescribed_dose:'' });
      setCustomFreq(isCustom);
      setEditingMedId(med.id);
    } else {
      setMedForm(emptyMedForm);
      setEditingMedId(null);
      setCustomFreq(false);
    }
    setMedSaved(false);
    setShowMedModal(true);
  };

  const closeMedModal = () => { setShowMedModal(false); setEditingMedId(null); setMedSaved(false); };

  const handleMedSave = async () => {
    if (!medForm.name) return;
    setMedSaving(true);
    const freq = medForm.frequency === '__custom__' ? medForm.frequency_custom : medForm.frequency;
    const payload = { pet_id: petData.id, name: medForm.name, dose: medForm.dose||null, frequency: freq||null, stock: medForm.stock ? parseFloat(medForm.stock) : null, unit: medForm.unit, color: medForm.color, active: true };
    if (editingMedId) {
      await supabase.from('medications').update(payload).eq('id', editingMedId);
      await logActivity(supabase, petData.id, "Editó medicamento", medForm.name);
    } else {
      await supabase.from('medications').insert(payload);
      await logActivity(supabase, petData.id, "Agregó medicamento", medForm.name);
    }
    setMedSaving(false); setMedSaved(true);
    await reloadMeds();
    setTimeout(() => closeMedModal(), 800);
  };

  const setMedActive = async (id, active) => {
    const med = meds.find(m => m.id === id);
    await supabase.from('medications').update({ active }).eq('id', id);
    await logActivity(supabase, petData.id, active ? "Reactivó medicamento" : "Desactivó medicamento", med?.name);
    await reloadMeds();
  };

  const searchClinics = async (q) => {
    setClinicQuery(q);
    setHistForm(f => ({ ...f, vet_clinic: q }));
    if (q.length < 2) { setClinicSuggestions([]); return; }
    setClinicSearching(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setClinicSuggestions(data.results || []);
    } catch { setClinicSuggestions([]); }
    setClinicSearching(false);
  };

  const reloadHistory = async () => {
    const { data } = await supabase.from("medical_history").select("*").eq("pet_id", petData.id).order("event_date", { ascending: false });
    setHistoryData(data || []);
  };

  useEffect(() => {
    if (histForm.type === "vaccine" && histForm.event_date) {
      const d = new Date(histForm.event_date);
      d.setFullYear(d.getFullYear() + 1);
      setHistForm(f => ({ ...f, vaccine_next_date: d.toISOString().split("T")[0] }));
    }
  }, [histForm.event_date, histForm.type]);

  const openHistModal = (item = null) => {
    if (item) {
      const isVaccine = item.type === "vaccine";
      setHistForm({ type: item.type || "exam", event: isVaccine ? "" : (item.event || ""), event_date: item.event_date || "", vet_name: item.vet_name || "", vet_clinic: item.vet_clinic || "", notes: item.notes || "", vaccine_name: isVaccine ? (item.event || "") : "", vaccine_next_date: isVaccine ? (item.next_date || "") : "", event_time: item.event_time || "", intensity: item.intensity || "", duration_minutes: item.duration_minutes || "", photo: null, photoPreview: item.photo_url || null, is_public: item.is_public || false });
      setClinicQuery(item.vet_clinic || "");
      setEditingHistId(item.id);
    } else {
      setHistForm({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "", vaccine_name: "", vaccine_next_date: "" });
      setClinicQuery("");
      setEditingHistId(null);
    }
    setHistErrors({});
    setHistSaved(false);
    setShowHistModal(true);
  };

  const handleHistSave = async () => {
    const errors = {};
    if (histForm.type === "vaccine") {
      if (!histForm.vaccine_name.trim()) errors.vaccine_name = true;
    } else {
      if (!histForm.event.trim()) errors.event = true;
    }
    if (!histForm.event_date) errors.event_date = true;
    if (Object.keys(errors).length > 0) { setHistErrors(errors); return; }
    setHistErrors({});
    setHistSaving(true);
    let photoUrl = histForm.photoPreview && !histForm.photo ? histForm.photoPreview : null;
    if (histForm.photo) {
      const path = `events/${petData.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("pet-photos").upload(path, histForm.photo, { contentType: "image/jpeg" });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }
    }
    const payload = { type: histForm.type, event: histForm.type === "vaccine" ? histForm.vaccine_name : histForm.event, event_date: histForm.event_date, vet_name: histForm.vet_name || null, vet_clinic: histForm.vet_clinic || null, notes: histForm.notes || null, next_date: histForm.type === "vaccine" ? (histForm.vaccine_next_date || null) : null, event_time: histForm.event_time || null, intensity: histForm.intensity || null, duration_minutes: histForm.duration_minutes ? parseInt(histForm.duration_minutes) : null, photo_url: photoUrl, is_public: histForm.is_public };
    if (editingHistId) {
      await supabase.from("medical_history").update(payload).eq("id", editingHistId);
      await logActivity(supabase, petData.id, "Editó evento", payload.event || TYPE_STYLES[histForm.type]?.label);
    } else {
      await supabase.from("medical_history").insert({ pet_id: petData.id, ...payload });
      if (histForm.type === "vaccine") {
        await logActivity(supabase, petData.id, "Registró vacuna", histForm.vaccine_name);
      } else {
        await logActivity(supabase, petData.id, "Registró evento médico", TYPE_STYLES[histForm.type]?.label);
      }
    }
    setHistSaving(false); setHistSaved(true);
    await reloadHistory();
    setTimeout(() => {
      setShowHistModal(false); setHistSaved(false); setHistErrors({}); setEditingHistId(null);
      setHistForm({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "", vaccine_name: "", vaccine_next_date: "", event_time: "", intensity: "", duration_minutes: "", photo: null, photoPreview: null, is_public: false });
      setClinicQuery(""); setClinicSuggestions([]);
    }, 800);
  };

  // Dose calculation (local only)
  const mgPerUnit = parseFloat(medForm.mg_per_unit);
  const prescribedDose = parseFloat(medForm.prescribed_dose);
  const unitsPerDose = mgPerUnit > 0 && prescribedDose > 0 ? +(prescribedDose / mgPerUnit).toFixed(2) : null;
  const freqKey = medForm.frequency === '__custom__' ? medForm.frequency_custom : medForm.frequency;
  const dosesPerDay = FREQ_DOSES_PER_DAY[freqKey] || null;
  const stockVal = parseFloat(medForm.stock);
  const stockDays = unitsPerDose && dosesPerDay && stockVal > 0 ? Math.floor(stockVal / (unitsPerDose * dosesPerDay)) : null;

  // Allergy check
  const allergyAlert = petData.allergies?.length > 0 && medForm.name &&
    petData.allergies.some(a => a.toLowerCase() === medForm.name.toLowerCase());

  const speciesIcon = petData.species === "cat" ? "🐱" : petData.species === "other" ? "🐰" : "🐶";
  const sexSymbol = petData.sex === 'male' ? ' ♂' : petData.sex === 'female' ? ' ♀' : '';

  const getPetAvatar = (species, breed, photoUrl) => {
    if (photoUrl) return null;
    if (species === "cat") return "🐱";
    if (species === "dog") return "🐶";
    const breedEmojis = {
      "conejo enano": "🐰", "hámster sirio": "🐹", "cobaya": "🐹",
      "chinchilla": "🐭", "hurón": "🦡", "tortuga": "🐢",
      "loro": "🦜", "canario": "🐦", "periquito": "🐦", "iguana": "🦎",
    };
    return breedEmojis[breed?.toLowerCase().trim()] || "🐾";
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

  const vaccineStatus = (nextDate) => {
    if (!nextDate) return { cls: "warn", label: "Sin fecha" };
    const days = Math.ceil((new Date(nextDate) - new Date()) / 86400000);
    if (days < 0) return { cls: "danger", label: "VENCIDA" };
    if (days < 60) return { cls: "warn", label: `${days}d` };
    return { cls: "ok", label: `${days}d` };
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const groupByMonthYear = (events) => {
    const groups = {};
    events.forEach(item => {
      if (!item.event_date) return;
      const [y, m] = item.event_date.split("-");
      const key = `${y}-${m}`;
      const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  };

  const renderTimelineItem = (item) => {
    const s = TYPE_STYLES[item.type] || TYPE_STYLES.other;
    return (
      <div className="timeline-item" key={item.id}>
        <div className="timeline-dot" style={{ background: s.dot }}>{s.icon}</div>
        <div className="timeline-content" style={{ background: s.bg, border: `1px solid ${s.dot}22` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="timeline-type" style={{ color: s.text }}>{s.label} · {formatDate(item.event_date)}</div>
            {!isArchived && (
              <button onClick={() => openHistModal(item)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "#C4845A", padding: "0 0 0 8px" }}>✏️</button>
            )}
          </div>
          <div className="timeline-event">{item.event}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {item.event_time && <span style={{ fontSize: 10, color: "#7A4522", background: "#FFF0EB", borderRadius: 6, padding: "2px 6px" }}>🕐 {item.event_time.slice(0,5)}</span>}
            {item.intensity && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px", background: item.intensity === "grave" ? "#fef2f2" : item.intensity === "moderada" ? "#fff7ed" : "#f0fdf4", color: item.intensity === "grave" ? "#dc2626" : item.intensity === "moderada" ? "#d97706" : "#059669" }}>
              {item.intensity === "grave" ? "🔴" : item.intensity === "moderada" ? "🟡" : "🟢"} {item.intensity}
            </span>}
            {item.duration_minutes && <span style={{ fontSize: 10, color: "#7A4522", background: "#FFF0EB", borderRadius: 6, padding: "2px 6px" }}>⏱ {item.duration_minutes} min</span>}
            {item.is_public && <span style={{ fontSize: 10, color: "#0F6E56", background: "#E8FAF9", borderRadius: 6, padding: "2px 6px" }}>🌐 Público</span>}
          </div>
          {item.photo_url && (
            <img src={item.photo_url} alt="evento" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 120, borderRadius: 8, objectFit: "cover", cursor: "pointer" }}
              onClick={() => window.open(item.photo_url, "_blank")} />
          )}
          {(item.vet_clinic || item.vet_name) && (
            <div style={{ fontSize: 11, color: "#7A4522", marginTop: 4 }}>
              {item.vet_clinic && <span>🏥 {item.vet_clinic}</span>}
              {item.vet_clinic && item.vet_name && <span> · </span>}
              {item.vet_name && <span>{item.vet_name}</span>}
            </div>
          )}
          {item.next_date && (
            <div style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 700, marginTop: 3 }}>💉 Próxima: {formatDate(item.next_date)}</div>
          )}
          {item.notes && <div style={{ fontSize: 11, color: "var(--brown-soft)", marginTop: 4 }}>{item.notes}</div>}
        </div>
      </div>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Sin fecha";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatLogDateTime = (iso) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${d.getFullYear()} ${hh}:${min}`;
  };

  const logDayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(d, today)) return "Hoy";
    if (sameDay(d, yesterday)) return "Ayer";
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  };

  const groupActivityByDay = (items) => {
    const groups = [];
    let lastLabel = null;
    items.forEach(item => {
      const label = logDayLabel(item.created_at);
      if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; }
      groups[groups.length - 1].items.push(item);
    });
    return groups;
  };

  const inputS = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #FFD9C8', background:'#fff', fontFamily:"'Nunito', sans-serif", fontSize:14, color:'#3D1F0A', outline:'none', boxSizing:'border-box' };
  const fLabel = (t) => <div style={{ fontSize:11, fontWeight:700, color:'#7A4522', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{t}</div>;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    :root { --color-primary:#FF6B35;--color-secondary:#2EC4B6;--color-accent:#FFD166;--orange:var(--color-primary);--mint:var(--color-secondary);--yellow:var(--color-accent);--cream:#FFF8F3;--brown:#3D1F0A;--brown-light:#C4845A;--brown-soft:#8A5530;--brown-pale:#F5E6DA;--red:#FF4757;--green:#06D6A0;--card-shadow:0 4px 24px rgba(61,31,10,0.08); }
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;background:var(--cream);color:var(--brown);}
    .app{max-width:900px;margin:0 auto;min-height:100vh;}
    .header{border-radius:0 0 24px 24px;}
    .content{display:grid;grid-template-columns:1fr;gap:0;}
    @media(min-width:640px){.content{grid-template-columns:1fr 1fr;gap:20px;padding:24px;}.tabs{max-width:420px;}}
    @media(max-width:639px){.app{max-width:420px;}.header{border-radius:0;}}
    .header{background:linear-gradient(160deg,var(--color-primary) 0%,var(--color-primary) 100%);padding:20px 20px 0;position:relative;overflow:hidden;}
    .brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
    .brand-left{display:flex;align-items:center;gap:10px;}
    .brand-logo{width:38px;height:38px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;}
    .brand-name{font-family:'Baloo 2',cursive;font-size:20px;font-weight:800;color:#fff;}
    .brand-name span{color:var(--yellow);}
    .signout-btn{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:6px 12px;color:#fff;font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;cursor:pointer;}
    .pet-card{display:flex;align-items:center;gap:14px;margin-bottom:20px;max-width:860px;margin-left:auto;margin-right:auto;}
    .brand{max-width:860px;margin-left:auto;margin-right:auto;}
    .conditions-row{max-width:860px;margin-left:auto;margin-right:auto;}
    .pet-avatar{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,var(--color-accent),var(--color-primary));display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 6px 20px rgba(0,0,0,0.2),0 0 0 3px rgba(255,255,255,0.3);flex-shrink:0;}
    .pet-name{font-family:'Baloo 2',cursive;font-size:26px;font-weight:800;color:#fff;line-height:1;margin-bottom:3px;}
    .pet-breed{font-size:12px;color:rgba(255,255,255,0.8);font-style:italic;}
    .today-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:14px;padding:8px 14px;text-align:center;flex-shrink:0;}
    .today-num{font-family:'Baloo 2',cursive;font-size:22px;font-weight:800;color:#fff;line-height:1;}
    .today-label{font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px;}
    .conditions-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
    .condition-pill{background:rgba(255,255,255,0.18);color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(255,255,255,0.25);}
    .tabs{display:flex;}
    .tab{flex:1;padding:8px 4px;background:transparent;border:none;color:rgba(255,255,255,0.85);font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;cursor:pointer;text-align:center;border-radius:10px 10px 0 0;}
    .tab.active{background:var(--cream);color:var(--orange);}
    .tab-icon{display:block;font-size:16px;margin-bottom:2px;}
    .content{padding:20px 16px;}
    .card{background:#fff;border-radius:18px;padding:18px;margin-bottom:16px;box-shadow:var(--card-shadow);}
    .card-title{font-family:'Baloo 2',cursive;font-size:13px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;}
    .row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--brown-pale);font-size:13px;}
    .row:last-child{border-bottom:none;}
    .row-label{color:var(--brown-soft);font-size:12px;}
    .row-value{font-weight:700;text-align:right;max-width:60%;font-size:13px;}
    .vaccine-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--brown-pale);}
    .vaccine-row:last-child{border-bottom:none;}
    .vaccine-name{font-weight:700;font-size:14px;}
    .vaccine-date{font-size:11px;color:var(--brown-soft);margin-top:2px;}
    .badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;}
    .badge-ok{background:#e8faf4;color:#059669;}
    .badge-warn{background:#fff7ed;color:#d97706;}
    .badge-danger{background:#fef2f2;color:#dc2626;}
    .empty-state{text-align:center;padding:32px 16px;color:var(--brown-soft);font-size:13px;}
    .empty-icon{font-size:40px;margin-bottom:8px;}
    .add-btn{width:100%;padding:13px;border-radius:13px;background:var(--orange);color:#fff;border:none;font-family:'Baloo 2',cursive;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}
    .timeline{position:relative;padding-left:36px;}
    .timeline::before{content:'';position:absolute;left:14px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--orange),var(--mint));border-radius:2px;}
    .timeline-item{position:relative;margin-bottom:18px;}
    .timeline-dot{position:absolute;left:-28px;top:6px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 0 3px var(--cream);}
    .timeline-content{border-radius:14px;padding:10px 14px;}
    .timeline-type{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
    .timeline-event{font-size:13px;font-weight:600;}
    .fade-up{animation:fadeUp 0.35s ease both;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
  `;

  if (trialExpired) {
    return <Paywall lastPetSnapshot={lastPetSnapshot} />;
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="brand">
            <div className="brand-left">
              <div className="brand-logo">🐾</div>
              <div className="brand-name">Firus<span>&</span>Michis</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => router.push("/marketplace")}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "5px 10px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                💊 Market
              </button>
              {allPetsData.length > 1 && (
                <button onClick={() => router.push("/dashboard/overview")}
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "5px 10px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  ⊞ General
                </button>
              )}
              <button onClick={() => setShowThemeSelector(true)}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "5px 10px", color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                🎨
              </button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 2 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{user.email}</div>
                <span style={{
                  background: userPlan === "free" ? "rgba(255,255,255,0.12)" : "var(--color-accent)",
                  color: userPlan === "free" ? "rgba(255,255,255,0.45)" : "#3D1F0A",
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 10,
                  letterSpacing: "0.5px", textTransform: "uppercase", lineHeight: "16px",
                }}>
                  {userPlan === "free" ? "FREE" : diasRestantes !== null ? `⏳ ${userPlan.toUpperCase()}` : userPlan.toUpperCase()}
                </span>
              </div>
              {diasRestantes !== null && (
                <div style={{ fontSize: 10, color: diasRestantes <= 7 ? "#FF4444" : "#FF9500", textAlign: "right", marginBottom: 2 }}>
                  ⏳ {diasRestantes} días de prueba
                </div>
              )}
              {userPlan === "free" && (
                <div style={{ fontSize: 10, color: "rgba(255,209,102,0.8)", textAlign: "right", marginBottom: 2, cursor: "pointer" }}>
                  Pásate a PRO →
                </div>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
                {allPetsData.length} mascota{allPetsData.length !== 1 ? "s" : ""} · última sesión: {new Date(user.last_sign_in_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <button className="signout-btn" onClick={handleSignOut}>Cerrar sesión</button>
            </div>
          </div>

          <div className="pet-card">
            <PetPhotoUpload key={`photo-${activePetId}`} pet={petData} avatarEmoji={getPetAvatar(petData.species, petData.breed, petData.photo_url)} readOnly={isArchived} />
            <div style={{ flex: 1 }}>
              <div className="pet-name">{petData.name}</div>
              <div className="pet-breed">{petData.breed}{sexSymbol} · {calcAge(petData.birth_date)}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {allPetsData.length > 1 && (
                  <button onClick={() => setShowPetSwitcher(true)}
                    style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    🐾 Cambiar ▾
                  </button>
                )}
                {(userPlan !== "free" || allPetsData.filter(p => !p.archived_at).length < 3) ? (
                  <button onClick={() => window.location.href = "/nueva-mascota"}
                    style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    + Mascota
                  </button>
                ) : (
                  <button onClick={() => setShowPetSwitcher(true)}
                    style={{ background: "rgba(255,209,102,0.3)", border: "1px solid rgba(255,209,102,0.5)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "var(--color-accent)", fontWeight: 700, cursor: "pointer" }}>
                    ✦ PRO
                  </button>
                )}
              </div>
            </div>
            <div className="today-badge">
              <div className="today-num">{activeMeds.length}</div>
              <div className="today-label">meds activos</div>
            </div>
          </div>

          {petData.conditions?.length > 0 && (
            <div className="conditions-row">
              {petData.conditions.map(c => <span key={c} className="condition-pill">{c}</span>)}
            </div>
          )}

          <div className="tabs">
            {[
              { id: "ficha", icon: "📋", label: "Ficha" },
              { id: "medicamentos", icon: "💊", label: "Meds" },
              { id: "historial", icon: "📅", label: "Historial" },
              { id: "tutor", icon: "👤", label: "Tutor" },
              { id: "ia", icon: "🤖", label: "IA" },
              { id: "actividad", icon: "📊", label: "Actividad" },
              { id: "mapa", icon: "🗺️", label: "Mapa" },
            ].map(t => (
              <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {showPetSwitcher && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: 20 }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#3D1F0A", marginBottom: 16 }}>🐾 Mis mascotas</div>
              {allPetsData.filter(p => !p.archived_at).map(p => (
                <div key={p.id} onClick={() => switchPet(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, marginBottom: 8, background: p.id === activePetId ? "#FFF0EB" : "#fff", border: `1.5px solid ${p.id === activePetId ? "var(--color-primary)" : "#FFD9C8"}`, cursor: "pointer" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden", flexShrink: 0 }}>
                    {p.photo_url
                      ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : getPetAvatar(p.species, p.breed, p.photo_url)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#C4845A" }}>{p.breed} · {calcAge(p.birth_date)}</div>
                  </div>
                  {p.id === activePetId && <div style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 700 }}>✓ Activa</div>}
                </div>
              ))}

              {allPetsData.some(p => p.archived_at) && (
                <>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 10px" }}>🌈 En Memoria</div>
                  {allPetsData.filter(p => p.archived_at).map(p => (
                    <div key={p.id} onClick={() => switchPet(p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, marginBottom: 8, background: "#F1F5F9", border: `1.5px solid ${p.id === activePetId ? "#94a3b8" : "#E2E8F0"}`, cursor: "pointer", filter: "saturate(0.6)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden", flexShrink: 0 }}>
                        {p.photo_url
                          ? <img src={p.photo_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                          : getPetAvatar(p.species, p.breed, p.photo_url)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#475569" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.breed} · En Memoria</div>
                      </div>
                      {p.id === activePetId && <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>✓ Viendo</div>}
                    </div>
                  ))}
                </>
              )}
              {(userPlan !== "free" || allPetsData.filter(p => !p.archived_at).length < 3) ? (
                <button onClick={() => { setShowPetSwitcher(false); window.location.href = "/nueva-mascota"; }}
                  style={{ width: "100%", padding: 13, borderRadius: 13, background: "var(--color-primary)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  + Agregar nueva mascota
                </button>
              ) : (
                <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 14, marginTop: 8, border: "1.5px solid #FFD0BC", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>✦ Función PRO</div>
                  <div style={{ fontSize: 12, color: "#7A4522", marginBottom: 10 }}>Agrega hasta 3 mascotas con el plan PRO. Próximamente disponible.</div>
                </div>
              )}
              <button onClick={() => setShowPetSwitcher(false)}
                style={{ width: "100%", padding: 11, borderRadius: 13, background: "#fff", color: "var(--color-primary)", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        {switchingPet && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(255,248,243,0.9)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>Cargando mascota...</div>
            </div>
          </div>
        )}

        {showActivatedToast && (
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1500, background: "#059669", color: "#fff", padding: "12px 22px", borderRadius: 14, fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 24px rgba(5,150,105,0.35)" }}>
            ✓ ¡Plan activado! Bienvenido a {userPlan.toUpperCase()}
          </div>
        )}

        {showTrialBanner && showBanner && (
          <div style={{ margin: "12px 14px 0", background: "#FFF9E6", border: "1.5px solid #FFD166", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#7A5A00" }}>
              ⏳ Tu prueba PRO vence en {diasRestantes} día{diasRestantes !== 1 ? "s" : ""}. Activa tu plan para no perder el acceso.
            </div>
            <button onClick={() => router.push("/pago")} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 10, background: "#FFD166", border: "none", color: "#3D1F0A", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Activar plan →
            </button>
            <button onClick={() => setShowBanner(false)} style={{ flexShrink: 0, background: "none", border: "none", color: "#7A5A00", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>
              ✕
            </button>
          </div>
        )}

        {isArchived && (
          <div style={{ margin: "12px 14px 0", background: "linear-gradient(135deg,#e2e8f0,#cbd5e1)", border: "1.5px solid #94a3b8", borderRadius: 14, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
              🌈 {petData.name} está En Memoria · Solo lectura
            </div>
          </div>
        )}

        {isBirthdayToday && showBirthdayBanner && (
          <div style={{ margin: "12px 14px 0", background: "linear-gradient(135deg,var(--color-primary),var(--color-secondary))", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>🎂🎉</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#fff" }}>
              ¡Feliz cumpleaños, {petData.name}! Hoy cumple {ageYears} año{ageYears !== 1 ? "s" : ""} 🎂
            </div>
            <button onClick={() => setShowBirthdayBanner(false)} style={{ flexShrink: 0, background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>
              ✕
            </button>
          </div>
        )}

        {showArchiveModal && (
          <ArchivePetModal
            pet={petData}
            onClose={() => setShowArchiveModal(false)}
            onArchived={(fields) => {
              setPetData(p => ({ ...p, ...fields }));
              setAllPetsData(list => list.map(p => p.id === petData.id ? { ...p, ...fields } : p));
              setShowArchiveModal(false);
            }}
          />
        )}

        <div className="content">

          {/* FICHA */}
          {tab === "ficha" && (
            <div className="fade-up">
              <div className="card">
                <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🐶 Datos básicos</span>
                  {!isArchived && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingPet(true)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--color-primary)", fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                      <button onClick={() => setShowQRModal(true)} style={{ background: "#E8FAF9", border: "1.5px solid #9FE1CB", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--color-secondary)", fontWeight: 700, cursor: "pointer" }}>📱 QR</button>
                      <button onClick={() => setShowNotifSettings(true)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--color-primary)", fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>🔔</button>
                      <button onClick={async () => {
                        if (!confirm(`¿Eliminar TODOS los datos de ${petData.name}? Esto incluye medicamentos, historial, vacunas, pesos y tratamientos.`)) return;
                        if (!confirm(`⚠️ Segunda confirmación: Esta acción NO se puede deshacer. ¿Confirmas?`)) return;
                        const pid = petData.id;
                        const ok = await deleteChildTables(pid);
                        if (!ok) { alert("Error al limpiar datos. Revisa la consola."); return; }
                        await logActivity(supabase, pid, "Limpió todos los datos");
                        setMeds([]);
                        setHistoryData([]);
                        setCurrentWeight(null);
                        setTreatmentItems([]);
                        alert("✓ Datos eliminados correctamente");
                      }} style={{ padding: "4px 10px", borderRadius: 8, background: "#fef2f2", border: "1.5px solid #fecaca", fontSize: 11, color: "#dc2626", fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>
                        🗑️ Limpiar datos
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`¿Eliminar a ${petData.name} completamente? Se borrarán TODOS sus datos.`)) return;
                        if (!confirm(`⚠️ Última confirmación: Esta acción NO se puede deshacer. ¿Confirmas?`)) return;
                        const pid = petData.id;
                        const res = await fetch("/api/pets/eliminar", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ petId: pid }),
                        });
                        if (!res.ok) {
                          const { error } = await res.json().catch(() => ({}));
                          console.error("[deletePet] Error:", error);
                          alert("Error al eliminar la mascota. La mascota no fue eliminada.");
                          return;
                        }
                        const remaining = allPetsData.filter(p => p.id !== pid);
                        if (remaining.length === 0) {
                          window.location.href = "/nueva-mascota";
                        } else {
                          setAllPetsData(remaining);
                          await switchPet(remaining[0].id);
                        }
                      }} style={{ padding: "4px 10px", borderRadius: 8, background: "#fef2f2", border: "1.5px solid #fecaca", fontSize: 11, color: "#dc2626", fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>
                        🗑️ Eliminar mascota
                      </button>
                      <button onClick={() => setShowArchiveModal(true)} style={{ padding: "4px 10px", borderRadius: 8, background: "#F1F5F9", border: "1.5px solid #CBD5E1", fontSize: 11, color: "#475569", fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>
                        🌈 Archivar (En Memoria)
                      </button>
                    </div>
                  )}
                </div>
                {[
                  ["Nombre", petData.name],
                  ["Especie", petData.species === "dog" ? "Perro" : petData.species === "cat" ? "Gato" : "Otro"],
                  ["Raza", petData.breed || "Sin datos"],
                  ["Sexo", petData.sex === 'male' ? '♂️ Macho' : petData.sex === 'female' ? '♀️ Hembra' : 'Sin datos'],
                  ["Edad", calcAge(petData.birth_date)],
                  ["Peso actual", currentWeight ? `${currentWeight} kg` : "Sin datos"],
                  ["Chip", petData.chip_number ? `${petData.chip_number}${petData.chip_registry ? ` · ${petData.chip_registry}` : ""}` : "Sin datos"],
                ].map(([l, v]) => (
                  <div className="row" key={l}>
                    <span className="row-label">{l}</span>
                    <span className="row-value">{v}</span>
                  </div>
                ))}
                {petData.allergies?.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: "1px solid #F5E6DA" }}>
                    <div style={{ fontSize: 11, color: "#C4845A", marginBottom: 6 }}>⚠️ Alergias a medicamentos</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {petData.allergies.map(a => (
                        <span key={a} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DietTimeline key={`diet-${activePetId}`} pet={petData} isArchived={isArchived} />
              <WeightChart key={`weight-${activePetId}`} pet={petData} onWeightUpdate={(newKg) => setCurrentWeight(newKg)} isArchived={isArchived} />

              <div className="card">
                <div className="card-title">💉 Vacunas</div>
                {(() => {
                  const vaccineEvents = historyData.filter(h => h.type === "vaccine");
                  if (vaccineEvents.length === 0) return (
                    <div className="empty-state">
                      <div className="empty-icon">💉</div>
                      <p>Sin vacunas registradas</p>
                      {!isArchived && (
                        <button onClick={() => { setTab("historial"); setTimeout(() => { setHistForm(f => ({ ...f, type: "vaccine" })); setShowHistModal(true); }, 50); }} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 10, background: "var(--color-primary)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Registrar vacuna</button>
                      )}
                    </div>
                  );
                  return vaccineEvents.map(v => {
                    const { cls, label } = vaccineStatus(v.next_date);
                    return (
                      <div className="vaccine-row" key={v.id}>
                        <div>
                          <div className="vaccine-name">{v.event}</div>
                          <div className="vaccine-date">Aplicada: {formatDate(v.event_date)}</div>
                          {v.next_date && <div className="vaccine-date">Próx: {formatDate(v.next_date)}</div>}
                        </div>
                        <div className={`badge badge-${cls}`}>{label}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* MEDICAMENTOS */}
          {tab === "medicamentos" && (isArchived ? (
            <div className="fade-up">
              <div className="card">
                <div className="card-title">💊 Medicamentos (solo lectura)</div>
                {meds.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">💊</div><p>Sin medicamentos registrados</p></div>
                ) : meds.map(med => (
                  <div className="row" key={med.id}>
                    <span className="row-label">{med.name}{!med.active ? " (inactivo)" : ""}</span>
                    <span className="row-value">{[med.dose, med.frequency].filter(Boolean).join(" · ") || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fade-up">
              {/* Selector de vista */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[{ id: "todos", label: "🔀 Todos" }, { id: "tratamiento", label: "💊 Tratamiento" }, { id: "habituales", label: "📋 Habituales" }].map(v => (
                  <div key={v.id} onClick={() => setMedsView(v.id)}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 12, border: `1.5px solid ${medsView === v.id ? "var(--color-primary)" : "#FFD9C8"}`, background: medsView === v.id ? "#FFF0EB" : "#fff", textAlign: "center", fontSize: 11, fontWeight: 700, color: medsView === v.id ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                    {v.label}
                  </div>
                ))}
              </div>

              {/* VISTA: TODOS */}
              {medsView === "todos" && (
                <>
                  {treatmentItems.length === 0 && activeMeds.length === 0 ? (
                    <div className="card">
                      <div className="empty-state"><div className="empty-icon">💊</div><p>Sin medicamentos activos</p></div>
                      <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                    </div>
                  ) : (
                    <>
                      {treatmentItems.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>En tratamiento activo</div>
                          {treatmentItems.map(ti => {
                            const daysLeft = ti.duration_days && ti.start_date
                              ? Math.ceil((new Date(ti.start_date).getTime() + ti.duration_days * 86400000 - Date.now()) / 86400000)
                              : null;
                            return (
                              <div key={ti.id} style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", marginBottom: 10, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden", display: "flex" }}>
                                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: "#8B5CF6", borderRadius: "16px 0 0 16px" }} />
                                <div style={{ paddingLeft: 14, flex: 1 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{ti.name}</div>
                                    {daysLeft !== null && (
                                      <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: daysLeft < 3 ? "#fef2f2" : daysLeft < 7 ? "#fff7ed" : "#f0fdf4", color: daysLeft < 3 ? "#dc2626" : daysLeft < 7 ? "#d97706" : "#059669" }}>
                                        {daysLeft > 0 ? `${daysLeft}d` : "Fin"}
                                      </div>
                                    )}
                                  </div>
                                  {ti.prescribed_dose && <div style={{ fontSize: 12, color: "#C4845A", marginTop: 2 }}>💊 {ti.prescribed_dose}</div>}
                                  {ti.frequency && <div style={{ fontSize: 12, color: "#C4845A" }}>🕐 {ti.frequency}</div>}
                                  {ti.start_time && <div style={{ fontSize: 12, color: "#C4845A" }}>⏰ Inicio: {ti.start_time}</div>}
                                  {ti.boxes_needed && <div style={{ fontSize: 12, color: "#7A4522", marginTop: 4 }}>📦 <strong>{ti.boxes_needed} caja{ti.boxes_needed !== 1 ? "s" : ""}</strong> necesarias</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {activeMeds.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {treatmentItems.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Medicamentos habituales</div>}
                          {activeMeds.map(med => (
                            <div key={med.id} style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", marginBottom: 10, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden", display: "flex" }}>
                              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: med.color || "var(--color-primary)", borderRadius: "16px 0 0 16px" }} />
                              <div style={{ paddingLeft: 14, flex: 1 }}>
                                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{med.name}</div>
                                {med.dose && <div style={{ fontSize: 12, color: "#C4845A", marginTop: 2 }}>💊 {med.dose}</div>}
                                {med.frequency && <div style={{ fontSize: 12, color: "#C4845A" }}>🕐 {med.frequency}</div>}
                                {med.stock != null && <div style={{ fontSize: 12, color: "#7A4522", marginTop: 4 }}>📦 Stock: <strong>{med.stock} {med.unit}</strong></div>}
                                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                  <button onClick={() => openMedModal(med)} style={{ padding: "5px 12px", borderRadius: 8, background: "#FFF0EB", color: "var(--color-primary)", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                                  <button onClick={() => setMedActive(med.id, false)} style={{ padding: "5px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Inactivo</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                    </>
                  )}
                  {historyMeds.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Historial</div>
                      <div className="card" style={{ padding: "4px 16px" }}>
                        {historyMeds.map((med, i) => (
                          <div key={med.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < historyMeds.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#7A4522" }}>{med.name}</div>
                              {med.dose && <div style={{ fontSize: 11, color: "#C4845A" }}>{med.dose}{med.frequency ? ` · ${med.frequency}` : ""}</div>}
                            </div>
                            <button onClick={() => setMedActive(med.id, true)} style={{ padding: "4px 10px", borderRadius: 8, background: "#e8faf4", color: "#059669", border: "1px solid #a7f3d0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reactivar</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* VISTA: TRATAMIENTO ACTIVO */}
              {medsView === "tratamiento" && (
                <>
                  {treatmentItems.length === 0 ? (
                    <div className="card">
                      <div className="empty-state">
                        <div className="empty-icon">💊</div>
                        <p>Sin tratamientos activos</p>
                        <p style={{ fontSize: 11, marginTop: 4 }}>Sube una receta en el tab IA para comenzar</p>
                      </div>
                    </div>
                  ) : (() => {
                    const uniqueTreatments = treatmentItems.reduce((acc, ti) => {
                      if (!acc.find(t => t.treatment_id === ti.treatment_id)) {
                        acc.push({ treatment_id: ti.treatment_id, diagnostico: ti.treatments?.diagnostico, vet_clinic: ti.treatments?.vet_clinic, emission_date: ti.treatments?.emission_date, recipe_date: ti.treatments?.recipe_date, items: treatmentItems.filter(x => x.treatment_id === ti.treatment_id) });
                      }
                      return acc;
                    }, []);
                    const filteredTreatmentItems = selectedTreatmentGroupId
                      ? treatmentItems.filter(ti => ti.treatment_id === selectedTreatmentGroupId)
                      : treatmentItems;
                    const momentos = [
                      { id: "mañana", icon: "🌅", label: "Mañana", range: "06:00 – 11:59" },
                      { id: "mediodia", icon: "☀️", label: "Mediodía", range: "12:00 – 14:59" },
                      { id: "tarde", icon: "🌆", label: "Tarde", range: "15:00 – 18:59" },
                      { id: "noche", icon: "🌙", label: "Noche", range: "19:00 – 23:30" },
                    ];
                    const momentoActual = getMomentoActual();
                    return (
                      <>
                        {uniqueTreatments.length > 1 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                            {uniqueTreatments.map(t => {
                              const label = t.diagnostico || (t.emission_date ? new Date(t.emission_date + "T12:00:00").toLocaleDateString("es-CL") : new Date((t.recipe_date || Date.now()) + "T12:00:00").toLocaleDateString("es-CL"));
                              const meds = t.items.slice(0, 2).map(i => i.name).join(", ");
                              const isSelected = selectedTreatmentGroupId === t.treatment_id;
                              return (
                                <div key={t.treatment_id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px 6px 12px", borderRadius: 20, border: `1.5px solid ${isSelected ? "#8B5CF6" : "#C4B5FD"}`, background: isSelected ? "#f5f3ff" : "#fff", cursor: "pointer" }}
                                  onClick={() => setSelectedTreatmentGroupId(t.treatment_id)}>
                                  <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#7c3aed" : "#7A4522" }}>
                                    {label}
                                    {meds && <span style={{ color: "#C4845A", fontSize: 10 }}> ({meds}{t.items.length > 2 ? "..." : ""})</span>}
                                  </span>
                                  <button onClick={e => { e.stopPropagation(); deleteTreatmentGroup(t.treatment_id); }}
                                    title="Eliminar este tratamiento"
                                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 12, color: "#C4B5FD", lineHeight: 1 }}>
                                    🗑️
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(() => {
                          const cur = uniqueTreatments.find(t => t.treatment_id === selectedTreatmentGroupId) || uniqueTreatments[0];
                          if (!cur) return null;
                          const info = [cur.diagnostico, cur.vet_clinic].filter(Boolean).join(" · ") || "Tratamiento activo";
                          return (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700 }}>{info}</div>
                              {uniqueTreatments.length === 1 && (
                                <button onClick={() => deleteTreatmentGroup(cur.treatment_id)}
                                  title="Eliminar este tratamiento"
                                  style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#C4845A", padding: "2px 4px" }}>
                                  🗑️
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        {filteredTreatmentItems.some(ti => ti.boxes_needed) && (
                          <div style={{ background: "#E8FAF9", borderRadius: 14, border: "1.5px solid #2EC4B6", padding: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🛒 Recomendación de compra</div>
                            {filteredTreatmentItems.filter(ti => ti.boxes_needed).map(ti => (
                              <div key={ti.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #9FE1CB" }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#3D1F0A" }}>{ti.name}</div>
                                  {ti.units_per_box && <div style={{ fontSize: 10, color: "#C4845A" }}>{ti.units_per_box} unidades por caja</div>}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F6E56" }}>{ti.boxes_needed} caja{ti.boxes_needed !== 1 ? "s" : ""}</div>
                                  {ti.units_remaining > 0 && <div style={{ fontSize: 10, color: "#C4845A" }}>sobran {ti.units_remaining} unidades</div>}
                                </div>
                              </div>
                            ))}
                            <div style={{ marginTop: 8, fontSize: 10, color: "#C4845A", fontStyle: "italic" }}>🔜 Envío por WhatsApp/correo próximamente</div>
                          </div>
                        )}
                        {momentos.map(momento => {
                          const items = filteredTreatmentItems.filter(ti => calcTreatmentProgress(ti)?.momento === momento.id);
                          if (items.length === 0) return null;
                          const isNow = momento.id === momentoActual;
                          const isExpanded = momentosExpanded[momento.id] !== undefined ? momentosExpanded[momento.id] : isNow;
                          return (
                            <div key={momento.id} style={{ marginBottom: 16 }}>
                              <div onClick={() => setMomentosExpanded(p => ({ ...p, [momento.id]: !isExpanded }))}
                                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isExpanded ? 10 : 0, padding: "10px 14px", borderRadius: 12, background: isNow ? "#FFF0EB" : "#fff", border: `1.5px solid ${isNow ? "#FFD0BC" : "#FFD9C8"}`, cursor: "pointer" }}>
                                <div style={{ fontSize: 18 }}>{momento.icon}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: isNow ? "var(--color-primary)" : "#7A4522" }}>{momento.label}</div>
                                  <div style={{ fontSize: 10, color: "#C4845A" }}>{momento.range} · {items.length} medicamento{items.length !== 1 ? "s" : ""}</div>
                                </div>
                                {isNow && <div style={{ background: "var(--color-primary)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Ahora</div>}
                                <div style={{ fontSize: 12, color: "#C4845A" }}>{isExpanded ? "▲" : "▼"}</div>
                              </div>
                              {isExpanded && items.map(ti => {
                                const prog = calcTreatmentProgress(ti);
                                return (
                                  <div key={ti.id} style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden" }}>
                                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: "#8B5CF6", borderRadius: "18px 0 0 18px" }} />
                                    <div style={{ paddingLeft: 10 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" }}>{ti.name}</div>
                                        <button onClick={() => {
                                          const [h, m] = (ti.start_time || "20:00").split(":").map(Number);
                                          setTiForm({ name: ti.name||"", prescribed_dose: ti.prescribed_dose||"", frequency: ti.frequency||"", duration_days: ti.duration_days||"", start_date: ti.start_date||new Date().toISOString().split("T")[0], start_hour: h||20, start_min: m===30?"30":"00", mg_per_unit: ti.mg_per_unit||"", units_per_box: ti.units_per_box||"" });
                                          setEditingTreatmentItem(ti); setTiSaved(false);
                                        }} style={{ background: "#FFF0EB", border: "1px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "var(--color-primary)", fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                                      </div>
                                      {ti.treatments?.diagnostico && <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 700, marginBottom: 4 }}>🩺 {ti.treatments.diagnostico}</div>}
                                      {(ti.treatments?.doctor || ti.treatments?.vet_clinic) && (
                                        <div style={{ fontSize: 10, color: "#C4845A", marginBottom: 6 }}>
                                          {ti.treatments?.doctor && <span>👨‍⚕️ {ti.treatments.doctor}</span>}
                                          {ti.treatments?.doctor && ti.treatments?.vet_clinic && <span> · </span>}
                                          {ti.treatments?.vet_clinic && <span>🏥 {ti.treatments.vet_clinic}</span>}
                                        </div>
                                      )}
                                      {ti.prescribed_dose && <div style={{ fontSize: 12, color: "#C4845A", marginBottom: 2 }}>💊 {ti.prescribed_dose}</div>}
                                      {ti.frequency && <div style={{ fontSize: 12, color: "#C4845A", marginBottom: 2 }}>🕐 {ti.frequency}</div>}
                                      {prog && (
                                        <div style={{ background: prog.daysLeft === 0 ? "#f0fdf4" : "#FFF0EB", borderRadius: 8, padding: "6px 10px", marginTop: 6, marginBottom: 8 }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: prog.daysLeft === 0 ? "#059669" : "var(--color-primary)" }}>
                                            {prog.daysLeft === 0 ? "✓ Tratamiento completado" : `⏰ Próxima toma: ${prog.nextLabel}`}
                                          </div>
                                        </div>
                                      )}
                                      {prog && prog.totalDays > 0 && (
                                        <div>
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#C4845A", marginBottom: 4 }}>
                                            <span>✓ {prog.daysDone} días completados</span>
                                            <span>{prog.daysLeft} días restantes</span>
                                          </div>
                                          <div style={{ height: 8, borderRadius: 4, background: "#f5f3ff", overflow: "hidden", marginBottom: 4 }}>
                                            <div style={{ height: "100%", width: `${prog.progress}%`, background: prog.daysLeft === 0 ? "#059669" : prog.daysLeft < 3 ? "#dc2626" : prog.daysLeft < 7 ? "#d97706" : "#8B5CF6", borderRadius: 4, transition: "width 0.3s" }} />
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#C4845A" }}>
                                            <span>{prog.dosesDone} dosis dadas</span>
                                            <span>{prog.progress}% completado</span>
                                          </div>
                                        </div>
                                      )}
                                      {ti.boxes_needed && <div style={{ fontSize: 12, color: "#7A4522", marginTop: 8 }}>📦 <strong>{ti.boxes_needed} caja{ti.boxes_needed !== 1 ? "s" : ""}</strong> necesarias{ti.units_remaining > 0 ? ` · sobran ${ti.units_remaining} unidades` : ""}</div>}
                                      <div style={{ marginTop: 10 }}>
                                        {dosisMsg[ti.id] && (
                                          <div style={{ background: "#E8FAF9", borderRadius: 8, padding: "6px 12px", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#059669", textAlign: "center" }}>
                                            {dosisMsg[ti.id]}
                                          </div>
                                        )}
                                        <button onClick={async () => {
                                          const upd = ti.units_per_dose || 1;
                                          const med = meds.find(m => m.name.toLowerCase() === ti.name.toLowerCase() && m.active);
                                          if (med && med.stock > 0) {
                                            const newStock = Math.max(0, parseFloat(med.stock) - upd);
                                            await supabase.from("medications").update({ stock: newStock }).eq("id", med.id);
                                            await reloadMeds();
                                            setDosisMsg(p => ({ ...p, [ti.id]: `✓ Dosis marcada · Stock: ${newStock} ${med.unit}` }));
                                          } else {
                                            setDosisMsg(p => ({ ...p, [ti.id]: "✓ Dosis marcada" }));
                                          }
                                          await logActivity(supabase, petData.id, "Marcó dosis dada", ti.name);
                                          setTimeout(() => setDosisMsg(p => ({ ...p, [ti.id]: null })), 3000);
                                        }} style={{ width: "100%", padding: "8px", borderRadius: 10, background: "#E8FAF9", color: "#059669", border: "1.5px solid #9FE1CB", fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                          ✓ Marcar dosis dada
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </>
              )}

              {/* VISTA: HABITUALES */}
              {medsView === "habituales" && (
                <>
                  {activeMeds.length === 0 ? (
                    <div className="card">
                      <div className="empty-state"><div className="empty-icon">📋</div><p>Sin medicamentos habituales</p></div>
                      <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                    </div>
                  ) : (
                    <>
                      {activeMeds.map(med => (
                        <div key={med.id} style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", marginBottom: 12, boxShadow: "var(--card-shadow)", position: "relative", overflow: "hidden", display: "flex" }}>
                          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: med.color || "var(--color-primary)", borderRadius: "18px 0 0 18px" }} />
                          <div style={{ paddingLeft: 14, flex: 1 }}>
                            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: "#3D1F0A" }}>{med.name}</div>
                            {med.dose && <div style={{ fontSize: 12, color: "#C4845A", marginTop: 2 }}>💊 {med.dose}</div>}
                            {med.frequency && <div style={{ fontSize: 12, color: "#C4845A" }}>🕐 {med.frequency}</div>}
                            {med.stock != null && <div style={{ fontSize: 12, color: "#7A4522", marginTop: 4 }}>📦 Stock: <strong>{med.stock} {med.unit}</strong></div>}
                            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                              <button onClick={() => openMedModal(med)} style={{ padding: "5px 12px", borderRadius: 8, background: "#FFF0EB", color: "var(--color-primary)", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                              <button onClick={() => setMedActive(med.id, false)} style={{ padding: "5px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Marcar inactivo</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button className="add-btn" onClick={() => openMedModal()}>+ Agregar medicamento</button>
                    </>
                  )}
                  {historyMeds.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Historial</div>
                      <div className="card" style={{ padding: "4px 16px" }}>
                        {historyMeds.map((med, i) => (
                          <div key={med.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < historyMeds.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#7A4522" }}>{med.name}</div>
                              {med.dose && <div style={{ fontSize: 11, color: "#C4845A" }}>{med.dose}{med.frequency ? ` · ${med.frequency}` : ""}</div>}
                            </div>
                            <button onClick={() => setMedActive(med.id, true)} style={{ padding: "4px 10px", borderRadius: 8, background: "#e8faf4", color: "#059669", border: "1px solid #a7f3d0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reactivar</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* HISTORIAL MÉDICO */}
          {tab === "historial" && (isArchived ? (
            <div className="fade-up">
              <div className="card">
                <div className="card-title">📅 Historial médico (solo lectura)</div>
                {historyData.length === 0
                  ? <div className="empty-state"><div className="empty-icon">📅</div><p>Sin historial médico registrado</p></div>
                  : <div className="timeline">{historyData.map(item => renderTimelineItem(item))}</div>}
              </div>
            </div>
          ) : (
            <div className="fade-up">
              {/* Pills de filtro */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  { value: "all", icon: "📋", label: "Todos" },
                  { value: "exam", icon: "🧪", label: "Examen" },
                  { value: "illness", icon: "🤒", label: "Enfermedad" },
                  { value: "surgery", icon: "🔪", label: "Cirugía" },
                  { value: "procedure", icon: "⚕️", label: "Procedimiento" },
                  { value: "vaccine", icon: "💉", label: "Vacuna" },
                  { value: "other", icon: "📝", label: "Otro" },
                ].map(f => (
                  <div key={f.value} onClick={() => { setHistFilter(f.value); setHistExpanded(false); }}
                    style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${histFilter === f.value ? "var(--color-primary)" : "#FFD9C8"}`, background: histFilter === f.value ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: 700, color: histFilter === f.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                    {f.icon} {f.label}
                  </div>
                ))}
              </div>

              {historyData.length === 0 ? (
                <div className="card">
                  <div className="empty-state"><div className="empty-icon">📅</div><p>Sin historial médico registrado</p></div>
                  <button className="add-btn" onClick={() => openHistModal()}>+ Agregar evento</button>
                </div>
              ) : (() => {
                const filteredHistory = histFilter === "all" ? historyData : historyData.filter(h => h.type === histFilter);
                const recentEvents = filteredHistory.slice(0, 2);
                const olderEvents = filteredHistory.slice(2);
                const olderGroups = groupByMonthYear(olderEvents);
                return (
                  <>
                    {filteredHistory.length === 0 ? (
                      <div className="card">
                        <div className="empty-state"><div className="empty-icon">🔍</div><p>Sin eventos de este tipo</p></div>
                      </div>
                    ) : (
                      <>
                        <div className="timeline">{recentEvents.map(item => renderTimelineItem(item))}</div>
                        {olderEvents.length > 0 && (
                          <>
                            <button onClick={() => setHistExpanded(p => !p)}
                              style={{ width: "100%", padding: "10px", borderRadius: 12, background: "#FFF0EB", color: "var(--color-primary)", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                              {histExpanded ? "▲ Ocultar anteriores" : `▼ Ver anteriores (${olderEvents.length})`}
                            </button>
                            {histExpanded && olderGroups.map(group => (
                              <div key={group.label}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, marginTop: 4 }}>📅 {group.label}</div>
                                <div className="timeline">{group.items.map(item => renderTimelineItem(item))}</div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                    <button className="add-btn" onClick={() => openHistModal()}>+ Agregar evento</button>
                  </>
                );
              })()}
            </div>
          ))}

          {/* TUTOR */}
          {tab === "tutor" && <TutorTab key={`tutor-${activePetId}`} pet={petData} isArchived={isArchived} />}

          {/* IA */}
          {tab === "ia" && <AITab key={`ia-${activePetId}`} pet={petData} medications={meds} history={historyData} isArchived={isArchived} onTreatmentSaved={() => { setTab("medicamentos"); setMedsView("tratamiento"); loadTreatmentItems(); }} onTreatmentDeleted={() => loadTreatmentItems()} />}

          {/* ACTIVIDAD */}
          {tab === "actividad" && (
            <div className="fade-up">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>Registro de actividad</div>
                <button onClick={() => loadActivity(true)} style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "var(--color-primary)", fontWeight: 700, cursor: "pointer" }}>↻ Actualizar</button>
              </div>
              {activityLoading && activityFeed.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "#C4845A", fontSize: 13 }}>Cargando actividad...</div>
              ) : activityFeed.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <p>Sin actividad registrada aún</p>
                  </div>
                </div>
              ) : (
                <>
                  {groupActivityByDay(activityFeed).map(group => (
                    <div key={group.label} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#C4845A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{group.label}</div>
                      <div className="card" style={{ padding: "4px 16px" }}>
                        {group.items.map((item, i) => (
                          <div key={item.id} style={{ padding: "10px 0", borderBottom: i < group.items.length - 1 ? "1px solid #FFF0EB" : "none" }}>
                            <div style={{ fontSize: 13, color: "#3D1F0A" }}>
                              <span style={{ color: "#C4845A" }}>{formatLogDateTime(item.created_at)}</span>
                              {" · "}
                              <strong>{item.action}</strong>
                              {item.detail ? `: ${item.detail}` : ""}
                              {" · "}
                              <span style={{ color: "#C4845A" }}>{item.user_email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {activityHasMore && (
                    <button onClick={() => loadActivity(false)} disabled={activityLoading}
                      style={{ width: "100%", padding: "10px", borderRadius: 12, background: "#FFF0EB", color: "var(--color-primary)", border: "1.5px solid #FFD0BC", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                      {activityLoading ? "Cargando..." : "▼ Cargar más"}
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: "#C4845A", textAlign: "center", padding: "8px 16px", lineHeight: 1.5 }}>
                    Este registro no puede ser modificado. Para solicitar la eliminación de entradas escribe a{" "}
                    <a href="mailto:contacto@firusymichis.cl" style={{ color: "var(--color-primary)", fontWeight: 700 }}>contacto@firusymichis.cl</a>
                    {" "}justificando la solicitud.
                  </div>
                </>
              )}
            </div>
          )}
          {/* MAPA */}
          {tab === "mapa" && <VetMapTab key={`mapa-${activePetId}`} pet={petData} history={historyData} />}

        </div>
      </div>

      {/* MODAL MEDICAMENTO */}
      {showMedModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg,#FF6B35,#e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {editingMedId ? "✏️ Editar medicamento" : "➕ Nuevo medicamento"}
              </div>
              <button onClick={closeMedModal} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Alerta alergia */}
              {allergyAlert && (
                <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: "#dc2626" }}>ALERTA ALERGIA</div>
                    <div style={{ fontSize: 11, color: "#dc2626" }}>{petData.name} tiene alergia registrada a este medicamento</div>
                  </div>
                </div>
              )}

              {/* Nombre */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Nombre *")}
                <input style={inputS} list="meds-dl" placeholder="Buscar o escribir medicamento..."
                  value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} />
                <datalist id="meds-dl">{MEDS_LIST.map(m => <option key={m} value={m} />)}</datalist>
              </div>

              {/* Dosis */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Dosis")}
                <input style={inputS} placeholder="ej: 0.8 mg, 16 mg, 1 comp."
                  value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} />
              </div>

              {/* Cálculo dosis */}
              <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>🧮 Cálculo de unidades (opcional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    {fLabel("mg por unidad")}
                    <input style={inputS} type="number" placeholder="ej: 200" value={medForm.mg_per_unit}
                      onChange={e => setMedForm(f => ({ ...f, mg_per_unit: e.target.value }))} />
                  </div>
                  <div>
                    {fLabel("Dosis recetada (mg)")}
                    <input style={inputS} type="number" placeholder="ej: 300" value={medForm.prescribed_dose}
                      onChange={e => setMedForm(f => ({ ...f, prescribed_dose: e.target.value }))} />
                  </div>
                </div>
                {unitsPerDose !== null && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#3D1F0A" }}>
                    = <span style={{ color: "var(--color-primary)" }}>{unitsPerDose} {medForm.unit}</span> por toma
                    {stockDays !== null && <span style={{ color: "#C4845A", fontWeight: 400, fontSize: 11 }}> · La caja dura ~{stockDays} días</span>}
                  </div>
                )}
              </div>

              {/* Frecuencia */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Frecuencia")}
                <select style={{ ...inputS, background: "#fff" }} value={medForm.frequency}
                  onChange={e => { const v = e.target.value; setMedForm(f => ({ ...f, frequency: v, frequency_custom: "" })); setCustomFreq(v === "__custom__"); }}>
                  <option value="">Seleccionar...</option>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  <option value="__custom__">Otra (escribir)</option>
                </select>
                {customFreq && (
                  <input style={{ ...inputS, marginTop: 8 }} placeholder="Ej: cada 3 días..."
                    value={medForm.frequency_custom} onChange={e => setMedForm(f => ({ ...f, frequency_custom: e.target.value }))} />
                )}
                {/* En ayunas */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: 13, color: "#7A4522", fontWeight: 600 }}>
                  <input type="checkbox" checked={medForm.in_ayunas}
                    onChange={e => setMedForm(f => ({ ...f, in_ayunas: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }} />
                  Administrar en ayunas
                </label>
              </div>

              {/* Stock */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Stock")}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input style={{ ...inputS, width: 100, flexShrink: 0 }} type="number" min="0" placeholder="Cant."
                    value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {UNITS.map(u => (
                      <button key={u} onClick={() => setMedForm(f => ({ ...f, unit: u }))}
                        style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${medForm.unit === u ? "var(--color-primary)" : "#FFD9C8"}`, background: medForm.unit === u ? "#FFF0EB" : "#fff", color: medForm.unit === u ? "var(--color-primary)" : "#7A4522", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div style={{ marginBottom: 16 }}>
                {fLabel("Color de acento")}
                <div style={{ display: "flex", gap: 10 }}>
                  {COLORS.map(c => (
                    <div key={c.value} onClick={() => setMedForm(f => ({ ...f, color: c.value }))}
                      style={{ width: 30, height: 30, borderRadius: "50%", background: c.value, cursor: "pointer", border: medForm.color === c.value ? "3px solid #3D1F0A" : "3px solid transparent", outline: medForm.color === c.value ? "2px solid #fff" : "none", outlineOffset: -4 }} />
                  ))}
                </div>
              </div>

              <button onClick={handleMedSave} disabled={medSaving || !medForm.name}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: medSaved ? "var(--color-secondary)" : "var(--color-primary)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {medSaved ? "✓ Guardado" : medSaving ? "Guardando..." : editingMedId ? "✓ Actualizar" : "✓ Guardar medicamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL MÉDICO */}
      {showHistModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg,#FF6B35,#e85d2e)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>{editingHistId ? "✏️ Editar evento médico" : "📅 Nuevo evento médico"}</div>
              <button onClick={() => { setShowHistModal(false); setHistErrors({}); setEditingHistId(null); setHistForm({ type: "exam", event: "", event_date: "", vet_name: "", vet_clinic: "", notes: "", vaccine_name: "", vaccine_next_date: "", event_time: "", intensity: "", duration_minutes: "", photo: null, photoPreview: null, is_public: false }); setClinicQuery(""); setClinicSuggestions([]); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Tipo */}
              <div style={{ marginBottom: 12 }}>
                {fLabel("Tipo de evento")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 2 }}>
                  {[{ value:"exam",icon:"🧪",label:"Examen"},{value:"illness",icon:"🤒",label:"Enfermedad"},{value:"surgery",icon:"🔪",label:"Cirugía"},{value:"procedure",icon:"⚕️",label:"Procedimiento"},{value:"vaccine",icon:"💉",label:"Vacuna"},{value:"other",icon:"📝",label:"Otro"}].map(t => (
                    <div key={t.value} onClick={() => setHistForm(f => ({ ...f, type: t.value }))}
                      style={{ padding: "7px 13px", borderRadius: 20, border: `1.5px solid ${histForm.type === t.value ? "var(--color-primary)" : "#FFD9C8"}`, background: histForm.type === t.value ? "#FFF0EB" : "#fff", fontSize: 12, fontWeight: 700, color: histForm.type === t.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                      {t.icon} {t.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Descripción — solo para no-vacuna */}
              {histForm.type !== "vaccine" && (
                <div style={{ marginBottom: 12 }}>
                  {fLabel("Descripción *")}
                  <input style={{ ...inputS, border: `1.5px solid ${histErrors.event ? "#dc2626" : "#FFD9C8"}` }}
                    placeholder="ej: Control rutinario, Otitis bilateral..."
                    value={histForm.event}
                    onChange={e => { setHistForm(f => ({ ...f, event: e.target.value })); setHistErrors(p => ({ ...p, event: false })); }} />
                  {histErrors.event && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ La descripción es obligatoria</div>}
                </div>
              )}

              {/* Campos vacuna */}
              {histForm.type === "vaccine" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Vacuna</div>
                  <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FFD9C8", padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(petData.species === "cat" ? VACCINES_CAT : petData.species === "other" ? VACCINES_OTHER : VACCINES_DOG).map(v => (
                        <div key={v} onClick={() => setHistForm(f => ({ ...f, vaccine_name: f.vaccine_name === v ? "" : v }))}
                          style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${histForm.vaccine_name === v ? "var(--color-secondary)" : "#FFD9C8"}`, background: histForm.vaccine_name === v ? "#E8FAF9" : "#fff", fontSize: 11, fontWeight: 700, color: histForm.vaccine_name === v ? "#0F6E56" : "#7A4522", cursor: "pointer" }}>
                          {v}
                        </div>
                      ))}
                      <div onClick={() => setHistForm(f => ({ ...f, vaccine_name: "" }))}
                        style={{ padding: "5px 12px", borderRadius: 20, border: "1.5px solid #c4b5fd", background: "#f5f3ff", fontSize: 11, fontWeight: 700, color: "#7c3aed", cursor: "pointer" }}>
                        + Otra
                      </div>
                    </div>
                    <input style={{ marginTop: 8, width: "100%", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${histErrors.vaccine_name ? "#dc2626" : "#FFD9C8"}`, fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#3D1F0A", outline: "none", boxSizing: "border-box" }}
                      placeholder="Nombre de la vacuna..."
                      value={histForm.vaccine_name}
                      onChange={e => { setHistForm(f => ({ ...f, vaccine_name: e.target.value })); setHistErrors(p => ({ ...p, vaccine_name: false })); }} />
                    {histErrors.vaccine_name && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ Selecciona o escribe el nombre de la vacuna</div>}
                  </div>
                  {histForm.vaccine_next_date && (
                    <div style={{ background: "#E8FAF9", borderRadius: 10, padding: "9px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0F6E56" }}>
                        💉 Próxima dosis estimada: {formatDate(histForm.vaccine_next_date)}
                      </div>
                      <div style={{ fontSize: 10, color: "#0F6E56", marginTop: 2 }}>
                        (referencial — confirma con tu veterinario)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fecha */}
              <div style={{ marginBottom: 12 }}>
                {fLabel(histForm.type === "vaccine" ? "Fecha en que se aplicó *" : "Fecha *")}
                <input type="date" style={{ ...inputS, border: `1.5px solid ${histErrors.event_date ? "#dc2626" : "#FFD9C8"}` }}
                  max={new Date().toISOString().split("T")[0]}
                  value={histForm.event_date}
                  onChange={e => { setHistForm(f => ({ ...f, event_date: e.target.value })); setHistErrors(p => ({ ...p, event_date: false })); }} />
                {histErrors.event_date && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>⚠️ La fecha es obligatoria</div>}
              </div>

              {/* Veterinaria */}
              <div style={{ marginBottom: 12, position: "relative" }}>
                {fLabel("Veterinaria")}
                <input style={inputS} placeholder="Buscar clínica veterinaria..."
                  value={clinicQuery} onChange={e => searchClinics(e.target.value)}
                  spellCheck={false} autoCorrect="off" autoCapitalize="off" lang="es" />
                {clinicSearching && <div style={{ fontSize: 11, color: "#C4845A", marginTop: 4 }}>Buscando...</div>}
                {clinicSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #FF6B35", borderRadius: 11, maxHeight: 180, overflowY: "auto", zIndex: 10, boxShadow: "0 4px 16px rgba(61,31,10,0.1)" }}>
                    {clinicSuggestions.map((c, i) => (
                      <div key={i} onClick={() => { setClinicQuery(c.name); setHistForm(f => ({ ...f, vet_clinic: c.name })); setClinicSuggestions([]); }}
                        style={{ padding: "9px 13px", fontSize: 13, cursor: "pointer", color: "#3D1F0A", borderBottom: "1px solid #FFF0EB" }}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "#C4845A" }}>{c.formatted_address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Veterinario — solo para no-vacuna */}
              {histForm.type !== "vaccine" && (
                <div style={{ marginBottom: 12 }}>
                  {fLabel("Veterinario/a")}
                  <input style={inputS} placeholder="Nombre del veterinario/a (opcional)"
                    value={histForm.vet_name} onChange={e => setHistForm(f => ({ ...f, vet_name: e.target.value }))} />
                </div>
              )}
              {/* Notas */}
              <div style={{ marginBottom: 16 }}>
                {fLabel("Notas")}
                <textarea style={{ ...inputS, resize: "vertical", minHeight: 70 }}
                  placeholder="Observaciones, tratamiento indicado, etc. (opcional)"
                  value={histForm.notes} onChange={e => setHistForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Hora del evento — no aplica a vacunas */}
              {histForm.type !== "vaccine" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Hora del evento</div>
                  <input type="time" style={{ ...inputS }} value={histForm.event_time} onChange={e => setHistForm(f => ({ ...f, event_time: e.target.value }))} />
                </div>
              )}

              {/* Intensidad */}
              {(histForm.type === "illness" || histForm.type === "other") && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Intensidad</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ value: "leve", label: "🟢 Leve" }, { value: "moderada", label: "🟡 Moderada" }, { value: "grave", label: "🔴 Grave" }].map(i => (
                      <div key={i.value} onClick={() => setHistForm(f => ({ ...f, intensity: f.intensity === i.value ? "" : i.value }))}
                        style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: `1.5px solid ${histForm.intensity === i.value ? "var(--color-primary)" : "#FFD9C8"}`, background: histForm.intensity === i.value ? "#FFF0EB" : "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, color: histForm.intensity === i.value ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                        {i.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duración — no aplica a vacunas */}
              {histForm.type !== "vaccine" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Duración (minutos)</div>
                  <input style={inputS} type="number" min="1" placeholder="ej: 30" value={histForm.duration_minutes} onChange={e => setHistForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                </div>
              )}

              {/* Foto */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>📸 Foto del evento (opcional)</div>
                <div onClick={() => histPhotoRef.current.click()} style={{ border: "2px dashed #FFD9C8", borderRadius: 12, padding: 16, textAlign: "center", background: "#FFFAF7", cursor: "pointer" }}>
                  {histForm.photoPreview
                    ? <img src={histForm.photoPreview} alt="evento" style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 8, objectFit: "contain" }} />
                    : <><div style={{ fontSize: 28, marginBottom: 4 }}>📷</div><div style={{ fontSize: 12, color: "#C4845A", fontWeight: 700 }}>Toca para subir foto</div></>
                  }
                  <input ref={histPhotoRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={onHistPhotoSelect} />
                </div>
                {histErrors.photo && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{histErrors.photo}</div>}
                {histForm.photoPreview && (
                  <button onClick={() => setHistForm(f => ({ ...f, photo: null, photoPreview: null }))}
                    style={{ marginTop: 6, fontSize: 11, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer" }}>
                    🗑️ Eliminar foto
                  </button>
                )}
              </div>

              {/* Visibilidad */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7A4522", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Visibilidad</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div onClick={() => setHistForm(f => ({ ...f, is_public: false }))}
                    style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1.5px solid ${!histForm.is_public ? "var(--color-primary)" : "#FFD9C8"}`, background: !histForm.is_public ? "#FFF0EB" : "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, color: !histForm.is_public ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>
                    🔒 Privado
                  </div>
                  <div onClick={() => setHistForm(f => ({ ...f, is_public: true }))}
                    style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1.5px solid ${histForm.is_public ? "var(--color-secondary)" : "#FFD9C8"}`, background: histForm.is_public ? "#E8FAF9" : "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, color: histForm.is_public ? "#0F6E56" : "#7A4522", cursor: "pointer" }}>
                    🌐 Público
                  </div>
                </div>
              </div>

              <button onClick={handleHistSave}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: histSaved ? "var(--color-secondary)" : "var(--color-primary)", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {histSaved ? "✓ Guardado" : histSaving ? "Guardando..." : editingHistId ? "✓ Actualizar evento" : "✓ Guardar evento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TREATMENT ITEM */}
      {editingTreatmentItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#FFF8F3", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg,#8B5CF6,#7c3aed)", padding: "16px 20px", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: "#fff" }}>✏️ Editar medicamento</div>
              <button onClick={() => { setEditingTreatmentItem(null); setTiForm({}); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                {fLabel("Medicamento")}
                <input style={inputS} value={tiForm.name || ""} onChange={e => setTiForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                {fLabel("Dosis recetada")}
                <input style={inputS} placeholder="ej: 1 + 1/4 comprimido" value={tiForm.prescribed_dose || ""} onChange={e => setTiForm(f => ({ ...f, prescribed_dose: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                {fLabel("Frecuencia")}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                  {["cada 6 horas", "cada 8 horas", "cada 12 horas", "cada 24 horas"].map(f => (
                    <div key={f} onClick={() => setTiForm(p => ({ ...p, frequency: f }))}
                      style={{ padding: "5px 10px", borderRadius: 8, border: `${tiForm.frequency === f ? "2px solid #8B5CF6" : "1.5px solid #C4B5FD"}`, background: tiForm.frequency === f ? "#f5f3ff" : "#fff", fontSize: 11, fontWeight: tiForm.frequency === f ? 700 : 400, color: tiForm.frequency === f ? "#7c3aed" : "#7A4522", cursor: "pointer" }}>
                      {f.replace("cada ", "")}
                    </div>
                  ))}
                </div>
                <input style={inputS} placeholder="O escribe frecuencia libre..." value={tiForm.frequency || ""} onChange={e => setTiForm(f => ({ ...f, frequency: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                {fLabel("Días de tratamiento")}
                <input style={inputS} type="number" min="1" placeholder="ej: 30" value={tiForm.duration_days || ""} onChange={e => { const v = parseInt(e.target.value); setTiForm(f => ({ ...f, duration_days: v > 0 ? v : "" })); }} />
              </div>
              <div style={{ background: "#FFF0EB", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Inicio del tratamiento</div>
                <div style={{ marginBottom: 8 }}>
                  {fLabel("Fecha")}
                  <input type="date" style={{ ...inputS, background: "#fff" }} value={tiForm.start_date || ""} onChange={e => setTiForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                {fLabel("Hora")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                    <div key={h} onClick={() => setTiForm(f => ({ ...f, start_hour: h }))}
                      style={{ padding: "5px 8px", borderRadius: 7, border: `${tiForm.start_hour === h ? "2px solid #FF6B35" : "1.5px solid #FFD9C8"}`, background: tiForm.start_hour === h ? "#FFF0EB" : "#fff", fontSize: 11, fontWeight: tiForm.start_hour === h ? 700 : 400, color: tiForm.start_hour === h ? "#CC4A1A" : "#7A4522", cursor: "pointer", minWidth: 32, textAlign: "center" }}>
                      {h.toString().padStart(2, "0")}
                    </div>
                  ))}
                </div>
                {fLabel("Minutos")}
                <div style={{ display: "flex", gap: 8 }}>
                  {["00", "30"].map(m => (
                    <div key={m} onClick={() => setTiForm(f => ({ ...f, start_min: m }))}
                      style={{ flex: 1, padding: "8px", borderRadius: 10, border: `${tiForm.start_min === m ? "2px solid #FF6B35" : "1.5px solid #FFD9C8"}`, background: tiForm.start_min === m ? "#FFF0EB" : "#fff", textAlign: "center", fontSize: 14, fontWeight: tiForm.start_min === m ? 700 : 400, color: tiForm.start_min === m ? "#CC4A1A" : "#7A4522", cursor: "pointer" }}>:{m}</div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#f5f3ff", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Datos de la caja</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    {fLabel("mg por unidad")}
                    <input style={{ ...inputS, background: "#fff" }} type="number" placeholder="ej: 75" value={tiForm.mg_per_unit || ""} onChange={e => setTiForm(f => ({ ...f, mg_per_unit: e.target.value }))} />
                  </div>
                  <div>
                    {fLabel("Unidades por caja")}
                    <input style={{ ...inputS, background: "#fff" }} type="number" min="1" placeholder="ej: 30" value={tiForm.units_per_box || ""} onChange={e => setTiForm(f => ({ ...f, units_per_box: e.target.value }))} />
                  </div>
                </div>
              </div>
              <button onClick={saveTreatmentItem} disabled={tiSaving}
                style={{ width: "100%", padding: 13, borderRadius: 13, background: tiSaved ? "var(--color-secondary)" : "#8B5CF6", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                {tiSaved ? "✓ Actualizado" : tiSaving ? "Guardando..." : "✓ Actualizar medicamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRModal && <QRShareModal pet={petData} onClose={() => setShowQRModal(false)} />}

      {showNotifSettings && <NotificationSettings pet={petData} user={user} onClose={() => setShowNotifSettings(false)} />}

      {/* MODAL EDITAR MASCOTA */}
      {showThemeSelector && (
        <ThemeSelector
          initialTheme={initialTheme}
          initialCustomColor={initialCustomColor}
          onClose={() => setShowThemeSelector(false)}
        />
      )}

      {editingPet && (
        <EditPetModal
          pet={petData}
          onClose={() => setEditingPet(false)}
          onSave={async () => {
              const { data } = await supabase.from("pets").select("*").eq("id", petData.id).single();
              if (data) setPetData(data);
              setEditingPet(false);
            }}
        />
      )}
    </>
  );
}
