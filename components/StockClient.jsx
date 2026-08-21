"use client";
import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatFecha } from "@/lib/fechas";
import { computeItemNeeds } from "@/lib/inventoryCalc";
import { logActivity } from "@/lib/activityLog";
import DrugClassLabel from "@/components/DrugClassLabel";
import StockItemModal from "@/components/StockItemModal";

const CATEGORY_LABELS = {
  medicamento: "💊 Medicamento", higiene: "🧴 Higiene", insumo: "🩹 Insumo",
  alimento: "🍖 Alimento", otro: "📦 Otro",
};
const CATEGORY_FILTERS = ["todas", "medicamento", "higiene", "insumo", "alimento", "otro"];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(`${dateStr}T00:00:00`) - new Date()) / 86400000);
}

function buildItemsWithCalc(items, inventoryPets, inventoryLinks, treatmentItems, medications, now) {
  return items.map(item => {
    const assignedPetIds = inventoryPets.filter(r => r.inventory_item_id === item.id).map(r => r.pet_id);
    const links = inventoryLinks
      .filter(r => r.inventory_item_id === item.id)
      .map(r => {
        if (r.treatment_item_id) {
          const ti = treatmentItems.find(t => t.id === r.treatment_item_id);
          return ti ? { kind: "treatment", petId: ti.pet_id, treatmentItem: ti } : null;
        }
        const m = medications.find(x => x.id === r.medication_id);
        return m ? { kind: "medication", petId: m.pet_id, medication: m } : null;
      })
      .filter(Boolean);
    const calc = computeItemNeeds(item, links, now);
    return { ...item, assignedPetIds, links, calc };
  });
}

export default function StockClient({ pets, items: rawItems, inventoryPets, inventoryLinks, treatmentItems, medications }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fromTreatmentId = searchParams.get("fromTreatment");

  const [items, setItems] = useState(rawItems);
  const [petLinks, setPetLinks] = useState(inventoryPets);
  const [links, setLinks] = useState(inventoryLinks);
  const [view, setView] = useState("inventario");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [dismissedQuickAdd, setDismissedQuickAdd] = useState(false);

  const now = new Date();
  const petName = (id) => pets.find(p => p.id === id)?.name || "?";

  const itemsWithCalc = useMemo(
    () => buildItemsWithCalc(items, petLinks, links, treatmentItems, medications, now),
    [items, petLinks, links, treatmentItems, medications]
  );

  const filteredItems = categoryFilter === "todas" ? itemsWithCalc : itemsWithCalc.filter(i => i.category === categoryFilter);

  const shoppingList = itemsWithCalc.filter(i => {
    if (i.calc.unitsToBuy != null) return i.calc.unitsToBuy > 0;
    return i.calc.daysRemaining != null && i.calc.daysRemaining < 7;
  });

  const quickAddItems = fromTreatmentId ? treatmentItems.filter(ti => ti.treatment_id === fromTreatmentId) : [];
  const alreadyLinkedTreatmentIds = new Set(links.filter(l => l.treatment_item_id).map(l => l.treatment_item_id));

  const reload = async () => {
    const [itemsRes, petLinksRes, linksRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_pets").select("*"),
      supabase.from("inventory_treatment_links").select("*"),
    ]);
    setItems(itemsRes.data || []);
    setPetLinks(petLinksRes.data || []);
    setLinks(linksRes.data || []);
  };

  const openNew = (pf = null) => { setEditingItem(null); setPrefill(pf); setShowModal(true); };
  const openEdit = (item) => { setEditingItem(item); setPrefill(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingItem(null); setPrefill(null); };
  const onSaved = async () => { closeModal(); await reload(); };

  const deleteItem = async (item) => {
    if (!confirm(`¿Eliminar "${item.name}" del inventario? Esta acción no se puede deshacer.`)) return;
    await supabase.from("inventory_items").delete().eq("id", item.id);
    await logActivity(supabase, item.assignedPetIds[0] || null, "Eliminó ítem de inventario", item.name);
    await reload();
  };

  const css = {
    page: { maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Nunito', sans-serif" },
    header: { background: "linear-gradient(160deg, #FF6B35 0%, #E63900 100%)", padding: "20px 20px 24px" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    backBtn: { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 700, padding: "7px 14px", cursor: "pointer" },
    addBtn: { background: "#fff", border: "none", borderRadius: 10, color: "#FF6B35", fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, padding: "7px 14px", cursor: "pointer" },
    title: { fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 8 },
    content: { padding: "16px 16px 32px" },
    tabs: { display: "flex", gap: 6, marginBottom: 14 },
    tabBtn: (active) => ({ flex: 1, padding: "8px 6px", borderRadius: 12, border: `1.5px solid ${active ? "#FF6B35" : "#FFD9C8"}`, background: active ? "#FF6B35" : "#fff", textAlign: "center", fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#7A4522", cursor: "pointer" }),
    chipsRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 },
    chip: (active) => ({ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${active ? "#FF6B35" : "#FFD9C8"}`, background: active ? "#FFF0EB" : "#fff", color: active ? "#FF6B35" : "#7A4522", fontSize: 11, fontWeight: 700, cursor: "pointer" }),
    card: { background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 12, boxShadow: "0 4px 16px rgba(61,31,10,0.08)" },
    itemName: { fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: "#3D1F0A" },
    itemMeta: { fontSize: 12, color: "#C4845A", marginTop: 2 },
    petChip: { display: "inline-block", background: "#FFF0EB", color: "#FF6B35", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, marginRight: 4, marginTop: 6 },
    expiryBadge: (level) => ({ display: "inline-block", marginTop: 6, marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: level === "danger" ? "#fef2f2" : "#fffbeb", color: level === "danger" ? "#dc2626" : "#d97706" }),
    calcBox: { marginTop: 10, background: "#F0FDF9", border: "1px solid #9FE1CB", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#0F6E56" },
    calcBoxWarn: { marginTop: 10, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#92400E" },
    btnRow: { display: "flex", gap: 6, marginTop: 10 },
    editBtn: { padding: "5px 12px", borderRadius: 8, background: "#FFF0EB", color: "#FF6B35", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 700, cursor: "pointer" },
    delBtn: { padding: "5px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 11, fontWeight: 700, cursor: "pointer" },
    emptyState: { textAlign: "center", padding: "32px 16px", color: "#C4845A", fontSize: 13 },
    floatBtn: { width: "100%", padding: 13, borderRadius: 13, background: "#FF6B35", color: "#fff", border: "none", fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@400;700&display=swap" rel="stylesheet" />
      <div style={css.page}>
        <div style={css.header}>
          <div style={css.headerTop}>
            <button style={css.backBtn} onClick={() => router.push("/dashboard")}>← Volver</button>
            <button style={css.addBtn} onClick={() => openNew()}>+ Agregar</button>
          </div>
          <div style={css.title}>📦 Stock</div>
        </div>

        <div style={css.content}>
          {quickAddItems.length > 0 && !dismissedQuickAdd && (
            <div style={{ background: "#FFF0EB", border: "1.5px solid #FFD0BC", borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#7A4522" }}>🛒 Registrar desde la receta</div>
                <button onClick={() => setDismissedQuickAdd(true)} style={{ background: "none", border: "none", color: "#C4845A", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
              {quickAddItems.map(ti => (
                <div key={ti.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <div style={{ fontSize: 12, color: "#3D1F0A", fontWeight: 700 }}>{ti.name}</div>
                  {alreadyLinkedTreatmentIds.has(ti.id) ? (
                    <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✓ Ya registrado</span>
                  ) : (
                    <button
                      onClick={() => openNew({
                        name: ti.name, category: "medicamento", unit: "comprimidos",
                        units_per_package: ti.units_per_box || "", drug_class: ti.drug_class || "",
                        petId: ti.pet_id, linkKind: "treatment", linkId: ti.id,
                      })}
                      style={{ padding: "4px 10px", borderRadius: 8, background: "#FF6B35", color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      + Agregar al inventario
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={css.tabs}>
            <button style={css.tabBtn(view === "inventario")} onClick={() => setView("inventario")}>Inventario</button>
            <button style={css.tabBtn(view === "compras")} onClick={() => setView("compras")}>
              Lista de compras{shoppingList.length > 0 ? ` (${shoppingList.length})` : ""}
            </button>
          </div>

          {view === "inventario" && (
            <>
              <div style={css.chipsRow}>
                {CATEGORY_FILTERS.map(cat => (
                  <button key={cat} style={css.chip(categoryFilter === cat)} onClick={() => setCategoryFilter(cat)}>
                    {cat === "todas" ? "Todas" : CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              {filteredItems.length === 0 ? (
                <div style={css.emptyState}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                  <div>Sin ítems en el inventario</div>
                  <button style={css.floatBtn} onClick={() => openNew()}>+ Agregar ítem</button>
                </div>
              ) : (
                <>
                  {filteredItems.map(item => {
                    const d = daysUntil(item.expires_at);
                    const expiryLevel = d != null && d < 0 ? "danger" : d != null && d <= 30 ? "warn" : null;
                    return (
                      <div key={item.id} style={css.card}>
                        <div style={css.itemName}>{item.name}<DrugClassLabel drugClass={item.drug_class} /></div>
                        <div style={css.itemMeta}>{CATEGORY_LABELS[item.category]} · {item.quantity} {item.unit || ""}</div>
                        <div>
                          {item.assignedPetIds.map(pid => <span key={pid} style={css.petChip}>{petName(pid)}</span>)}
                          {expiryLevel && (
                            <span style={css.expiryBadge(expiryLevel)}>
                              {expiryLevel === "danger" ? `⚠️ Vencido (${formatFecha(item.expires_at)})` : `⏳ Vence ${formatFecha(item.expires_at)}`}
                            </span>
                          )}
                        </div>

                        {item.links.length > 0 && item.calc.hasCalc && (
                          <div style={item.calc.openEnded ? css.calcBoxWarn : css.calcBox}>
                            {item.calc.unitsNeeded != null ? (
                              <>Necesitas {item.calc.unitsNeeded} · Tienes {item.quantity} · Compra {item.calc.packagesToBuy != null ? `${item.calc.packagesToBuy} caja${item.calc.packagesToBuy !== 1 ? "s" : ""}` : `${item.calc.unitsToBuy} ${item.unit || ""}`}</>
                            ) : (
                              <>Alcanza {item.calc.daysRemaining != null ? `${item.calc.daysRemaining} días` : "—"}{item.calc.exhaustionDate ? ` · se agota el ${formatFecha(item.calc.exhaustionDate)}` : ""} · tratamiento crónico, sin fecha de término</>
                            )}
                          </div>
                        )}
                        {item.links.length > 0 && !item.calc.hasCalc && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "#C4845A" }}>Frecuencia no reconocida — sin cálculo disponible</div>
                        )}

                        <div style={css.btnRow}>
                          <button style={css.editBtn} onClick={() => openEdit(item)}>✏️ Editar</button>
                          <button style={css.delBtn} onClick={() => deleteItem(item)}>🗑️ Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                  <button style={css.floatBtn} onClick={() => openNew()}>+ Agregar ítem</button>
                </>
              )}
            </>
          )}

          {view === "compras" && (
            shoppingList.length === 0 ? (
              <div style={css.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                <div>Nada que comprar por ahora</div>
              </div>
            ) : (
              shoppingList.map(item => (
                <div key={item.id} style={css.card}>
                  <div style={css.itemName}>{item.name}</div>
                  <div style={css.itemMeta}>{CATEGORY_LABELS[item.category]}</div>
                  <div style={item.calc.openEnded ? css.calcBoxWarn : css.calcBox}>
                    {item.calc.unitsNeeded != null
                      ? <>Necesitas {item.calc.unitsNeeded} · Tienes {item.quantity} · Compra {item.calc.packagesToBuy != null ? `${item.calc.packagesToBuy} caja${item.calc.packagesToBuy !== 1 ? "s" : ""}` : `${item.calc.unitsToBuy} ${item.unit || ""}`}</>
                      : <>Quedan {item.calc.daysRemaining} días de stock — revisar pronto</>}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {showModal && (
        <StockItemModal
          pets={pets}
          treatmentItems={treatmentItems}
          medications={medications}
          editingItem={editingItem}
          prefill={prefill}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
