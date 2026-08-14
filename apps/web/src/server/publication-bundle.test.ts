import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  compactCanonicalJson,
  createLocalPublicationBundle,
  createSignedPublicationBundleFromRpc,
} from "./publication-bundle";

async function productionEnvelope() {
  const local = await createLocalPublicationBundle("publication-20260814-hydro-slice");
  const { integrity, ...payload } = local;
  return {
    publication: {
      public_id: "publication-20260814-hydro-slice",
      state: "validated",
      schema_version: "1.0.0",
      content_hash: integrity.content_sha256,
      git_commit_sha: null,
      validated_at: "2026-08-14T17:00:00.000Z",
      exported_at: null,
      published_at: null,
    },
    payload,
  };
}

describe("local publication bundle", () => {
  it("uses the canonical contract and a matching deterministic hash", async () => {
    const bundle = await createLocalPublicationBundle("hydro-vertical-slice");
    const { integrity, ...payload } = bundle;
    const expected = createHash("sha256").update(compactCanonicalJson(payload)).digest("hex");
    expect(bundle.bundle_version).toBe(1);
    expect(bundle.batch_id).toBe("cobblemon_kinetics:publication/hydro-vertical-slice");
    expect(integrity.content_sha256).toBe(expected);
    expect(bundle.records.pokemon.length).toBeGreaterThanOrEqual(1);
  });

  it("validates the RPC payload, verifies its batch hash, and signs the hash", async () => {
    const rpc = await productionEnvelope();
    const key = "test-only-publication-signing-key";
    const bundle = createSignedPublicationBundleFromRpc(
      rpc,
      key,
      "publication-20260814-hydro-slice",
    );
    expect(bundle.integrity.content_sha256).toBe(rpc.publication.content_hash);
    expect(bundle.integrity.signature).toEqual({
      algorithm: "hmac-sha256",
      value: createHmac("sha256", key).update(rpc.publication.content_hash).digest("hex"),
    });
  });

  it("rejects malformed public projections", async () => {
    const rpc = await productionEnvelope();
    rpc.payload.records.jobs[0] = {
      ...rpc.payload.records.jobs[0]!,
      summary: "",
    };
    expect(() =>
      createSignedPublicationBundleFromRpc(rpc, "test-key", "publication-20260814-hydro-slice"),
    ).toThrow(/schema is invalid/u);
  });

  it("rejects private fields before signing", async () => {
    const rpc = await productionEnvelope();
    Object.assign(rpc.payload.records.pokemon[0]!, {
      private_note: "must never leave the studio",
    });
    expect(() =>
      createSignedPublicationBundleFromRpc(rpc, "test-key", "publication-20260814-hydro-slice"),
    ).toThrow(/private or quarantined/u);
  });

  it("rejects a payload whose hash differs from the approved batch", async () => {
    const rpc = await productionEnvelope();
    rpc.publication.content_hash = "a".repeat(64);
    expect(() =>
      createSignedPublicationBundleFromRpc(rpc, "test-key", "publication-20260814-hydro-slice"),
    ).toThrow(/hash does not match/u);
  });
});
