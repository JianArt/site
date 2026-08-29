# jianart.com design system reference

Extracted from `assets/css/style.css`. Use these as the expected values when auditing.

## Tokens

```
--bg #0a0908   --text #ffffff   --text-secondary rgba(255,255,255,.72)
--muted #7a7a7a   --gold #d1bb77   --font 'Gabarito', sans-serif
--container-max 1440px   --radius 8px
--container-pad  100px → 56px (≤1100) → 32px (≤800) → 16px (≤480)
--nav-height      82px → 72px (≤800) → 64px (≤480)
--grid-gap        16 / 14 / 12 / 10px   ← declared but never consumed
```

## Type scale

| Selector | Size | Weight | Line-height | Tracking | Color |
|---|---|---|---|---|---|
| `.hero h1` | `clamp(34px, 7vw, 83px)` | 400 | 1.15 | `-0.03em`, `-0.02em` ≤480 | `--text` |
| `.about-hero h1:first-child` | `clamp(32px, 6vw, 56px)` | 400 | — | — | `--gold` |
| `.about-hero h1.statement` | `clamp(24px, 4.5vw, 44px)` | 400 | 1.3 | — | `--text` |
| `.cta h2` | `clamp(28px, 5.5vw, 48px)`; ≥1100px `clamp(44px, 4vw, 60px)` | 400 | 1.15 | `-0.02em` | `--text` |
| `.section-heading` | 22px, 20px ≤800 | 400 | — | — | `--text` |
| `.feature h3`, `.notables-grid h3` | 20px, 18px ≤700 | 400 | — | — | `--text` |
| body / `p` | 16px, 15px/1.6 ≤700 | 400 | 1.5 | — | `--text-secondary` |
| `.hero-lede` | 16px | 400 | 1.5 | — | `--text-secondary` |
| `.cta-lede` | 16px | 400 | 1.55 | — | `--text-secondary` |
| `.btn` | 15px | 500 | — | `0.02em` | `#0a0908` on `--gold` |
| `.nav-links a` | 15px, 14px ≤480 | 400 | — | — | `--text-secondary` |
| `.nav-brand span` | 14px, 13px ≤800 | 500 | — | `2.4px`, `1.6px` ≤800 | `--gold` |
| `.project-card-label span` | 16px, 15px ≤480 | 400 | — | `0.01em` | `--gold` |
| `.copyright` | 13px, 12px ≤480 | 400 | — | `0.02em` | `--muted` |

## Measure

`.content-col` 868 · `.about-bio` 868 · `h1.statement` 900 · `.hero-lede` 720 · `.cta h2` 720 (`min(1080px,100%)` ≥1100) · `.cta-lede` 620 (720 ≥1100)

Target for body copy: **60–75 characters**. At 16px Gabarito that is roughly 640–760px.

## Breakpoints

`max-width`: 1100, 900 (project grid), 800, 700 (feature/gallery/notables/logo-row), 480, 380 (logo-row).
Plus `(min-width: 1100px)` for the CTA, `(hover: none)`, `(prefers-reduced-motion: reduce)`.

## Motion

- `.reveal` → `.is-visible`: opacity 1.15s, transform 1.25s, blur 1.1s, all `cubic-bezier(0.16, 1, 0.3, 1)`, offset by `var(--reveal-delay, 0ms)`.
- Variants: `.hero-line.reveal` (24px rise, no blur), `.project-card.reveal` (40px rise; image +90ms, label +220ms, `.is-settled` after delay + 900ms).
- `reveal.js` overwrites `--reveal-delay` on project cards: 0/120ms pairs plus a 70ms document-order cascade.
- Ambient: `dot-drift` 120s linear, `glow-drift` 28s alternate, five `logo-grad-drift-*` 8–11s.
- Five `prefers-reduced-motion: reduce` blocks exist — body layers, nav, project cards, logo cards, reveals.

## Known inconsistencies (report, do not silently "fix")

1. `--grid-gap` is defined and responsively overridden but never used; grid gaps are hard-coded (28/30/32/40/20/10px).
2. Radii diverge from `--radius: 8px` — `.btn` 6px, `.logo-card` 3px, `.project-card` 6px ≤480px, and inline `border-radius:10px` on two gallery images.
3. Hard-coded colors that should be tokens: `#0a0908` (`.btn` text), `#0c0b0a` (`.logo-card`), `#e0cf9a` (`.btn:hover`), plus `rgba(209,187,119,…)` ×4 and `rgba(10,9,8,…)` ×5.
4. `about/index.html` has two `<h1>` elements.
5. `.cta h2` steps *down* from 48px to 44px when crossing 1100px upward, because the `min-width: 1100px` clamp restarts at 44px.
6. `.content-col` and `.about-bio` at 868px render body copy at roughly 100–110 characters per line.
7. Breakpoint ladder has six `max-width` values; 900px and 380px are each used once.
8. `.nav-links a` renders ~38px tall, below the 44px touch-target floor.
9. Body copy has three line-heights: 1.5, 1.55 (`.cta-lede`), 1.6 (≤700px).
10. The `<link rel="stylesheet">` tags have no version query, so browsers cache `style.css` aggressively.
