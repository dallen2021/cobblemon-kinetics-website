import Image from "next/image";
import Link from "next/link";
import { StudioPlaceholder } from "@/components/studio-placeholder";
import { StatusLamp } from "@/components/ui";
import {
  localGameAssetLabel,
  localGameAssetUrl,
  readLocalGameAssetManifest,
  type LocalGameAssetEntry,
  type LocalGameAssetProvider,
} from "@/server/local-game-assets";

const pageSize = 48;
const featuredPaths = new Map([
  ["cobblemon/textures/pokemon/0007_squirtle/squirtle.png", 0],
  ["create/textures/block/waterwheel_metal.png", 1],
  ["create/textures/gui/logo.png", 2],
]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function pageLink(query: string, provider: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (provider !== "all") params.set("provider", provider);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/studio/assets${suffix ? `?${suffix}` : ""}`;
}

function previewSort(left: LocalGameAssetEntry, right: LocalGameAssetEntry): number {
  const leftKey = `${left.provider}/${left.path}`;
  const rightKey = `${right.provider}/${right.path}`;
  const leftScore = featuredPaths.get(leftKey) ?? 100;
  const rightScore = featuredPaths.get(rightKey) ?? 100;
  return leftScore - rightScore || leftKey.localeCompare(rightKey);
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 120).toLocaleLowerCase();
  const requestedProvider = first(params.provider);
  const provider: LocalGameAssetProvider | "all" =
    requestedProvider === "create" || requestedProvider === "cobblemon" ? requestedProvider : "all";
  const requestedPage = Number.parseInt(first(params.page), 10);
  const manifest = await readLocalGameAssetManifest();
  const filtered = (manifest?.assets ?? [])
    .filter((asset) => provider === "all" || asset.provider === provider)
    .filter(
      (asset) => !query || `${asset.provider}/${asset.path}`.toLocaleLowerCase().includes(query),
    )
    .sort(previewSort);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const visibleAssets = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const sourceCount = manifest?.assets.length ?? 0;
  return (
    <StudioPlaceholder
      eyebrow="Rights-first pipeline"
      title="Asset inventory"
      description="Approved project art stays separate from a private, local-only view of source files from installed Create and Cobblemon JARs."
      status={
        sourceCount
          ? `${sourceCount.toLocaleString()} local source files · never deployed`
          : "Brand approved · local source preview not imported"
      }
    >
      <div className="policy-grid">
        <div>
          <StatusLamp tone="green" label="Approved brand system" />
          <p>The paw-and-gear lockup and its transparent emblem are approved for brand use.</p>
        </div>
        <div>
          <StatusLamp tone="red" label="Public redistribution denied" />
          <p>
            Installed third-party source files never enter Git, Vercel, publication bundles, or
            public Storage.
          </p>
        </div>
        <div>
          <StatusLamp tone="amber" label="Manifest required" />
          <p>
            Source hash, approval scope, file hash, transform, and visibility are recorded for every
            public asset.
          </p>
        </div>
      </div>
      <section className="local-asset-library" aria-labelledby="local-source-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Installed JAR review</p>
            <h2 id="local-source-title">Real source files · local only</h2>
          </div>
          {manifest ? <StatusLamp tone="amber" label="Private evaluation" /> : null}
        </div>
        {manifest ? (
          <>
            <p className="source-note local-asset-warning">
              These are exact PNG files extracted from your installed JARs for private review. Many
              are UV maps, atlases, or component textures—not finished Pokémon portraits or machine
              thumbnails. The app serves them only on loopback, after authentication, with no-store
              headers.
            </p>
            <div className="local-asset-sources">
              {manifest.sources.map((source) => (
                <article key={source.provider}>
                  <span className="local-asset-provider">{source.provider}</span>
                  <strong>{source.version}</strong>
                  <span>{source.asset_count.toLocaleString()} PNG files</span>
                  <code>{source.archive_sha256.slice(0, 12)}…</code>
                </article>
              ))}
            </div>
            <form action="/studio/assets" className="local-asset-filter" method="get">
              <label>
                <span>Search source paths</span>
                <input
                  defaultValue={query}
                  name="q"
                  placeholder="squirtle, waterwheel, mechanical_press…"
                  type="search"
                />
              </label>
              <label>
                <span>Source</span>
                <select defaultValue={provider} name="provider">
                  <option value="all">Create + Cobblemon</option>
                  <option value="cobblemon">Cobblemon</option>
                  <option value="create">Create</option>
                </select>
              </label>
              <button className="button button-primary" type="submit">
                Filter files
              </button>
              <Link className="button button-secondary" href="/studio/assets">
                Clear
              </Link>
            </form>
            <div className="local-asset-results-heading">
              <p>
                <strong>{filtered.length.toLocaleString()}</strong> matching files · page{" "}
                {currentPage} of {pageCount}
              </p>
              <p>Source pixels are enlarged with nearest-neighbor rendering.</p>
            </div>
            {visibleAssets.length ? (
              <div className="local-asset-grid">
                {visibleAssets.map((asset) => (
                  <figure className="local-asset-tile" key={`${asset.provider}/${asset.path}`}>
                    <div className="local-asset-preview">
                      <Image
                        alt={`${localGameAssetLabel(asset)} source texture from the installed ${asset.provider} JAR`}
                        height={asset.height}
                        loading="lazy"
                        sizes="144px"
                        src={localGameAssetUrl(asset)}
                        unoptimized
                        width={asset.width}
                      />
                    </div>
                    <figcaption>
                      <span className="local-asset-provider">{asset.provider}</span>
                      <strong>{localGameAssetLabel(asset)}</strong>
                      <code title={asset.path}>{asset.path}</code>
                      <small>
                        {asset.width}×{asset.height} · {asset.byte_size.toLocaleString()} bytes
                      </small>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="local-asset-empty">
                <h3>No matching source files</h3>
                <p>Try a shorter registry, species, block, texture, or GUI term.</p>
              </div>
            )}
            {pageCount > 1 ? (
              <nav aria-label="Source asset pages" className="local-asset-pagination">
                {currentPage > 1 ? (
                  <Link href={pageLink(query, provider, currentPage - 1)}>Previous</Link>
                ) : (
                  <span aria-disabled="true">Previous</span>
                )}
                <span>
                  {currentPage} / {pageCount}
                </span>
                {currentPage < pageCount ? (
                  <Link href={pageLink(query, provider, currentPage + 1)}>Next</Link>
                ) : (
                  <span aria-disabled="true">Next</span>
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="local-asset-empty">
            <h3>No local source preview yet</h3>
            <p>
              Run <code>pnpm assets:import-local</code> with explicit Create and Cobblemon JAR paths
              and versions. The importer writes only to the ignored <code>.private</code> directory.
            </p>
          </div>
        )}
      </section>
      <section className="asset-gallery" aria-labelledby="approved-art-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current approved set</p>
            <h2 id="approved-art-title">Brand and interface art</h2>
          </div>
        </div>
        <div className="asset-gallery-grid">
          <figure className="asset-tile">
            <Image
              alt="Cobblemon Kinetics paw-and-gear lockup"
              height={1254}
              sizes="(max-width: 760px) calc(100vw - 4rem), (max-width: 1100px) 40vw, 220px"
              src="/brand/cobblemon-kinetics-lockup-transparent.png"
              width={1254}
            />
            <figcaption>Cobblemon Kinetics · approved lockup</figcaption>
          </figure>
          <figure className="asset-tile">
            <Image
              alt="Cobblemon Kinetics paw-and-gear emblem"
              height={1254}
              sizes="(max-width: 760px) calc(100vw - 4rem), (max-width: 1100px) 40vw, 220px"
              src="/brand/cobblemon-kinetics-emblem.png"
              width={1254}
            />
            <figcaption>Kinetics emblem · approved brand art</figcaption>
          </figure>
          <figure className="asset-tile">
            <Image
              alt="Workshop crate with blank blueprint and tools"
              height={1126}
              sizes="(max-width: 760px) calc(100vw - 4rem), (max-width: 1100px) 40vw, 220px"
              src="/art/generated/empty-workbench.webp"
              width={1397}
            />
            <figcaption>Workbench kit · empty-state art</figcaption>
          </figure>
        </div>
        <p className="source-note">
          This empty-state illustration is never presented as Pokémon, a machine, a registry object,
          or in-game content.
        </p>
      </section>
    </StudioPlaceholder>
  );
}
