# Animation plans

Written by an `improve-animations` audit of commit `a413124` (branch `redesign/apple-documents`). Each plan is self-contained; this folder is excluded from deployment in `.vercelignore`.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Exits use ease-out, not ease-in](001-exits-ease-out.md) | HIGH | DONE |
| 002 | [Animate transform, not layout](002-transform-not-layout.md) | MEDIUM | DONE |
| 003 | [Reduced motion for the route-test scroll](003-reduced-motion-scroll.md) | MEDIUM | DONE |
| 004 | [Motion polish](004-motion-polish.md) | LOW | DONE |

## Order and dependencies

Run in number order. None depends on another; 002 and 004 both edit the FAQ rules in `styles.css`, so apply them one after the other, not in parallel.

## Missed opportunities (not planned)

- **Contact form success** (`contact.js`, `[data-contact-status]`): a rare, high-emotion moment shown as a plain line of text. A short settle-in (opacity + `translateY(6px)`, 260ms ease-out) would be within the delight budget. Worth doing once FormSubmit delivery is confirmed live.
- **Document shelves** (`.doc-shelf__row`): on desktop there is no hint that the row scrolls sideways. An edge fade mask (`mask-image`) is a static fix, not motion; listed here so it is not solved with an animation.

## Checked and left alone

- Dialog entrances use `@keyframes sheet-in` (420–460ms, `--ease-sheet`): one-shot, occasional, within the modal budget.
- Modals scale from center: correct for modals.
- The deck's rAF springs: gesture-driven, interruptible, velocity-aware; CSS would be worse here.
- `transition: … ease` on hover colors and backgrounds: correct curve for color changes.
- The FAQ `::details-content` height transition: the accepted accordion pattern.
