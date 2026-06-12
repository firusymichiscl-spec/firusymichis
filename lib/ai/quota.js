import { createClient } from "@supabase/supabase-js";

export const AI_LIMITS = {
  free: 3,
  pro: 30,
  business: 100,
};

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getUserPlan(supabase, userId) {
  const { data } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  if (!data || data.plan === "free") return "free";

  const isActive =
    !data.plan_expires_at || new Date(data.plan_expires_at) > new Date();

  return isActive ? data.plan : "free";
}

export async function checkAiQuota(userId, tipo) {
  const supabase = serviceClient();
  const plan = await getUserPlan(supabase, userId);
  const limit = AI_LIMITS[plan] ?? AI_LIMITS.free;

  const { data: newCount, error } = await supabase.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_tipo: tipo,
  });

  if (error) {
    console.error("[checkAiQuota] RPC error:", error);
    return { allowed: true, remaining: limit };
  }

  const allowed = newCount <= limit;
  const remaining = Math.max(0, limit - newCount);
  return { allowed, remaining };
}
