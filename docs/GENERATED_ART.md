# Brand and generated interface art

The website uses one maintainer-approved Cobblemon Kinetics brand system, one neutral empty-state illustration, and three generated interface-only frame textures. It does not publish generated Pokémon, creature stand-ins, workers, Minecraft or Create machines, registry icons, item sprites, or gameplay scenes.

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

## Generated interface frame set

The responsive Workshop Ledger shell uses three original nine-slice frame textures under `apps/web/public/art/interface/frames`. Their public manifest pins each output hash, exact dimensions, border slice, chroma-source hash, intermediate hash, generation method, and subject boundary.

| File                     | Dimensions | Slice | Permitted use                                     |
| ------------------------ | ---------- | ----- | ------------------------------------------------- |
| `studio-frame-heavy.png` | 512×512    | 56 px | Heavy outer Studio shell frame                    |
| `panel-frame-steel.png`  | 256×256    | 20 px | Neutral panels, tables, pickers, slots, controls  |
| `panel-frame-brass.png`  | 256×256    | 20 px | Priority panels, selected states, primary actions |

The same neutral steel-and-brass assets serve both color themes. The center of every public PNG is transparent so layout, content, color, responsive sizing, focus states, and accessibility remain native web behavior rather than baked artwork.

### Production mode

OpenAI's built-in ImageGen created each source as an image edit with the maintainer-approved generated Workshop Ledger mockup supplied through `referenced_image_paths` for style and material guidance only. The mockup did not supply or authorize Pokémon, machine, item, game, or other subject art.

Each generated chroma source was downsampled with `sips` to its exact public dimensions. `remove_chroma_key.py` then removed explicit `#FF00FF` using soft matte thresholds `20/150` with despill. The public outputs are lossless sRGB RGBA PNG files with transparent centers and no baked text, content, cast shadow, Pokémon, or machine art.

### Production prompts

#### Heavy structural frame

```text
Use case: ui-mockup. Asset type: production nine-slice border texture for a responsive web application. Input image: style and material reference only; do not reproduce its layout, text, logo, creature, or content. Primary request: create one original front-facing square heavy structural UI frame. The frame is a continuous square border touching all four canvas edges with zero exterior margin. Materials: charcoal and blackened-andesite steel rails, crisp block-stepped voxel silhouettes, restrained subtle wear, evenly spaced tiny square steel rivets, aged-brass corner clamps with one centered square fastener, and a thin warm-copper inner lip. Four corners must be visually consistent as 90-degree rotations. Every edge middle section must be perfectly straight, uniform, and seamlessly tileable for CSS nine-slice scaling. Center: one very large perfectly flat solid #FF00FF empty square occupying roughly 62.5% of width and height, with no texture, shadow, lighting, reflection, or gradient. Style: premium original block-game / pixel-industrial interface asset, chunky readable geometry, less realistic and less ornate than the reference, orthographic front view, lossless texture-design clarity. Constraints: no text, no letters, no logo, no paw, no cat ears, no creature, no Poké Ball, no Pokémon, no Minecraft or Create assets, no machine, no buttons, no controls, no content, no background scene, no perspective, no cast shadow, no glow, no gradient in the chroma field. Do not use #FF00FF anywhere in the frame. Output one centered square frame only.
```

#### Steel panel frame

```text
Use case: ui-mockup. Asset type: production nine-slice medium panel border texture for a responsive web application. Use the provided Workshop Ledger mockup only as material and proportion reference; do not reproduce its page, content, text, logo, characters, or machines. Create one original front-facing square restrained dark-andesite and blackened-steel frame touching all four canvas edges with zero exterior margin. Compact squared steel corner brackets, four tiny aged-brass fasteners, narrow warm inner highlight, sparse square rivets, subtle block-texture wear. Four corners must be visually consistent rotations. Edge middles must be perfectly straight, uniform, and seamlessly tileable for CSS nine-slice scaling. A very large perfectly flat solid #FF00FF square fills the center, with no texture, shadow, lighting, reflection, or gradient. Premium original pixel-industrial/block-game interface style, orthographic, crisp, stylized, not photorealistic, restrained detail readable at 6–8 CSS pixels. No text, letters, logo, paw, cat ears, creature, Poké Ball, Pokémon, Minecraft/Create asset, machine, item, button, content, background scene, perspective, cast shadow, glow, gears, or large ornament. Do not use #FF00FF in the frame. Output one centered square frame only.
```

#### Brass priority frame

```text
Use case: ui-mockup. Asset type: production nine-slice priority/control border texture for a responsive web application. Use the provided Workshop Ledger mockup only as material and proportion reference; do not reproduce its page, content, text, logo, characters, or machines. Create one original front-facing square compact aged-brass and warm-copper frame over a narrow charcoal-steel backing, touching all four canvas edges with zero exterior margin. Squared brass corner caps, small dark square rivets, subtle block-texture wear, restrained warm inner bevel. Four corners must be visually consistent rotations. Edge middles must be perfectly straight, uniform, and seamlessly tileable for CSS nine-slice scaling. A very large perfectly flat solid #FF00FF square fills the center, with no texture, shadow, lighting, reflection, or gradient. Premium original pixel-industrial/block-game interface style, orthographic, crisp, stylized, not photorealistic, restrained detail readable at 5–7 CSS pixels. No text, letters, logo, paw, cat ears, creature, Poké Ball, Pokémon, Minecraft/Create asset, machine, item, button, content, background scene, perspective, cast shadow, glow, gears, or large ornament. Do not use #FF00FF in the frame. Output one centered square frame only.
```

These prompts define an interface texture workflow only. They must not be adapted to produce Pokémon, creature, worker, machine, item, block, registry, or gameplay imagery.

## Subject-art policy

- Do not generate Pokémon, lookalike creatures, generic workers standing in for a species, machines, machine parts, item sprites, or gameplay demonstrations.
- Do not extract or publish third-party game art without an exact source, license, attribution, visibility decision, and maintainer approval.
- Until an asset passes that review, show structured facts, National Dex numbers, namespaced registry identifiers, and an explicit “visual pending approved source” state.
- Keep source and output hashes in the appropriate public manifest.
