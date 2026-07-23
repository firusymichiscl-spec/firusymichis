"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLog";

// Mismas opciones que TutorTab.jsx (misma tabla `tutors`, para que el valor
// guardado siga siendo editable/seleccionable ahí después).
const RELATIONSHIPS = ["Dueño", "Familiar", "Veterinario", "Vecino", "Otro"];

const BREEDS_DOG = ['Boyera de Berna','Golden Retriever','Labrador Retriever','Pastor Alemán','Bulldog Francés','Poodle','Beagle','Chihuahua','Yorkshire Terrier','Husky Siberiano','Boxer','Dálmata','Cocker Spaniel','Shih Tzu','Pomerania','Schnauzer','Dóberman','Rottweiler','Maltés','Basset Hound','Border Collie','Samoyedo','Akita','Weimaraner','Shar Pei'];
const BREEDS_CAT = ['Siamés','Persa','Maine Coon','Ragdoll','Bengalí','Abisinio','British Shorthair','Esfinge','Scottish Fold','Angora','Birmano','Noruego del Bosque','Ruso Azul','Somali','Tonkinés'];
const BREEDS_OTHER = ['Conejo enano','Hámster sirio','Cobaya','Chinchilla','Hurón','Tortuga','Loro','Canario','Periquito','Iguana'];
const DIETS = ['Royal Canin Skin Care','Royal Canin Urinary','Royal Canin Renal','Hill\'s Science Diet','Hill\'s Prescription Diet','Purina Pro Plan','Eukanuba','Advance Veterinary Diets','Orijen','Acana','Brit Care','Taste of the Wild','Nutrivet','Equilibrio Veterinary','Natural Choice'];
const CONDITIONS = ['Hipotiroidismo','Dermatitis atópica','Otitis recurrente','Diabetes','Epilepsia','Displasia de cadera','Insuficiencia renal','Problemas cardíacos','Alergias alimentarias','Parásitos','Ansiedad','Artritis','Obesidad','Cáncer','Leishmaniasis'];

const SPECIES_OPTIONS = [
  { value: 'dog', icon: '🐶', label: 'Perro' },
  { value: 'cat', icon: '🐱', label: 'Gato' },
  { value: 'other', icon: '🐰', label: 'Otro' },
];

export default function NuevaMascota() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    species: 'dog', speciesIcon: '🐶', speciesLabel: 'Perro',
    name: '', breed: '', birth_date: '', weight_kg: '',
    sex: '', conditions: [],
  });
  const [breedQuery, setBreedQuery] = useState('');
  const [breedDropdown, setBreedDropdown] = useState(false);

  // FIX 1.2: solo mostrar "Volver al dashboard" si ya tiene alguna mascota.
  const [hasExistingPets, setHasExistingPets] = useState(false);
  // FIX 2: tutor titular obligatorio + autocompletar desde otra mascota.
  const [tutorForm, setTutorForm] = useState({ full_name: '', phone: '', relationship: '' });
  const [tutorError, setTutorError] = useState('');
  const [existingTutor, setExistingTutor] = useState(null); // { full_name, phone, relationship, petName }
  const [useExistingTutor, setUseExistingTutor] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existingPets } = await supabase.from('pets').select('id, name').eq('user_id', user.id);
      if (!existingPets || existingPets.length === 0) return;
      setHasExistingPets(true);

      const petIds = existingPets.map(p => p.id);
      const { data: tutors } = await supabase.from('tutors').select('*').in('pet_id', petIds).eq('type', 'primary').limit(1);
      if (tutors && tutors.length > 0) {
        const t = tutors[0];
        const ownerPet = existingPets.find(p => p.id === t.pet_id);
        setExistingTutor({ full_name: t.full_name, phone: t.phone, relationship: t.relationship, petName: ownerPet?.name || 'otra mascota' });
      }
    })();
  }, []);

  const breeds = form.species === 'cat' ? BREEDS_CAT : form.species === 'other' ? BREEDS_OTHER : BREEDS_DOG;
  const filteredBreeds = breedQuery ? breeds.filter(b => b.toLowerCase().includes(breedQuery.toLowerCase())) : breeds;

  const toggleCondition = (cond) => {
    setForm(f => ({
      ...f,
      conditions: f.conditions.includes(cond)
        ? f.conditions.filter(c => c !== cond)
        : [...f.conditions, cond]
    }));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Mismo parseo que TutorTab.jsx: guarda solo los 8 dígitos locales en el form.
  const parsePhoneDigits = (phone) => (phone || '').replace(/^\+?569?/, '').slice(0, 8);
  const formatPhone = (digits) => digits ? `+569${digits.replace(/\D/g, '').slice(0, 8)}` : '';

  const toggleUseExistingTutor = (checked) => {
    setUseExistingTutor(checked);
    if (checked && existingTutor) {
      setTutorForm({
        full_name: existingTutor.full_name || '',
        phone: parsePhoneDigits(existingTutor.phone),
        relationship: existingTutor.relationship || '',
      });
    }
    setTutorError('');
  };

  // Mismo criterio que el SQL de backfill: lowercase, sin tildes, solo alfanumérico.
  const slugify = (name) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  const generateUniqueSlug = async (userId, name) => {
    const base = slugify(name) || 'mascota';
    const { data: existing } = await supabase.from('pets').select('slug').eq('user_id', userId);
    const taken = new Set((existing || []).map(p => p.slug).filter(Boolean));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  };

  const savePet = async () => {
    // FIX 2.2: no se puede guardar sin nombre y teléfono del tutor titular.
    if (!tutorForm.full_name.trim() || tutorForm.phone.length !== 8) {
      setTutorError(`Necesitamos un contacto responsable de ${form.name || 'tu mascota'}`);
      return;
    }
    setTutorError('');
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const slug = await generateUniqueSlug(user.id, form.name);

    const { data: newPet, error } = await supabase.from('pets').insert({
      user_id: user.id,
      name: form.name,
      species: form.species,
      sex: form.sex || null,
      breed: form.breed,
      birth_date: form.birth_date || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      conditions: form.conditions,
      slug,
    }).select().single();

    if (!error && newPet) {
      await logActivity(supabase, newPet.id, "Creó la ficha");
      if (form.weight_kg) {
        await supabase.from("weight_logs").insert({
          pet_id: newPet.id,
          weight_kg: parseFloat(form.weight_kg),
          logged_date: new Date().toISOString().split("T")[0],
          granularity: "sporadic",
          week_of_month: null,
        });
        await logActivity(supabase, newPet.id, "Registró peso", `${form.weight_kg} kg`);
      }
      // FIX 2.3: tutor titular — misma estructura de columnas que TutorTab.jsx.
      await supabase.from("tutors").insert({
        pet_id: newPet.id,
        type: "primary",
        full_name: tutorForm.full_name,
        phone: formatPhone(tutorForm.phone),
        relationship: tutorForm.relationship || null,
      });
      await logActivity(supabase, newPet.id, "Agregó tutor", "Titular");
      setStep(5);
    }
    setLoading(false);
  };

  const css = {
    wrap: { background: '#FFF8F3', minHeight: '100vh', padding: '24px 16px', fontFamily: "'Nunito', sans-serif" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 680, margin: '0 auto 16px' },
    brandName: { fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#3D1F0A' },
    signOutBtn: { background: 'transparent', border: '1.5px solid #FFD0BC', borderRadius: 10, padding: '6px 14px', color: '#C4845A', fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    progress: { display: 'flex', gap: 6, maxWidth: 680, margin: '0 auto 20px' },
    dot: (s) => ({ flex: 1, height: 6, borderRadius: 3, background: s === 'done' ? '#2EC4B6' : s === 'active' ? '#FF6B35' : '#FFD9C8', transition: 'background 0.3s' }),
    layout: { display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, maxWidth: 680, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 20, padding: '24px 20px', border: '1.5px solid #FFD9C8' },
    sumCard: { background: '#fff', borderRadius: 20, padding: '18px 16px', border: '1.5px solid #2EC4B6' },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#3D1F0A', marginBottom: 3 },
    sub: { fontSize: 12, color: '#C4845A', marginBottom: 18 },
    label: { fontSize: 11, fontWeight: 700, color: '#7A4522', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block', marginTop: 12 },
    input: { width: '100%', padding: '10px 13px', borderRadius: 11, border: '1.5px solid #FFD9C8', background: '#FFFAF7', fontFamily: "'Nunito', sans-serif", fontSize: 14, color: '#3D1F0A', outline: 'none' },
    btn: { width: '100%', padding: 13, borderRadius: 13, background: '#FF6B35', color: '#fff', border: 'none', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 14 },
    btnBack: { width: '100%', padding: 11, borderRadius: 13, background: '#FFF0EB', color: '#FF6B35', border: '2px solid #FFD0BC', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #FF6B35', borderRadius: 11, maxHeight: 160, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 16px rgba(61,31,10,0.1)' },
    dropItem: { padding: '9px 13px', fontSize: 13, cursor: 'pointer', color: '#3D1F0A' },
  };

  const dotState = (i) => i < step ? 'done' : i === step ? 'active' : 'idle';

  return (
    <div style={css.wrap}>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={css.header}>
        <div style={css.brandName}>🐾 Firus<span style={{ color: '#FFD166' }}>&</span>Michis</div>
        <button style={css.signOutBtn} onClick={handleSignOut}>Cerrar sesión</button>
      </div>

      {/* PROGRESS */}
      <div style={css.progress}>
        {[1,2,3,4,5].map(i => <div key={i} style={css.dot(dotState(i))} />)}
      </div>

      <div style={css.layout}>
        <div>
          {/* PASO 1 */}
          {step === 1 && (
            <div style={css.card}>
              <div style={css.title}>¿Qué tipo de mascota? 🐾</div>
              <div style={css.sub}>Selecciona para personalizar la experiencia</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                {SPECIES_OPTIONS.map(s => (
                  <div key={s.value} onClick={() => setForm(f => ({ ...f, species: s.value, speciesIcon: s.icon, speciesLabel: s.label }))}
                    style={{ border: `2px solid ${form.species === s.value ? '#FF6B35' : '#FFD9C8'}`, borderRadius: 14, padding: '14px 6px', background: form.species === s.value ? '#FFF0EB' : '#FFFAF7', cursor: 'pointer', textAlign: 'center' }}>
                    <span style={{ fontSize: 32, display: 'block', marginBottom: 4 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3D1F0A' }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <button style={css.btn} onClick={() => setStep(2)}>Continuar →</button>
              {hasExistingPets && (
                <button onClick={() => router.push('/dashboard')}
                  style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', color: '#C4845A', fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 12, textDecoration: 'underline' }}>
                  ← Volver al dashboard
                </button>
              )}
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div style={css.card}>
              <div style={css.title}>Datos básicos 📋</div>
              <div style={css.sub}>Cuéntanos sobre tu mascota</div>
              <label style={css.label}>Nombre</label>
              <input style={css.input} placeholder="Ej: Kiara" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={css.label}>Sexo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
                {[{ value: 'male', icon: '♂️', label: 'Macho' }, { value: 'female', icon: '♀️', label: 'Hembra' }, { value: 'unknown', icon: '❓', label: 'Descon.' }].map(s => (
                  <div key={s.value} onClick={() => setForm(f => ({ ...f, sex: s.value }))}
                    style={{ border: `2px solid ${form.sex === s.value ? '#FF6B35' : '#FFD9C8'}`, borderRadius: 12, padding: '10px 6px', background: form.sex === s.value ? '#FFF0EB' : '#FFFAF7', cursor: 'pointer', textAlign: 'center' }}>
                    <span style={{ fontSize: 20, display: 'block', marginBottom: 3 }}>{s.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#3D1F0A' }}>{s.label}</span>
                  </div>
                ))}
              </div>
              <label style={css.label}>Raza</label>
              <div style={{ position: 'relative' }}>
                <input style={css.input} placeholder="Buscar raza..." value={breedQuery}
                  onChange={e => { setBreedQuery(e.target.value); setBreedDropdown(true); }}
                  onFocus={() => setBreedDropdown(true)}
                  onBlur={() => setTimeout(() => setBreedDropdown(false), 200)} />
                {breedDropdown && (
                  <div style={css.dropdown}>
                    {filteredBreeds.slice(0, 8).map(b => (
                      <div key={b} style={css.dropItem} onClick={() => { setForm(f => ({ ...f, breed: b })); setBreedQuery(b); setBreedDropdown(false); }}>{b}</div>
                    ))}
                    {breedQuery && !breeds.find(b => b.toLowerCase() === breedQuery.toLowerCase()) && (
                      <div style={{ ...css.dropItem, color: '#2EC4B6', fontWeight: 700 }} onClick={() => { setForm(f => ({ ...f, breed: breedQuery })); setBreedDropdown(false); }}>+ Usar "{breedQuery}"</div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={css.label}>Fecha de nacimiento</label>
                  <input style={css.input} type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
                <div>
                  <label style={css.label}>Peso (kg)</label>
                  <input style={css.input} type="number" placeholder="38" step="0.1" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
                </div>
              </div>
              <button style={css.btn} onClick={() => setStep(3)}>Continuar →</button>
              <button style={css.btnBack} onClick={() => setStep(1)}>← Volver</button>
            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div style={css.card}>
              <div style={css.title}>Condiciones de salud 🏥</div>
              <div style={css.sub}>Selecciona las que apliquen</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                {CONDITIONS.map(cond => {
                  const sel = form.conditions.includes(cond);
                  return (
                    <div key={cond} onClick={() => toggleCondition(cond)} style={{ padding: '7px 13px', borderRadius: 20, border: `1.5px solid ${sel ? '#FF6B35' : '#E8D5C8'}`, background: sel ? '#FFF0EB' : '#FFFAF7', fontSize: 12, fontWeight: 700, color: sel ? '#CC4A1A' : '#7A4522', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${sel ? '#FF6B35' : '#C4845A'}`, background: sel ? '#FF6B35' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>{sel ? '✓' : ''}</span>
                      {cond}
                    </div>
                  );
                })}
              </div>
              <button style={css.btn} onClick={() => setStep(4)}>Continuar →</button>
              <button style={css.btnBack} onClick={() => setStep(2)}>← Volver</button>
            </div>
          )}

          {/* PASO 4 — TUTOR TITULAR */}
          {step === 4 && (
            <div style={css.card}>
              <div style={css.title}>Tutor responsable 👤</div>
              <div style={css.sub}>¿Quién es el contacto principal de {form.name || 'tu mascota'}?</div>

              {existingTutor && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 12.5, color: '#7A4522', fontWeight: 600, background: '#FFF0EB', border: '1.5px solid #FFD0BC', borderRadius: 12, padding: '10px 12px' }}>
                  <input type="checkbox" checked={useExistingTutor}
                    onChange={e => toggleUseExistingTutor(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#FF6B35', flexShrink: 0 }} />
                  Usar mis datos de contacto de {existingTutor.petName}
                </label>
              )}

              <label style={css.label}>Nombre completo *</label>
              <input style={css.input} placeholder="Ej: María González" value={tutorForm.full_name}
                onChange={e => { setTutorForm(f => ({ ...f, full_name: e.target.value })); setTutorError(''); }} />

              <label style={css.label}>Teléfono *</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #FFD9C8', borderRadius: 11, background: '#FFFAF7', overflow: 'hidden' }}>
                <span style={{ padding: '10px 10px 10px 13px', background: '#FFF0EB', color: '#FF6B35', fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, borderRight: '1.5px solid #FFD9C8', flexShrink: 0 }}>
                  +56 9
                </span>
                <input
                  style={{ flex: 1, padding: '10px 13px', border: 'none', outline: 'none', fontFamily: "'Nunito', sans-serif", fontSize: 14, color: '#3D1F0A', background: 'transparent' }}
                  type="tel" placeholder="12345678" maxLength={8}
                  value={tutorForm.phone}
                  onChange={e => { setTutorForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 8) })); setTutorError(''); }} />
              </div>

              <label style={css.label}>Relación con la mascota</label>
              <select style={{ ...css.input, background: '#fff' }} value={tutorForm.relationship}
                onChange={e => setTutorForm(f => ({ ...f, relationship: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              {tutorError && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 700, marginTop: 12 }}>
                  ⚠️ {tutorError}
                </div>
              )}

              <button style={css.btn} onClick={savePet} disabled={loading}>{loading ? 'Guardando...' : 'Guardar mascota ✓'}</button>
              <button style={css.btnBack} onClick={() => setStep(3)}>← Volver</button>
            </div>
          )}

          {/* PASO 5 */}
          {step === 5 && (
            <div style={css.card}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 60, marginBottom: 10 }}>🎉</div>
                <div style={css.title}>
                  {form.sex === 'male' ? `¡${form.name} ha sido registrado!`
                    : form.sex === 'female' ? `¡${form.name} ha sido registrada!`
                    : `¡${form.name} ya es parte de Firus&Michis!`}
                </div>
                <div style={{ ...css.sub, margin: '8px 0 20px' }}>Ya tiene su ficha en Firus&Michis</div>
                <button style={css.btn} onClick={() => router.push('/dashboard')}>Ver dashboard →</button>
              </div>
            </div>
          )}
        </div>

        {/* RESUMEN */}
        <div style={css.sumCard}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: '#2EC4B6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📋 Resumen</div>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#FFD166,#FF8C5A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 10px' }}>{form.speciesIcon}</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: form.name ? 16 : 13, fontWeight: form.name ? 800 : 400, color: form.name ? '#3D1F0A' : '#C4845A', textAlign: 'center', marginBottom: 8 }}>{form.name || 'Nombre de mascota'}</div>
          {[
            ['Especie', form.speciesLabel],
            ['Raza', form.breed],
            ['Nacimiento', form.birth_date ? new Date(form.birth_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''],
            ['Peso', form.weight_kg ? `${form.weight_kg} kg` : ''],
            ['Tutor titular', tutorForm.full_name],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid #FFF0EB' }}>
              <span style={{ color: '#C4845A' }}>{k}</span>
              <span style={{ fontWeight: 700, color: '#3D1F0A', textAlign: 'right', maxWidth: 120, wordBreak: 'break-word' }}>{v}</span>
            </div>
          ))}
          {form.conditions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {form.conditions.map(c => (
                <span key={c} style={{ background: '#FFF0EB', color: '#FF6B35', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
