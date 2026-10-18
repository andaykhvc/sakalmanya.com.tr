# 001 — Make exits start fast: replace the ease-in exit curve with ease-out

- **Status**: DONE
- **Commit**: a413124
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 2 files, 2 one-line edits

## Problem

Every surface that closes (pilot notice, route-test prompt, document viewer, consent banner and settings, mobile drawer) leaves on an **ease-in** curve. Ease-in starts slow, so the first ~60ms after the tap barely move: the exact moment the user is watching for a response. On a 180–220ms exit that reads as lag.

```js
/* script.js:18-25 — current */
const playExit = (element, keyframes, duration = 180) => {
  if (!element || typeof element.animate !== "function") return Promise.resolve();
  element.style.pointerEvents = "none";
  const animation = element.animate(reducedMotionQuery.matches ? fadeExit : keyframes, {
    duration,
    easing: "cubic-bezier(0.4, 0, 1, 1)",
    fill: "forwards",
  });
```

```css
/* styles.css:659 — current (.mobile-nav-drawer, closed state) */
  transition: transform 220ms cubic-bezier(0.4, 0, 1, 1);
```

The mobile drawer is opened and closed many times per session on phones, so this is the highest-frequency exit on the site.

## Target

Exits use the site's strong ease-out token. Durations stay as they are (180ms default, 200ms viewer/banner, 220ms drawer), all inside the 200–500ms modal/drawer budget.

```js
/* script.js — target */
  const animation = element.animate(reducedMotionQuery.matches ? fadeExit : keyframes, {
    duration,
    easing: easeOut,
    fill: "forwards",
  });
```

```css
/* styles.css — target (.mobile-nav-drawer, closed state) */
  transition: transform 220ms var(--ease-out);
```

## Repo conventions to follow

- CSS easing tokens live on `:root` in `styles.css:68-69`: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1);` and `--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);`.
- The JS mirror of `--ease-out` is `const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";` at `script.js:12`. Exemplar using it correctly: the route-test question swap at `script.js:1134-1138` (`{ duration: 240, easing: easeOut }`).

## Steps

1. `script.js`, inside `playExit`: change `easing: "cubic-bezier(0.4, 0, 1, 1)",` to `easing: easeOut,`.
2. `styles.css`, rule `.mobile-nav-drawer` (closed state, around line 659): change `transition: transform 220ms cubic-bezier(0.4, 0, 1, 1);` to `transition: transform 220ms var(--ease-out);`.
3. Search both files for any remaining `cubic-bezier(0.4, 0, 1, 1)`; there should be none.

## Boundaries

- Do NOT change durations or keyframes.
- Do NOT touch the open-state curve `.mobile-nav-drawer.is-open { transition: transform 460ms var(--ease-sheet); }`.
- Do NOT add dependencies.
- If the excerpts above do not match the file, STOP and report.

## Verification

- **Mechanical**: `node --check script.js` exits 0. `grep -c "0.4, 0, 1, 1" script.js styles.css` prints 0 for both.
- **Feel check**:
  - Open and close the pilot notice and the document viewer: the dialog should visibly start moving on the first frame after the tap.
  - On a phone-width viewport, open and close the menu several times quickly; closing should feel as immediate as opening.
  - DevTools Animations panel at 10%: the exit curve's first frames show clear movement, not a slow start.
  - With `prefers-reduced-motion: reduce`, exits are still short fades.
- **Done when**: no ease-in curve remains on any exit.
