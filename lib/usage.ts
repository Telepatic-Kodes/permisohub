import { createClient } from "@/lib/supabase/server"

export type UsageMetric = "ai_chats" | "pdf_extractions"

export async function getUsageThisMonth(
  userId: string,
  metric: UsageMetric,
): Promise<number> {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString()

  const { count } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("metric", metric)
    .gte("created_at", startOfMonth)

  return count ?? 0
}

export async function recordUsage(
  userId: string,
  metric: UsageMetric,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from("usage_events").insert({ user_id: userId, metric })
}
