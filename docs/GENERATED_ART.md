# Brand and generated interface art

The website uses one maintainer-approved Cobblemon Kinetics brand system and one neutral empty-state illustration. It does not publish generated Pokémon, creature stand-ins, workers, Minecraft or Create machines, registry icons, item sprites, or gameplay scenes.

No Create, Minecraft, Cobblemon, Pokémon, PokéAPI, or add-on image was supplied as a visual reference or extracted into this repository.

## Approved brand system

The approved paw-and-gear lockup and its derivatives live under `apps/web/public/brand`. The brand manifest records the immutable source hash, each public derivative, transform, dimensions, visibility, and approval boundary.

Daniel approved the direction on 2026-08-14. OpenAI's built-in image-generation tool created the master and chroma-key variant sources from a user-provided generated concept used only for composition and symbol guidance. The source concept is identified by hash but is not redistributed. Flat-key backgrounds were removed locally at source resolution before deterministic icon and social-image derivatives were produced.

The logo is approved only for project identity and marketing. It must not be reused as species art, a machine binding, an inventory item, or an in-game asset.

The Next.js application icon, Apple touch icon, favicon, Open Graph image, and Twitter image are deterministic crops or scales of the approved brand art. They introduce no new subject matter.

## Generated interface illustrations

Only these neutral website illustrations remain under `apps/web/public/art/generated`:

| File                   | Permitted use                                |
| ---------------------- | -------------------------------------------- |
| `empty-workbench.webp` | Empty, unavailable, and search-result states |

They are interface decoration only and must never be presented as actual game content.

## Subject-art policy

- Do not generate Pokémon, lookalike creatures, generic workers standing in for a species, machines, machine parts, item sprites, or gameplay demonstrations.
- Do not extract or publish third-party game art without an exact source, license, attribution, visibility decision, and maintainer approval.
- Until an asset passes that review, show structured facts, National Dex numbers, namespaced registry identifiers, and an explicit “visual pending approved source” state.
- Keep source and output hashes in the appropriate public manifest.
