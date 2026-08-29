---
name: design-review
description: Runs an on-demand design and typography review of the jianart.com portfolio site by serving it locally and inspecting the rendered pages at 1728, 1440, 1200, 834, and 390px. Checks heading hierarchy, type scale, line length, contrast, layout balance on wide viewports, spacing rhythm, and reduced-motion behavior, then reports findings ranked by severity with concrete fixes. Use when the user asks for a design review, typography audit, readability or hierarchy check, or asks whether the site still looks fresh and balanced.
disable-model-invocation: true
---

# Design Review — jianart.com

Audits rendered pages against the system in [reference.md](reference.md). Findings only — do not edit files unless the user asks.

## Progress checklist

```
- [ ] 1. Serve this repo and verify the CSS
- [ ] 2. Open the page, cache-bust, confirm bytes match
- [ ] 3. Sweep 1728 / 1440 / 1200 / 834 / 390px
- [ ] 4. Run the checks
- [ ] 5. Report by severity
```

## 1. Serve this repo and verify the CSS

There is a **second copy of this site** at `~/Documents/Development/JianArt`, usually served on **port 4173**. Reviewing it silently produces conclusions about stale files. Always use the script — it picks a free port in 5180–5220, refuses 4173, and aborts unless the served `style.css` hashes identically to the working tree.

```bash
bash .cursor/skills/design-review/scripts/serve.sh
```

Record `PORT`, `PID`, and `CSS_BYTES` from the output. Stop the server with `kill <PID>` when finished. If it prints an error, resolve it before continuing — never fall back to a manually started server.

## 2. Open the page and cache-bust

`<link rel="stylesheet">` carries no version query, so the browser caches `style.css` hard. Navigate to `http://127.0.0.1:<PORT>/?cb=<timestamp>`, then force the stylesheet to reload and confirm the byte count matches `CSS_BYTES`:

```js
document.querySelectorAll('link[rel=stylesheet]').forEach(l => {
  const u = new URL(l.href); u.searchParams.set('v', Date.now()); l.href = u.href;
});
fetch('/assets/css/style.css?v=' + Date.now()).then(r => r.text()).then(t => t.length);
```

If the length differs from `CSS_BYTES`, stop and fix the cache before drawing any conclusions.

## 3. Sweep the viewports

Resize with `browser_cdp` → `Emulation.setDeviceMetricsOverride` (`deviceScaleFactor: 2`, `mobile: true` only at 390):

`1728×1080` · `1440×900` · `1200×800` · `834×1112` · `390×844`

At each width: scroll to the bottom so every `.reveal` fires, take a screenshot, then run the audit script:

```bash
cat .cursor/skills/design-review/scripts/audit.js
```

Paste its contents into `Runtime.evaluate` with `returnByValue: true`. It returns computed type metrics, measured characters per line, heading order, horizontal overflow, sub-44px targets, and containers filling under 60% of their width.

Cover `/`, `/about/`, and at least two case studies with different structures — one image-heavy (`/designs/motive/`) and one section-heavy (`/designs/uber-data-intelligence/`).

## 4. Checks

**Hierarchy** — one `<h1>` per page, no skipped levels. Each step in the scale must be visually distinct at the current width; flag adjacent levels rendering within ~2px of each other. Weight is 400 except `.nav-brand span` and `.btn` at 500. Tracking tightens as size grows.

**Readability** — body copy at 60–75 characters per line (`charsPerLine` in the audit output). Over 85 is a finding; over 100 is major. Contrast ≥4.5:1 for body, ≥3:1 for text above 24px. Watch for a single orphan word on the last line of a heading.

**Layout balance** — the recurring failure here is wide viewports: a 620–868px column stranded beside several hundred pixels of empty container. At 1728 and 1440px check whether headline, lede, and button read as one composition or as a narrow strip pinned left. Use the `voids` array. Conversely, at 390 and 834px check nothing is cramped or overflowing.

**Spacing rhythm** — section gaps should step down predictably across breakpoints, not collapse at one width. Verify that `--container-pad` changes at 1100/800/480 land cleanly.

**Motion** — reload with reduced motion on (`Emulation.setEmulatedMedia`, `features: [{name: 'prefers-reduced-motion', value: 'reduce'}]`) and confirm all content is visible and static: no hidden `.reveal`, no drifting dots, glows, or logo gradients. Then with motion on, confirm stagger reads as a cascade rather than simultaneous or sluggish.

## 5. Report

```markdown
## Design review — <date>
Served on port <PORT>, CSS verified (<bytes> bytes). Viewports: 1728, 1440, 1200, 834, 390.

### Critical
- **<Issue>** — `path:selector` at <width>px. <What renders and why it is wrong.>
  Fix: <specific change, with values.>

### Major
### Minor
### Passing
- <What held up well, so the user knows it was checked.>
```

Severity: **Critical** = unreadable, broken, or inaccessible (contrast failures, overflow, skipped headings, missing reduced-motion fallback). **Major** = visibly weakens hierarchy or balance at a common width (line length over 100 characters, stranded columns at 1440px+). **Minor** = polish and consistency drift (an off-scale size, a radius outside `--radius`).

Every finding names the file and selector and states the replacement value. Report the items already listed under "Known inconsistencies" in [reference.md](reference.md) only if the review confirms they cause a visible problem — the user already knows about them.
