# Gesture physics

An app feels native when the object is **a physical thing**: it follows the finger with no easing, and
when let go it carries that motion into a spring. `cubic-bezier` cannot overshoot, so anything that must
read as weight (a card taking the next slot, a panel dropping back, a wheel snapping) is driven by a
damped oscillator, not a transition.

The whole engine is `demo/engine.js` (~5 KB, no dependencies). This file is the reasoning and the numbers.

## 1. The oscillator (closed form, frame-rate independent, interruptible)

```js
function osc(k, c, m) {                       // returns f(x0, v0, t) -> displacement from target
  m = m || 1;
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {                                 // under-damped: overshoot
    const wd = w0 * Math.sqrt(1 - z * z);
    return (x0, v0, t) => Math.exp(-z * w0 * t) *
      (x0 * Math.cos(wd * t) + ((v0 + z * w0 * x0) / wd) * Math.sin(wd * t));
  }
  if (Math.abs(z - 1) < 1e-4)                  // critically damped
    return (x0, v0, t) => Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
  const s = Math.sqrt(z * z - 1);              // over-damped: no overshoot, slower tail
  const r1 = -w0 * (z - s), r2 = -w0 * (z + s);
  return (x0, v0, t) => {
    const c1 = (v0 - r2 * x0) / (r1 - r2), c2 = x0 - c1;
    return c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  };
}
```

**Damping ratio is the knob you should think in:** `z = c / (2·√k)`.
- `z > 1` — over-damped, no overshoot, long tail. Reads "heavy / quiet / precise" (a card flying out).
- `z ≈ 0.8–0.9` — almost no overshoot, settles fast. Reads "confident" (cards changing slots).
- `z ≈ 0.55–0.7` — visible overshoot. Reads "bouncy / playful" (a panel coming back, a button released).

`stiffness` sets the speed, `damping` sets the character. Two springs with the same ratio look like the
same material; that consistency is what makes a build feel authored.

## 2. Vector springs with velocity hand-off

`MO.springVec({ from: [x,y,rot,scale], to: [...], velocity: [...] })` runs one loop and one solver per
dimension, all sharing `k`/`c` so they land together. Every dimension can carry an initial velocity —
that is how a drag hands its momentum to the animation.

```js
MO.springVec({ from: [0, 0, 1], to: [dx, dy, s], stiffness: 300, damping: 30,
  onUpdate: v => el.style.transform = `translate3d(${v[0]}px,${v[1]}px,0) scale(${v[2]})` });
```

Reversal rule: when an animation is interrupted, the new spring starts at the **current** value with the
**current measured velocity**. Restarting from the desired value, or with `v = 0`, makes a reversal
stutter — the object visibly loses momentum it already had.

## 3. Pointer velocity

```js
E.tracker = function (limit = 8) {
  let pts = [];
  return { reset(){ pts = []; },
    add(x, y){ pts.push({x, y, t: performance.now()}); if (pts.length > limit) pts.shift(); },
    v(){ const a = pts[0], b = pts[pts.length-1], dt = (b.t - a.t) / 1000;
         if (dt <= .001) return {vx: 0, vy: 0};
         return { vx: (b.x - a.x)/dt, vy: (b.y - a.y)/dt }; } };
};
```

Feed it in `pointermove`, read it once on release. 6–8 samples over ~90 ms is enough; a longer window
lags the flick, a shorter one is noisy. Thresholds are then in **velocity** (`|vx| > 420–620 px/s`), not
only in distance — a fast flick with a short travel still counts as intent.

## 4. Drag, then hand over

```js
el.addEventListener('pointerdown', e => {
  el.setPointerCapture(e.pointerId);            // keep receiving moves outside the element
  const tr = MO.tracker(), sx = e.clientX, start = currentValue();
  tr.add(e.clientX, e.clientY);
  const move = ev => { const dx = ev.clientX - sx; tr.add(ev.clientX, ev.clientY); write(start + dx); };
  const up = () => { const v = tr.v(); commit(v); };                 // same beat, no delay
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
});
```

- While dragging: **no easing, no transition** — write the transform every move event.
- `touch-action: none` on the draggable surface, or the browser scrolls instead.
- Clear any leftover `transition` on the properties the spring writes; a CSS `transition` and a per-frame
  JS write double-ease the result and look "mushy".

## 5. Rubber band (edges that resist)

```js
E.rubber = (delta, dim, factor = .55) => {
  const sign = delta < 0 ? -1 : 1, d = Math.abs(delta);
  return sign * (1 - 1 / ((d * factor) / dim + 1)) * dim;
};
```
Apply it only to the part beyond the boundary (`v > max ? max + rubber(v - max, 130) : v`). A wheel that
stops dead at the first item feels broken; one that stretches ~40 px and springs back feels iOS.

## 6. Fling prediction (where a coasting list should land)

```
landing ≈ pos + (velocity / itemHeight) * 0.22      // pos in items, velocity px/s
```
Then snap there with a spring seeded with `velocity * 0.35` — the residual velocity produces a small
overshoot before settling, which is what reads as inertia. Without the seed the snap reads mechanical.

For a card that must leave the screen entirely, do not wait for the spring to settle: target
`±(stageWidth + 220)` with `stiffness 120 / damping 27` (over-damped, quick, no rebound) and advance the
index/state at commit time.

## 7. Feel parameters (measured, reuse these)

| Interaction | stiffness / damping | z | Character |
|---|---|---|---|
| Drop onto a stack | 300 / 21 | 0.61 | lands with weight, small bounce |
| Gather into a fan | 250 / 20 | 0.63 | soft settle, slight overshoot |
| Fall out of frame | 130 / 28 | 1.23 | accelerates away, no rebound |
| Card takes the next slot | 300 / 26 | 0.75 | quick, almost no overshoot |
| Card flies off-screen | 120 / 27 | 1.23 | leaves fast, dies quietly |
| Drag snap-back | 340 / 30 | 0.81 | immediate, confident |
| Sheet dismiss | 300 / 30 | 0.87 | quiet, no bounce |
| Sheet return | 400 / 21 | 0.52 | bouncy — the one place overshoot is wanted |
| Shared element expand | 300 / 30 | 0.87 | smooth, no zoom-bounce |
| Shared element collapse | 340 / 31 | 0.84 | slightly quicker back |
| Title hero rescale | 380 / 20 | 0.51 | the bounce is the point |
| Picker snap | 210 / 23 | 0.79 | coasts in, tiny overshoot |
| Button release | 520 / 20 | 0.44 | springs back to size |
| Panel/stage zoom (1 → 1.14) | 240 / 28 | 0.90 | quiet fill |

Rule of thumb: **entry moves are bouncier than exit moves**; exits use `z > 1` so nothing bounces on the
way out. Damping above `√(4k)` never overshoots — "no bounce" is a physics choice, not a timing trick.

## 8. Reduced motion

`MO.spring` / `MO.springVec` check `matchMedia('(prefers-reduced-motion: reduce)')` **at call time** and
jump straight to `to`. That means: content is never left hidden by a pre-reveal state, and a user who
asked for less motion still gets every end state. Hover-only previews are additionally gated behind
`@media (hover:hover) and (pointer:fine)` so a phone does not keep a hover state stuck after a tap.

## 9. Proof (motion is unverified until the property is sampled)

A screenshot cannot show whether a spring ran; two identical values in a row mean the class toggle won
and nothing animated. `demo/verify.mjs` samples the computed matrix from Node every ~25 ms:

```
[[1,213,179,0.988],[32,234,179,0.987],[64,284,181,0.985],[95,336,185,0.982]]…
```
A real spring shows a graded approach and, where intended, one overshoot past the target before settling;
a jump shows the end value at t≈0.
