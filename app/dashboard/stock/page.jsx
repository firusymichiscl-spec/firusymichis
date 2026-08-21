import { Suspense } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StockClient from "@/components/StockClient";

export default async function StockPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!pets || pets.length === 0) redirect("/nueva-mascota");

  const activePetIds = pets.filter(p => !p.archived_at).map(p => p.id);

  const [itemsRes, petLinksRes, treatmentLinksRes, treatmentItemsRes, medicationsRes] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("inventory_pets").select("*"),
    supabase.from("inventory_treatment_links").select("*"),
    supabase.from("treatment_items").select("*").in("pet_id", activePetIds).eq("active", true).order("created_at", { ascending: false }),
    supabase.from("medications").select("*").in("pet_id", activePetIds).eq("active", true).order("created_at", { ascending: false }),
  ]);

  const items = itemsRes.data || [];
  const itemIds = items.map(i => i.id);
  const inventoryPets = (petLinksRes.data || []).filter(r => itemIds.includes(r.inventory_item_id));
  const inventoryLinks = (treatmentLinksRes.data || []).filter(r => itemIds.includes(r.inventory_item_id));

  return (
    <Suspense fallback={null}>
      <StockClient
        pets={pets}
        items={items}
        inventoryPets={inventoryPets}
        inventoryLinks={inventoryLinks}
        treatmentItems={treatmentItemsRes.data || []}
        medications={medicationsRes.data || []}
      />
    </Suspense>
  );
}
