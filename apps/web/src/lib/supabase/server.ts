import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database.generated";

export async function createServerSupabaseClient() {
  const { url, publishableKey } = getPublicSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. src/proxy.ts performs refreshes.
        }
      },
    },
  });
}
