/* engine.js — spring + gesture physics for app-grade motion. No dependencies.
 * Closed-form damped oscillator (frame-rate independent), 2D vector springs with
 * velocity hand-off, pointer velocity tracking, rubber-band overscroll.
 * Global: window.MO
 */
(function () {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const E = { reduce: mq.matches };
  if (mq.addEventListener) mq.addEventListener('change', (e) => { E.reduce = e.matches; });

  // ---- damped harmonic oscillator: f(x0, v0, t) -> displacement from target
  function osc(k, c, m) {
    m = m || 1;
    const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return (x0, v0, t) =>
        Math.exp(-z * w0 * t) * (x0 * Math.cos(wd * t) + ((v0 + z * w0 * x0) / wd) * Math.sin(wd * t));
    }
    if (Math.abs(z - 1) < 1e-4) return (x0, v0, t) => Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
    const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s);
    return (x0, v0, t) => {
      const c1 = (v0 - r2 * x0) / (r1 - r2), c2 = x0 - c1;
      return c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    };
  }
  E.osc = osc;

  // ---- scalar spring
  E.spring = function (o) {
    const { from, to, stiffness = 420, damping = 34, velocity = 0, onUpdate, onComplete, epsilon = 0.3 } = o;
    if (E.reduce) { onUpdate && onUpdate(to); onComplete && onComplete(); return { stop() {} }; }
    const f = osc(stiffness, damping, 1), x0 = from - to, t0 = performance.now();
    let raf, dead = false;
    (function frame(now) {
      if (dead) return;
      const t = (now - t0) / 1000, d = f(x0, velocity, t);
      onUpdate && onUpdate(to + d);
      if (Math.abs(d) < epsilon && t > 0.06) { onUpdate && onUpdate(to); dead = true; onComplete && onComplete(); return; }
      raf = requestAnimationFrame(frame);
    })(t0);
    return { stop() { dead = true; cancelAnimationFrame(raf); } };
  };

  // ---- n-dimensional spring (x, y, rotate, scale, opacity ... all share k/c)
  E.springVec = function (o) {
    const { from, to, stiffness = 380, damping = 26, velocity, onUpdate, onComplete, epsilon = 0.35 } = o;
    if (E.reduce) { onUpdate && onUpdate(to.slice()); onComplete && onComplete(); return { stop() {} }; }
    const n = from.length, f = osc(stiffness, damping, 1), t0 = performance.now();
    const vel = velocity || new Array(n).fill(0);
    let raf, dead = false;
    (function frame(now) {
      if (dead) return;
      const t = (now - t0) / 1000, out = new Array(n);
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        const d = f(from[i] - to[i], vel[i], t);
        out[i] = to[i] + d;
        if (Math.abs(d) > maxd) maxd = Math.abs(d);
      }
      onUpdate && onUpdate(out);
      if (maxd < epsilon && t > 0.06) { onUpdate && onUpdate(to.slice()); dead = true; onComplete && onComplete(); return; }
      raf = requestAnimationFrame(frame);
    })(t0);
    return { stop() { dead = true; cancelAnimationFrame(raf); } };
  };

  // ---- pointer velocity (px/s), last ~90 ms
  E.tracker = function (limit) {
    limit = limit || 8;
    let pts = [];
    return {
      reset() { pts = []; },
      add(x, y) { pts.push({ x, y, t: performance.now() }); if (pts.length > limit) pts.shift(); },
      v() {
        if (pts.length < 2) return { vx: 0, vy: 0 };
        const a = pts[0], b = pts[pts.length - 1], dt = (b.t - a.t) / 1000;
        if (dt <= 0.001) return { vx: 0, vy: 0 };
        return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
      },
    };
  };

  // ---- rubber band: compress an overscroll (iOS feel) so the gesture resists at the edges
  E.rubber = function (delta, dim, factor) {
    const c = factor == null ? 0.55 : factor;
    const sign = delta < 0 ? -1 : 1, d = Math.abs(delta);
    return sign * (1 - 1 / ((d * c) / dim + 1)) * dim;
  };

  E.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  E.lerp = (a, b, t) => a + (b - a) * t;

  // ---- is this element under a real pointer (not synthetic)?
  E.pointerDown = function (el, onDown) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      onDown(e);
    });
  };

  window.MO = E;
})();
