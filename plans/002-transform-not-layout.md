# 002 — Animate transform, not layout: route-test progress bar and FAQ chevron

- **Status**: DONE
- **Commit**: a413124
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, ~10 lines

## Problem

Two transitions animate layout properties, which run layout + paint on every frame instead of staying on the compositor.

1. The route-test progress fill animates `width`:

```css
/* styles.css:2643-2649 — current */
.route-test-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--stamp);
  transition: width 420ms var(--ease-out);
}
```

```js
/* script.js:1146 — current (inside renderQuestion) */
    progressBar.style.width = `${percent}%`;
```

2. The FAQ chevron animates `margin` alongside `transform`:

```css
/* styles.css:1330-1344 — current */
.faq-list summary::after {
  ...
  margin-top: -7px;
  ...
  transform: rotate(45deg);
  transition: transform 260ms var(--ease-out), margin 260ms var(--ease-out);
}

.faq-list details[open] > summary::after {
  margin-top: -2px;
  transform: rotate(-135deg);
}
```

The 420ms progress fill is also over the 300ms UI budget.

## Target

```css
/* progress fill: full width, scaled from the left edge */
.route-test-progress-track span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--stamp);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 280ms var(--ease-out);
}
```

```js
/* script.js — target (inside renderQuestion) */
    progressBar.style.transform = `scaleX(${percent / 100})`;
```

```css
/* FAQ chevron: one transform, no margin animation */
.faq-list summary::after {
  ...
  margin-top: -7px;
  transform: rotate(45deg);
  transition: transform 260ms var(--ease-out);
}

.faq-list details[open] > summary::after {
  transform: translateY(5px) rotate(-135deg);
}
```

(`translateY(5px)` reproduces the old `-7px → -2px` margin shift.)

## Repo conventions to follow

- Curves come from `var(--ease-out)` (`styles.css:68`).
- Exemplar of transform-only motion: `.service-index svg` (`transition: transform 220ms var(--ease-out), color 160ms ease;`).

## Steps

1. `styles.css`, `.route-test-progress-track span`: replace the block with the target above.
2. `script.js`, in `renderQuestion`: replace `progressBar.style.width = \`${percent}%\`;` with `progressBar.style.transform = \`scaleX(${percent / 100})\`;`.
3. `styles.css`, `.faq-list summary::after`: change the transition to `transition: transform 260ms var(--ease-out);`.
4. `styles.css`, `.faq-list details[open] > summary::after`: remove `margin-top: -2px;` and set `transform: translateY(5px) rotate(-135deg);`.

## Boundaries

- Do NOT change the progress label/percent text logic.
- Do NOT touch the `::details-content` height transition (an accordion height transition is the accepted pattern there).
- If excerpts do not match, STOP and report.

## Verification

- **Mechanical**: `node --check script.js` exits 0; `grep -n "transition: width\|margin 260ms" styles.css` prints nothing.
- **Feel check**:
  - `/rota-testi/`: answer questions; the fill grows from the left edge without its rounded end squashing badly (at small scales the radius compresses; at ≥13% it should read fine).
  - Press Geri: the fill shrinks smoothly from its current width.
  - FAQ: open and close an item; the chevron flips and drops slightly in one motion, ending in the same position as before.
  - Performance panel: no Layout events during either transition.
- **Done when**: no transition in the repo animates `width` or `margin`.
