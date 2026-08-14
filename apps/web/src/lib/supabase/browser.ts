import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database.generated";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = getPublicSupabaseEnvironment();
  return createBrowserClient<Database>(url, publishableKey);
}
