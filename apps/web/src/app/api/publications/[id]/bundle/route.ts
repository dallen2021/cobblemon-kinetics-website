import { hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { requireMaintainer } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFixturePublicationBundle } from "@/server/fixture-publications";
import { createSignedPublicationBundleFromRpc } from "@/server/publication-bundle";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireMaintainer("/studio/publications");
  const { id } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))
    return Response.json({ error: "Invalid publication identifier." }, { status: 400 });

  let bundle: unknown;
  if (isFixtureModeEnabled()) {
    bundle = getFixturePublicationBundle(id);
    if (!bundle) {
      return Response.json({ error: "Fixture publication batch was not found." }, { status: 404 });
    }
  } else if (hasSupabaseEnvironment()) {
    const signingKey = process.env.PUBLICATION_SIGNING_KEY;
    if (!signingKey) {
      return Response.json({ error: "Publication signing is not configured." }, { status: 503 });
    }
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_publication_bundle", { p_publication_id: id });
    if (error)
      return Response.json({ error: "Publication bundle is unavailable." }, { status: 404 });
    try {
      bundle = createSignedPublicationBundleFromRpc(data, signingKey, id);
    } catch {
      return Response.json(
        { error: "Publication bundle failed integrity validation." },
        { status: 409 },
      );
    }
  } else {
    return Response.json({ error: "Publication service is not configured." }, { status: 503 });
  }

  return Response.json(bundle, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${id}.publication.json"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
