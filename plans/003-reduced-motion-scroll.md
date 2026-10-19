# 003 — Respect reduced motion when the route test scrolls back to the top

- **Status**: DONE
- **Commit**: a413124
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, 1 line

## Problem

Restarting the route test smooth-scrolls the page regardless of the user's motion preference. A long page-height scroll is exactly the kind of large movement `prefers-reduced-motion` asks to avoid; the CSS already turns off `scroll-behavior: smooth` for these users, but this JS call bypasses it.

```js
/* script.js:1228-1237 — current */
  restartButton.addEventListener("click", () => {
    ...
    renderQuestion();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("route_test_restart");
  });
```

## Target

```js
    root.scrollIntoView({ behavior: reducedMotionQuery.matches ? "auto" : "smooth", block: "start" });
```

## Repo conventions to follow

- `reducedMotionQuery` is declared once at `script.js:11`; every motion branch reads it (exemplar: `playExit`, `script.js:21`).

## Steps

1. `script.js`, in the `restartButton` click handler: replace `root.scrollIntoView({ behavior: "smooth", block: "start" });` with the target line.

## Boundaries

- Do NOT change any other scrolling.
- If the excerpt does not match, STOP and report.

## Verification

- **Mechanical**: `node --check script.js` exits 0.
- **Feel check**: in DevTools Rendering, emulate `prefers-reduced-motion: reduce`, finish the test, press "Testi yeniden çöz": the page jumps to the test without scrolling animation. Without the emulation it still scrolls smoothly.
- **Done when**: no `behavior: "smooth"` call ignores `reducedMotionQuery`.
