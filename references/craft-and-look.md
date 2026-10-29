# Craft: making it look designed, not generated

Motion that is technically right still looks cheap if the screen around it is the average of every
screen the model has seen. This file is the look half.

## 1. One ground, one ink, one accent

A screen reads "designed" when the palette is a **decision**, not a default:

| Role | This skill's default | Why |
|---|---|---|
| Ground | paper cream `#fbf6ec` | warm, not the blue-white of every dashboard |
| Surface | `#f4ecdd` (a tone step, no border, no shadow) | separation by tone reads calmer than by line |
| Ink | near-black navy `#22282e` | pure `#000` reads harsh on cream |
| Secondary ink | `#5d6871` | for meta and captions |
| Accent | one warm red `#c8452f` | appears on the action and one other thing, never more |
| Supporting | muted tan / slate / olive from the illustrations | taken from the artwork, not added on top |

Banned by default: gradients, glows, glass/backdrop-blur, coloured shadows, more than one accent, five
pastel tints, neon on cream. Shadows only on things that genuinely float (a sheet, a dialog).

## 2. The illustration language: hand-drawn gouache

Reference: the illustrations on **fred.pt** — flat fills, **no outlines**, slightly irregular
hand-cut silhouettes, muted colours, a print grain over the whole image. It reads as painted rather than
as vector.

Reproduce it with three moves (working code: `demo/art.js`):

1. **Hand-cut edges.** Never draw a clean polygon. Subdivide each edge and push the new points off-line,
   then smooth the result:
```js
function rough(pts, seed, jitter = 13) {
  const r = rng(seed), out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    for (let k = 1; k <= 2; k++) {
      const t = k / 3, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const off = (r() - .5) * 2 * jitter;
      out.push([x + (-dy / len) * off, y + (dx / len) * off]);
    }
  }
  return smoothClosed(out);        // Catmull-Rom → cubic bezier
}
```
2. **Flat colour, one per shape, no strokes.** Depth comes from overlapping layers and value, never from
   an outline or a gradient.
3. **Grain over everything.** One `feTurbulence` rect on top, multiplied at low opacity:
```svg
<filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.72"/></feComponentTransfer></filter>
<rect width="600" height="750" filter="url(#gr)" opacity="0.13" style="mix-blend-mode:multiply"/>
```
   Seed the RNG (`mulberry32`-style from a fixed number) so the same picture is produced on every load —
   otherwise every screenshot review compares two different images.

A real photograph beats a drawing of one; a drawing in **this** language beats a stock photo of nothing
in particular. Never present a found picture as the client's own product, place or team.

## 3. Fill the frame

The most common "this looks unfinished" report is not a missing animation — it is **a screen with one
element and a large empty band**. Every screen carries a real composition:

- **A dominant element** (the card, the photo, the number) at a size that earns its place — 55–75 % of
  the width, never a small tile floating in space.
- **The content the screen already implies**: the meta row under the card, the three itinerary lines,
  the caption under the picker, the label on the map. If a screen has 150 px of nothing, the app has
  something to say there and the build forgot to say it.
- Section gaps are clearly larger than internal gaps (24–40 px on a phone), so the eye reads grouping.
- At most **one** deliberate empty moment per screen.

## 4. Type

- Two sizes do the visible work: one large (28–38 px on a phone) and one small (11.5–13.5 px). A middle
  size for the third level only.
- One family. Weights: 700 for the title, 500–600 for rows, 400 for copy. No monospace outside code.
- `letter-spacing: -0.02em` on large CJK/Latin headings; `+0.02em` only on tiny labels.
- Numbers that change (counters, pickers, prices) get `font-variant-numeric: tabular-nums`, or they
  wiggle horizontally on every update.
- CJK headings wrap at any character: give the heading an explicit `<br>`/line array and a `px` measure,
  never `ch` units.

## 5. Small things that read as "expensive"

- **No hard switches.** Every state change has at least 180 ms of movement.
- **Pressed states on everything** (`scale .96–.97`), including cards, not only buttons.
- **Numbers roll, they don't swap** (see `patterns.md` #9).
- **Lists enter in a stagger** (60–90 ms), so content feels like it is arriving rather than appearing.
- **Corners are consistent**: 14–20 px for cards and panels, 999 px for pills — pick one of each and
  never mix in a 9 px "soft" radius.
- **One icon language.** If the screen uses drawn illustrations, icons are drawn too, not Lucide line
  icons next to gouache artwork.
- **Copy does the work the label can't.** "已加入 · 3 个地点" is a state; "加入行程" is a promise — both are
  needed, in that order.

## 6. Self-check before delivery

Look at every screenshot (idle and mid-state) and answer:

1. Is there a band taller than ~half a screen with nothing in it?
2. Does anything sit closer to the edge on one side than the other?
3. Is the accent used on more than two things?
4. Does the illustration look painted (grain, irregular edges) or like flat vector?
5. Would a stranger know what to do in five seconds — is there one obvious action?
6. Opened on a phone at 390 px: nothing clipped, nothing under 44 px of tap height.

If a problem is visible in the screenshot it is real, whatever the code says.
