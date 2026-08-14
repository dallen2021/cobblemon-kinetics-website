"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function signIn() {
    setState("working");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: callbackUrl },
    });
    if (error) setState("error");
  }

  return (
    <div className="button-stack">
      <button
        className="button button-primary"
        type="button"
        onClick={signIn}
        disabled={state === "working"}
      >
        {state === "working" ? "Opening GitHub…" : "Continue with GitHub"}
      </button>
      {state === "error" ? (
        <p className="form-error" role="alert">
          GitHub sign-in could not start. Check the Supabase OAuth configuration and try again.
        </p>
      ) : null}
    </div>
  );
}
