# jianart.com — notes for agents

Hand-written static portfolio on GitHub Pages. No build step, no dependencies.
Everything on `main` deploys live within a minute. Only push to `main` where
"Scheduled agents" below allows it; otherwise work on a branch and open a pull
request for Jian to review.

Preview locally with `python3 -m http.server 5190` and open http://127.0.0.1:5190/.

Type, color, spacing and motion tokens live in `.cursor/rules/jianart-design-system.mdc`.
Follow it: no new font sizes, colors, radii or breakpoints.

## The hero dot field (`assets/js/data-weather.js`)

One canvas of gold dust sits behind every page. On pages whose hero has
`hero--cinema`, the dust periodically condenses into a slowly turning 3D solid
made only of dots, holds, then releases:

- dust 5.6s, form 2.6s, hold 5.2s, release 2.6s; the first hold starts ~8s after load
- scrolling slides the field with the page and scatters the dots (it never shrinks the solid)
- the home page rotates 5 random solids from `SHAPE_NAMES` per visit
- a case-study page names its own solid with `data-shape="..."` on the hero
  (`PROJECT_NAMES` holds the project set)
- `?shape=name` on any page loops one solid, for previewing
- `LAB_NAMES` holds solids that only appear through `?shape=`; Jian promotes a lab
  solid by moving its name into `SHAPE_NAMES`

To add a solid: add its name (lowercase letters only) to `LAB_NAMES`,
`SHAPE_NAMES` (home rotation) or `PROJECT_NAMES` (case studies), give it a
camera in `orient()`, and build its points in
`extraPoint()` (static) or `projLive()` (animated; every point is recomputed each
frame from its per-dot random numbers). Shapes are centered automatically by
their bounding box. Units are roughly ±1.2 wide and ±0.7 tall.

Per-point channels: `e` brightness 0–1 (above 0.7 draws cream), `glow` 0–1
(cream plus a larger dot), `lit` forces cream on or off, `fe` 0–1 fades a point
at the edges of a moving stream.

### Hard rules for the dot field

- Dots only. No lines, strokes, fills or connecting segments. Dense rows of beads
  that read as lines count as lines.
- Gold `#d1bb77` and cream only, on `#0a0908`.
- Never pulse opacity. Breathing and heartbeats are changes of size or position.
- No hover, pointer or scroll-linked interaction beyond the existing scroll scatter.
- `prefers-reduced-motion`: one still frame, nothing animates.
- The title stays readable; the field dims behind it.
- Keep one frame of `draw()` under ~12ms at 1920×1080 on a laptop. Anything per
  cell that does not depend on time belongs in `buildCells()`.
- Rejected ideas; do not bring them back: stacked ridge layers, particle hover or
  gusts, morphing into a sparkline, polar spiderweb charts, a virus, a spiral
  galaxy, a drone swarm, globe columns.

### Checking a shape

Load `/?shape=name`, wait about 13 seconds (inside the first hold), and
screenshot the hero. Check it at 1440px and 390px wide. If the browser tab is
hidden, `requestAnimationFrame` does not fire; override it and pump frames
manually before reading the canvas.

## Cursor Cloud specific instructions

Start the preview with `python3 -m http.server 5190` from the repo root before
opening a browser. Keep the page tab in front and wait about 13 seconds after
load before any screenshot of the hero, or it shows only loose dust.

## Cache busting

Pages load `style.css`, `data-weather.js` and `reveal.js` with a `?v=` query.
When you change one of them, bump its version on **all** HTML pages
(`index.html`, `about/index.html`, `designs/*/index.html`).

## Scheduled agents

**Dot Studio** (daily) may push straight to `main`, but only to add one new
solid to `LAB_NAMES`, never to change a live solid, `SHAPE_NAMES`,
`PROJECT_NAMES` or anything outside `data-weather.js` and its `?v=` bumps.
Before pushing, check the shape as described above and confirm no console errors
on `/` and one case study. Commit message: `Dot Studio: add <name> to the lab`.
Changes to live solids go through a pull request.

**Site Health** (daily) may push straight to `main` for objective fixes only:
broken links or images, missing alt text, heading order, oversized images,
missing meta tags, console errors. Before pushing, load every changed page at
390px and 1440px with no console errors and nothing visibly different except the
fix. Anything that changes the look of a page, or any judgement call, goes
through a pull request instead. Commit message: `Site Health: <fix>`.

**Elegance Review** (weekly) never pushes to `main`; it always opens a pull request.

For every agent:

- One topic per commit or pull request, small enough to review in a few minutes.
- Titles and commit messages start with the agent's name.
- Pull requests include before and after screenshots for anything visual, and
  put judgement calls in the description as suggestions instead of making them.
- If your previous pull request is still open, do not open another one.
- If a direct push would conflict with `main`, stop and open a pull request.
- Leave `assets/data/*.json` alone; the climate workflow owns it.
