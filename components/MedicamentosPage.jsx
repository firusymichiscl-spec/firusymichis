"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const MEDS_LIST = [
  'Nexgard', 'Bravecto', 'Simparica', 'Frontline', 'Revolution', 'Milbemax', 'Drontal',
  'Meloxicam', 'Rimadyl', 'Previcox', 'Metacam', 'Tramadol',
  'Amoxicilina', 'Cefalexina', 'Metronidazol', 'Enrofloxacina', 'Doxiciclina',
  'Levotiroxina', 'Trilostano', 'Prednisolona', 'Dexametasona',
  'Apoquel', 'Cytopoint', 'Atopica',
  'Omeprazol', 'Sucralfato', 'Metoclopramida', 'Famotidina',
  'Omega 3 Vet', 'Condroitín', 'Glucosamina', 'Probióticos Vet',
];

const FREQUENCIES = [
  'Cada 12 horas', '1 vez al día', '2 veces al día', '3 veces al día',
  'Cada 48 horas', 'Semanal', 'Mensual', 'Según necesidad',
];

const UNITS = ['comp.', 'cáps.', 'ml.', 'sobre', 'ampolla'];

const COLORS = [
  { label: 'Naranja', value: '#FF6B35' },
  { label: 'Mint',    value: '#2EC4B6' },
  { label: 'Amarillo',value: '#FFD166' },
  { label: 'Púrpura', value: '#8B5CF6' },
  { label: 'Rojo',    value: '#EF4444' },
  { label: 'Verde',   value: '#10B981' },
];

const emptyForm = {
  name: '', dose: '', frequency: '', frequency_custom: '',
  stock: '', unit: 'comp.', color: '#FF6B35',
};

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #FFD9C8', background: '#fff',
  fontFamily: "'Nunito', sans-serif", fontSize: 14,
  color: '#3D1F0A', outline: 'none', boxSizing: 'border-box',
};

const sectionLabel = (text) => (
  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, color: '#FF6B35', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
    {text}
  </div>
);

const fieldLabel = (text) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#7A4522', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{text}</div>
);

export default function MedicamentosPage({ pet, medications: initialMeds }) {
  const router = useRouter();
  const supabase = createClient();
  const [meds, setMeds] = useState(initialMeds);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customFreq, setCustomFreq] = useState(false);

  const active = meds.filter(m => m.active);
  const history = meds.filter(m => !m.active);

  const reload = async () => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('pet_id', pet.id)
      .order('created_at', { ascending: false });
    setMeds(data || []);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCustomFreq(false);
    setSaved(false);
    setShowModal(true);
  };

  const openEdit = (med) => {
    const isCustom = !FREQUENCIES.includes(med.frequency);
    setForm({
      name: med.name || '',
      dose: med.dose || '',
      frequency: isCustom ? '__custom__' : (med.frequency || ''),
      frequency_custom: isCustom ? (med.frequency || '') : '',
      stock: med.stock?.toString() || '',
      unit: med.unit || 'comp.',
      color: med.color || '#FF6B35',
    });
    setCustomFreq(isCustom);
    setEditingId(med.id);
    setSaved(false);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setSaved(false); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const freq = form.frequency === '__custom__' ? form.frequency_custom : form.frequency;
    const payload = {
      pet_id: pet.id,
      name: form.name,
      dose: form.dose || null,
      frequency: freq || null,
      stock: form.stock ? parseFloat(form.stock) : null,
      unit: form.unit,
      color: form.color,
      active: true,
    };
    if (editingId) {
      await supabase.from('medications').update(payload).eq('id', editingId);
    } else {
      await supabase.from('medications').insert(payload);
    }
    setSaving(false);
    setSaved(true);
    await reload();
    setTimeout(() => closeModal(), 800);
  };

  const setActive = async (id, active) => {
    await supabase.from('medications').update({ active }).eq('id', id);
    await reload();
  };

  const css = {
    page: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#FFF8F3', fontFamily: "'Nunito', sans-serif" },
    header: { background: 'linear-gradient(160deg, #FF6B35 0%, #E63900 100%)', padding: '20px 20px 24px', position: 'relative' },
    headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    backBtn: { background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: '7px 14px', cursor: 'pointer' },
    addBtn: { background: '#fff', border: 'none', borderRadius: 10, color: '#FF6B35', fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, padding: '7px 14px', cursor: 'pointer' },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 8 },
    subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    content: { padding: '20px 16px' },
    card: { background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 12, boxShadow: '0 4px 16px rgba(61,31,10,0.08)', position: 'relative', overflow: 'hidden', display: 'flex', gap: 0 },
    accent: (color) => ({ position: 'absolute', top: 0, left: 0, bottom: 0, width: 5, background: color || '#FF6B35', borderRadius: '16px 0 0 16px' }),
    cardBody: { paddingLeft: 14, flex: 1 },
    medName: { fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: '#3D1F0A', lineHeight: 1.2 },
    medDetail: { fontSize: 12, color: '#C4845A', marginTop: 2 },
    stockRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12 },
    stockVal: { fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: '#3D1F0A' },
    cardBtns: { display: 'flex', gap: 6, marginTop: 10 },
    editBtn: { padding: '5px 12px', borderRadius: 8, background: '#FFF0EB', color: '#FF6B35', border: '1px solid #FFD0BC', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
    inactiveBtn: { padding: '5px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
    reactiveBtn: { padding: '4px 10px', borderRadius: 8, background: '#e8faf4', color: '#059669', border: '1px solid #a7f3d0', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
    histItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #FFF0EB' },
    histName: { fontSize: 13, fontWeight: 700, color: '#7A4522' },
    histDetail: { fontSize: 11, color: '#C4845A', marginTop: 1 },
    emptyState: { textAlign: 'center', padding: '32px 16px', color: '#C4845A', fontSize: 13 },
    floatBtn: { width: '100%', padding: 13, borderRadius: 13, background: '#FF6B35', color: '#fff', border: 'none', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
    modal: { background: '#FFF8F3', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto' },
    modalHeader: { background: 'linear-gradient(135deg, #FF6B35, #e85d2e)', padding: '16px 20px', borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    saveBtn: (ok) => ({ width: '100%', padding: 13, borderRadius: 13, background: ok ? '#2EC4B6' : '#FF6B35', color: '#fff', border: 'none', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.3s', marginTop: 14 }),
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
      <div style={css.page}>

        {/* HEADER */}
        <div style={css.header}>
          <div style={css.headerTop}>
            <button style={css.backBtn} onClick={() => router.push('/dashboard')}>← Volver</button>
            <button style={css.addBtn} onClick={openNew}>+ Agregar</button>
          </div>
          <div style={css.title}>💊 Medicamentos</div>
          <div style={css.subtitle}>{pet.name} · {active.length} activo{active.length !== 1 ? 's' : ''}</div>
        </div>

        <div style={css.content}>

          {/* ACTIVOS */}
          {sectionLabel('Medicamentos activos')}
          {active.length === 0 ? (
            <div style={css.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💊</div>
              <div>Sin medicamentos activos</div>
              <button style={css.floatBtn} onClick={openNew}>+ Agregar medicamento</button>
            </div>
          ) : (
            <>
              {active.map(med => (
                <div key={med.id} style={css.card}>
                  <div style={css.accent(med.color)} />
                  <div style={css.cardBody}>
                    <div style={css.medName}>{med.name}</div>
                    {med.dose && <div style={css.medDetail}>💊 {med.dose}</div>}
                    {med.frequency && <div style={css.medDetail}>🕐 {med.frequency}</div>}
                    {med.stock != null && (
                      <div style={css.stockRow}>
                        <span style={{ fontSize: 12, color: '#C4845A' }}>📦 Stock:</span>
                        <span style={css.stockVal}>{med.stock} {med.unit}</span>
                      </div>
                    )}
                    <div style={css.cardBtns}>
                      <button style={css.editBtn} onClick={() => openEdit(med)}>✏️ Editar</button>
                      <button style={css.inactiveBtn} onClick={() => setActive(med.id, false)}>Marcar inactivo</button>
                    </div>
                  </div>
                </div>
              ))}
              <button style={css.floatBtn} onClick={openNew}>+ Agregar medicamento</button>
            </>
          )}

          {/* HISTORIAL */}
          {history.length > 0 && (
            <div style={{ marginTop: 24 }}>
              {sectionLabel('Historial')}
              <div style={{ background: '#fff', borderRadius: 16, padding: '4px 16px', boxShadow: '0 4px 16px rgba(61,31,10,0.06)' }}>
                {history.map((med, i) => (
                  <div key={med.id} style={{ ...css.histItem, ...(i === history.length - 1 ? { borderBottom: 'none' } : {}) }}>
                    <div>
                      <div style={css.histName}>{med.name}</div>
                      {med.dose && <div style={css.histDetail}>{med.dose}{med.frequency ? ` · ${med.frequency}` : ''}</div>}
                    </div>
                    <button style={css.reactiveBtn} onClick={() => setActive(med.id, true)}>Reactivar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={css.overlay}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {editingId ? '✏️ Editar medicamento' : '➕ Nuevo medicamento'}
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, color: '#fff', fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: '6px 12px', cursor: 'pointer' }}>
                ✕ Cerrar
              </button>
            </div>

            <div style={{ padding: 20 }}>

              {/* NOMBRE */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel('Nombre *')}
                <input
                  style={inputStyle}
                  list="meds-list"
                  placeholder="Buscar o escribir medicamento..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <datalist id="meds-list">
                  {MEDS_LIST.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>

              {/* DOSIS */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel('Dosis')}
                <input style={inputStyle} placeholder="ej: 0.8 mg, 16 mg, 1 comp."
                  value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
              </div>

              {/* FRECUENCIA */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel('Frecuencia')}
                <select
                  style={{ ...inputStyle, background: '#fff' }}
                  value={form.frequency}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, frequency: v, frequency_custom: '' }));
                    setCustomFreq(v === '__custom__');
                  }}>
                  <option value="">Seleccionar...</option>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  <option value="__custom__">Otra (escribir)</option>
                </select>
                {customFreq && (
                  <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Ej: cada 3 días, 2 veces por semana..."
                    value={form.frequency_custom}
                    onChange={e => setForm(f => ({ ...f, frequency_custom: e.target.value }))} />
                )}
              </div>

              {/* STOCK */}
              <div style={{ marginBottom: 12 }}>
                {fieldLabel('Stock')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input style={inputStyle} type="number" min="0" placeholder="Cantidad"
                    value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  <select style={{ ...inputStyle, width: 'auto', minWidth: 90 }}
                    value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* COLOR */}
              <div style={{ marginBottom: 14 }}>
                {fieldLabel('Color de acento')}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: c.value, cursor: 'pointer', border: form.color === c.value ? '3px solid #3D1F0A' : '3px solid transparent', boxShadow: form.color === c.value ? '0 0 0 2px #fff inset' : 'none', transition: 'border 0.15s' }} />
                  ))}
                </div>
              </div>

              <button onClick={handleSave} disabled={saving || !form.name} style={css.saveBtn(saved)}>
                {saved ? '✓ Guardado' : saving ? 'Guardando...' : editingId ? '✓ Actualizar' : '✓ Guardar medicamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
