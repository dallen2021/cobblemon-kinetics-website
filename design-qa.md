# Design QA — Workshop Ledger

## Target

- Selected direction: Workshop Ledger.
- Reference artifact: Workshop Ledger light-mode concept (`exec-60b18ebc-adcb-474c-a6dc-0b97db6b2cbe.png`).
- Approved brand artifact: Cobblemon Kinetics stacked lockup (`exec-c67882bf-801d-4559-8236-812cfc43a26a.png`).
- QA viewport: 1504 × 1024.
- Comparison method: reference and live browser capture viewed side by side at the same rendered size.

## Visual comparison

The implementation preserves the reference's cream ledger canvas, dark graphite navigation and inspector rails, brass dividers and actions, teal selection states, compact record workspace, and fixed three-column composition. The production interface intentionally uses less decorative chrome than the concept so long forms remain readable and responsive. All text and controls are live interface elements rather than baked into imagery.

## Interaction states checked

- Light theme with both rails expanded at 1504 × 1024.
- Dark theme with both rails expanded.
- Left rail collapsed with the brand emblem retained.
- Right inspector collapsed with a persistent reopen control.
- Both rails collapsed and restored after reload.
- Mobile navigation and inspector drawers at 390 × 844.
- Escape closes a mobile drawer and returns focus to its trigger.
- Theme and panel preferences persist across navigation and reload.

## Responsive and accessibility checks

- No horizontal overflow at 1504 px or 390 px.
- Body copy remains at least 16 px and primary controls remain 44 px or taller.
- Panel controls expose `aria-expanded` and `aria-controls` state.
- Hidden drawer content is removed from keyboard interaction.
- Status is communicated with text as well as color.
- Reduced-motion and forced-color rules remain available.
- Browser console contains no warnings or errors from the application.

## Asset policy

- The approved Cobblemon Kinetics emblem and wordmark are project-owned generated brand assets with tracked provenance.
- No generated Pokémon, Poké Ball, Minecraft block, Cobblemon model, Create machine, or add-on machine imagery is shipped.
- Species and machine records use neutral text treatments until separately sourced assets pass rights and provenance review.

## Result

final result: passed
