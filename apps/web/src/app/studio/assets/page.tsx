import Image from "next/image";
import { StudioPlaceholder } from "@/components/studio-placeholder";
import { StatusLamp } from "@/components/ui";

export default function AssetsPage() {
  return (
    <StudioPlaceholder
      eyebrow="Rights-first pipeline"
      title="Asset inventory"
      description="Brand artwork is maintainer-approved. Subject imagery remains unavailable until an exact source and use are approved."
      status="Brand approved · subjects withheld"
    >
      <div className="policy-grid">
        <div>
          <StatusLamp tone="green" label="Approved brand system" />
          <p>The paw-and-gear lockup and its transparent emblem are approved for brand use.</p>
        </div>
        <div>
          <StatusLamp tone="red" label="Subject stand-ins prohibited" />
          <p>No generated Pokémon, workers, workstations, machine parts, or gameplay scenes.</p>
        </div>
        <div>
          <StatusLamp tone="amber" label="Manifest required" />
          <p>
            Source hash, approval scope, file hash, transform, and visibility are recorded for every
            public asset.
          </p>
        </div>
      </div>
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
