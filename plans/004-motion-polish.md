# 004 — Motion polish: subtler press scale, ease-out entrances, budgeted accordion, anchored consent banner

- **Status**: DONE
- **Commit**: a413124
- **Severity**: LOW
- **Category**: Physicality & origin / Cohesion & tokens
- **Estimated scope**: 1 file, ~8 small edits

## Problem

Four small inconsistencies, all in `styles.css`:

1. **Press scale too strong.** Small icon buttons squash past the 0.95–0.98 range:
   ```css
   /* styles.css:580-583 */
   .mobile-menu-toggle:active,
   .mobile-menu-close:active {
     transform: scale(0.92);
     ...
   }
   /* styles.css:930-932 */
   .icon-button:active {
     transform: scale(0.9);
   }
   ```
2. **Bare `ease` on entrances.** Scrims fade in on the weak built-in curve:
   ```css
   .mobile-nav-overlay { transition: opacity 220ms ease; }          /* styles.css:633 */
   .pilot-notice__overlay { animation: scrim-in 260ms ease both; }  /* styles.css:3058 */
   .consent-settings-overlay { animation: scrim-in 260ms ease both; }
   .document-modal__backdrop { animation: scrim-in 260ms ease both; }
   ```
3. **Accordion over budget.** The FAQ answer opens in 320ms:
   ```css
   /* styles.css:1370-1373 */
   transition:
     height 320ms var(--ease-out),
     opacity 220ms ease,
     content-visibility 320ms allow-discrete;
   ```
4. **Consent banner origin.** The banner sits in the bottom-right corner but scales in (`sheet-in`, `scale(0.97)`) from its center.

## Target

1. `.mobile-menu-toggle:active, .mobile-menu-close:active { transform: scale(0.95); }` and `.icon-button:active { transform: scale(0.95); }`.
2. Every `scrim-in … ease` and the `.mobile-nav-overlay` opacity transition use `var(--ease-out)`; durations unchanged.
3. FAQ: `height 260ms var(--ease-out), opacity 200ms var(--ease-out), content-visibility 260ms allow-discrete`.
4. `.consent-banner { transform-origin: bottom right; }` (mobile, where it spans the width: `transform-origin: bottom center;`).

## Repo conventions to follow

- Token `--ease-out` at `styles.css:68`.
- Exemplar press feedback: `.button:active { transform: scale(0.97); transition-duration: 80ms; }` (`styles.css:372-375`).

## Steps

1. Edit the two `:active` rules in item 1 to `scale(0.95)`.
2. Replace `ease both` with `var(--ease-out) both` in the three `scrim-in` animations, and `transition: opacity 220ms ease;` with `transition: opacity 220ms var(--ease-out);` in `.mobile-nav-overlay`.
3. Replace the FAQ `::details-content` transition with the target in item 3.
4. Add `transform-origin: bottom right;` to `.consent-banner`; inside the existing `@media (max-width: 640px) { .consent-banner { … } }` block add `transform-origin: bottom center;`.

## Boundaries

- Do NOT change `.button:active`, hover colors, or any `transition: … ease` used for color/background changes (bare `ease` is correct for color).
- Do NOT touch keyframe definitions.
- If excerpts do not match, STOP and report.

## Verification

- **Mechanical**: `grep -n "scale(0.9)\|scale(0.92)\|scrim-in 260ms ease" styles.css` prints nothing.
- **Feel check**:
  - Tap the deck arrows and the mobile menu button: the press is felt but the icon no longer visibly shrinks.
  - Open a FAQ item: it opens noticeably quicker but still smoothly.
  - First visit at desktop width: the consent banner grows out of the bottom-right corner.
  - Scrims arrive quickly and settle, rather than easing in.
- **Done when**: all four items match the target.
