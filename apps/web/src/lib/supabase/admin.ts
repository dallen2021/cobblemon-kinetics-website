import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnvironment } from "@/lib/env";
import type { Database } from "@/types/database.generated";
import { fetchSupabaseService } from "./url-policy";

export function createAdminSupabaseClient() {
  const { url, secretKey } = getSupabaseServiceEnvironment();
  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => fetchSupabaseService(input, init),
    },
  });
}
