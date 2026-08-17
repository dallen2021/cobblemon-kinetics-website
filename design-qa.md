# Design QA — Workshop Ledger

## Target

- Selected direction: Workshop Ledger.
- Reference artifact: Workshop Ledger light-mode concept (`exec-60b18ebc-adcb-474c-a6dc-0b97db6b2cbe.png`).
- Approved brand artifact: Cobblemon Kinetics stacked lockup (`exec-c67882bf-801d-4559-8236-812cfc43a26a.png`).
- QA viewports: 1487 × 1058 for the approved reference comparison, 1504 × 1024 for the existing desktop contract suite, and 390 × 844 for mobile.
- Comparison method: reference and live browser capture viewed side by side at the same rendered size.

## Visual comparison

The implementation preserves the reference's cream ledger canvas, dark graphite navigation and inspector rails, brass dividers and actions, teal selection states, compact record workspace, and fixed three-column composition. Three purpose-built, transparent nine-slice textures now supply the heavy outer shell, steel panel/rail edges, and brass priority states. The production interface intentionally uses less decorative chrome than the concept so long forms remain readable and responsive. All text and controls remain live interface elements rather than baked into imagery.

The navigation refinement matches the requested hierarchy: the project emblem renders at 124 × 124 px above a 16 px live brand name, while the navigation control is now a single caret on the far-right edge of the same 44 px row as “Development studio.” Collapsed mode retains a square 52 × 52 px emblem and reverses the caret without distorting the logo.

## Interaction states checked

- Light theme with both rails expanded at 1504 × 1024.
- Dark theme with both rails expanded.
- Left rail collapsed with the brand emblem retained.
- Left navigation caret aligned to the sidebar's inner divider, with a 44 × 44 px target and no label overlap.
- Right inspector collapsed with a persistent reopen control.
- Both rails collapsed and restored after reload.
- Mobile navigation and inspector drawers at 390 × 844.
- The internal caret, inspector close control, scrim, and Escape close mobile drawers and return focus to the correct toolbar trigger.
- Theme and panel preferences persist across navigation and reload.
- Heavy, steel, and brass frame assets load and decode in both themes.
- Generated frame borders remain attached through all four desktop rail states and both mobile drawers.

## Responsive and accessibility checks

- No horizontal overflow at 1504 px or 390 px.
- Body copy remains at least 16 px and primary controls remain 44 px or taller.
- Panel controls expose `aria-expanded` and `aria-controls` state.
- Caret controls retain full “Hide navigation” and “Show navigation” accessible names and focus-visible treatment despite having no visible text.
- Hidden drawer content is removed from keyboard interaction.
- Status is communicated with text as well as color.
- Reduced-motion and forced-color rules remain available.
- Browser console contains no warnings or errors from the application.
- Forced-colors mode suppresses decorative raster frames and restores visible system-color borders.
- Frame PNGs have transparent centers, exact hash-pinned dimensions, and no residual chroma pixels.

## Asset policy

- The approved Cobblemon Kinetics emblem and wordmark are project-owned generated brand assets with tracked provenance.
- No generated Pokémon, Poké Ball, Minecraft block, Cobblemon model, Create machine, or add-on machine imagery is shipped.
- Species and machine records use neutral text treatments until separately sourced assets pass rights and provenance review.
- Generated borders contain interface geometry only; their prompts, transformations, dimensions, slices, and hashes are recorded in `docs/GENERATED_ART.md` and the public frame manifest.
- Installed Create and Cobblemon PNGs can be reviewed only through the authenticated loopback Studio route. They remain under ignored `.private`, use no-store delivery, and are never treated as approved production art.
- The source browser identifies raw UV maps, atlases, and component textures honestly rather than presenting them as finished species portraits or machine icons.
- Production output tracing excludes the ignored `.private` tree; the local gallery route trace contains zero third-party source files.
- ZIP entries are size-limited before decompression, streamed with CRC verification, fully PNG-decoded within a pixel cap, and written through canonical non-symlink directories.

## Result

final result: passed
