/* art.js — destination "photographs" drawn in code, 4:5, in one hand-drawn
 * gouache language: no outlines, flat fills, hand-cut edges (jittered + smoothed
 * silhouettes), print grain over everything. Deterministic seeds so the demo
 * looks the same on every load. Replace with real photos in production.
 * Global: window.art(i) -> svg string
 */
(function () {
  const C = {
    paper: '#fbf6ec',
    navy: '#2f4a57', navy2: '#3d5a68', slate: '#6f96a2', slateL: '#9ab9c1', pale: '#c3d6da',
    tan: '#e2b57a', oak: '#c98f52', ochre: '#bf8b4b',
    tomato: '#d94a34', orange: '#ef8f2e', citrus: '#f6c945',
    olive: '#b8c65a', leaf: '#86a44b', green: '#5d7d3c',
    cream: '#fdfaf3',
  };

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function smoothClosed(pts) {
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)},${c2[0].toFixed(1)} ${c2[1].toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }
  // hand-cut edge: subdivide every edge and push the new points off-line
  function rough(pts, seed, jitter) {
    const r = rng(seed), out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push(a);
      for (let k = 1; k <= 2; k++) {
        const t = k / 3;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const off = (r() - 0.5) * 2 * jitter;
        out.push([x + (-dy / len) * off, y + (dx / len) * off]);
      }
    }
    return smoothClosed(out);
  }
  const shape = (pts, fill, seed, jitter = 13, extra = '') =>
    `<path d="${rough(pts, seed, jitter)}" fill="${fill}"${extra}/>`;
  const disc = (cx, cy, r, fill, seed) => {
    const p = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      p.push([cx + Math.cos(a) * r * (0.96 + rng(seed + i)() * 0.08), cy + Math.sin(a) * r * (0.96 + rng(seed + i + 9)() * 0.08)]);
    }
    return `<path d="${smoothClosed(p)}" fill="${fill}"/>`;
  };
  const wave = (x, y, w, seed, color, sw = 7, op = 0.75) => {
    const r = rng(seed);
    let d = `M${x} ${y}`;
    const seg = 4;
    for (let i = 1; i <= seg; i++) {
      const nx = x + (w * i) / seg;
      d += ` Q${(x + (w * (i - 0.5)) / seg).toFixed(0)} ${(y - 10 + r() * 14).toFixed(0)},${nx.toFixed(0)} ${(y + (r() - 0.5) * 8).toFixed(0)}`;
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
  };
  const grain = (id) =>
    `<filter id="gr${id}" x="0" y="0" width="100%" height="100%">
       <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${id + 3}" stitchTiles="stitch"/>
       <feColorMatrix type="saturate" values="0"/>
       <feComponentTransfer><feFuncA type="linear" slope="0.72"/></feComponentTransfer>
     </filter>
     <rect width="600" height="750" filter="url(#gr${id})" opacity="0.13" style="mix-blend-mode:multiply"/>`;

  function scene(i, r) {
    const g = r + 100;
    switch (i) {
      case 0: // 湖
        return `${disc(140, 168, 56, C.citrus, g)}
          ${shape([[-60, 440], [80, 296], [200, 372], [318, 250], [452, 356], [660, 292], [660, 500], [-60, 500]], C.navy, g + 1, 10)}
          ${shape([[-60, 486], [110, 404], [250, 462], [392, 392], [660, 452], [660, 560], [-60, 560]], C.slate, g + 2, 8)}
          ${shape([[-60, 520], [660, 508], [660, 800], [-60, 800]], C.slateL, g + 3, 5)}
          ${wave(70, 590, 300, g + 4, C.cream, 8, 0.55)}
          ${wave(300, 662, 260, g + 5, C.cream, 7, 0.45)}
          ${wave(60, 706, 220, g + 6, C.cream, 6, 0.35)}
          <g stroke="${C.green}" stroke-width="5" stroke-linecap="round" opacity=".9">
            <path d="M78 750 q6 -58 2 -96"/><path d="M104 750 q-8 -52 -22 -84"/>
            <path d="M132 750 q10 -44 6 -74"/>
          </g>`;
      case 1: // 山
        return `${disc(438, 156, 46, C.orange, g)}
          ${shape([[-60, 560], [150, 250], [286, 420], [372, 322], [536, 560], [-60, 560]], C.tan, g + 1, 11)}
          ${shape([[196, 600], [402, 232], [660, 600], [196, 600]], C.navy, g + 2, 9)}
          ${shape([[358, 300], [402, 232], [448, 306], [426, 336], [382, 322]], C.cream, g + 3, 4)}
          ${[0, 1, 2, 3, 4].map((k) => {
            const x = 60 + k * 42, y = 690 + (k % 2) * 12;
            return shape([[x, y], [x + 22, y - 78], [x + 44, y]], C.navy, g + 10 + k, 4, ' opacity=".9"');
          }).join('')}
          ${shape([[-60, 640], [660, 618], [660, 800], [-60, 800]], C.slate, g + 20, 6)}`;
      case 2: // 森林
        return `${shape([[-60, 320], [90, 150], [240, 300], [360, 168], [500, 320], [660, 220], [660, 800], [-60, 800]], C.olive, g + 1, 14)}
          ${shape([[-60, 470], [120, 330], [280, 470], [420, 340], [600, 470], [660, 430], [660, 800], [-60, 800]], C.leaf, g + 2, 12)}
          ${shape([[-60, 620], [140, 520], [330, 620], [520, 540], [660, 610], [660, 800], [-60, 800]], C.green, g + 3, 10)}
          <g fill="${C.oak}">
            <rect x="146" y="600" width="15" height="150" rx="6"/>
            <rect x="330" y="560" width="17" height="190" rx="7"/>
            <rect x="512" y="590" width="14" height="160" rx="6"/>
          </g>
          ${shape([[392, 596], [470, 596], [470, 690], [392, 690]], C.cream, g + 4, 4)}
          ${shape([[376, 600], [431, 536], [488, 600]], C.tomato, g + 5, 4)}
          ${disc(96, 120, 40, C.citrus, g + 6)}`;
      case 3: // 海
        return `${disc(452, 150, 50, C.citrus, g)}
          ${shape([[-60, 470], [660, 452], [660, 800], [-60, 800]], C.slateL, g + 1, 6)}
          ${shape([[-60, 470], [660, 452], [660, 520], [-60, 536]], C.slate, g + 2, 5)}
          ${wave(40, 590, 300, g + 3, C.cream, 8, 0.6)}
          ${wave(300, 640, 260, g + 4, C.cream, 7, 0.5)}
          ${wave(80, 700, 320, g + 5, C.cream, 6, 0.4)}
          ${shape([[120, 520], [230, 520], [206, 560], [144, 560]], C.navy, g + 6, 4)}
          ${shape([[176, 520], [176, 420], [236, 520]], C.cream, g + 7, 3)}
          ${shape([[96, 536], [250, 536], [250, 546], [96, 546]], C.tomato, g + 8, 2, ' opacity=".85"')}`;
      case 4: // 沙丘
        return `${disc(432, 168, 60, C.orange, g)}
          ${shape([[-60, 470], [120, 350], [300, 470], [470, 372], [660, 470], [660, 800], [-60, 800]], C.tan, g + 1, 12)}
          ${shape([[-60, 600], [160, 500], [360, 610], [560, 520], [660, 580], [660, 800], [-60, 800]], C.oak, g + 2, 10)}
          ${shape([[-60, 690], [200, 630], [430, 700], [660, 650], [660, 800], [-60, 800]], C.ochre, g + 3, 8)}
          <g fill="${C.green}" opacity=".9">
            <path d="M120 640 q-6 -70 4 -96 q16 30 12 96 z"/>
            <path d="M108 610 q-30 -16 -34 -40 q30 6 42 26 z"/>
          </g>`;
      default: // 夜城
        return `<g fill="${C.navy2}">
            <path d="${rough([[40, 380], [232, 366], [238, 760], [44, 760]], g + 1, 6)}"/>
            <path d="${rough([[232, 300], [420, 288], [428, 760], [236, 760]], g + 2, 6)}"/>
            <path d="${rough([[418, 404], [596, 394], [602, 760], [422, 760]], g + 3, 6)}"/>
          </g>
          ${disc(500, 130, 42, C.cream, g + 4)}
          <g fill="${C.citrus}" opacity=".85">
            ${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${62 + (k % 2) * 78}" y="${440 + Math.floor(k / 2) * 84}" width="30" height="22" rx="4"/>`).join('')}
            ${[0, 1, 2, 3].map((k) => `<rect x="${262 + (k % 2) * 82}" y="${380 + Math.floor(k / 2) * 96}" width="28" height="20" rx="4"/>`).join('')}
            ${[0, 1, 2].map((k) => `<rect x="${448 + k * 46}" y="${500 + (k % 2) * 70}" width="24" height="18" rx="4"/>`).join('')}
          </g>
          ${shape([[-60, 700], [660, 690], [660, 800], [-60, 800]], C.navy, g + 9, 4)}`;
    }
  }

  window.art = function (idx, seedBase = 7) {
    const i = ((idx % 6) + 6) % 6;
    const s = seedBase + i * 37;
    return `<svg viewBox="0 0 600 750" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>${grain(i)}</defs>
      <rect width="600" height="750" fill="${i === 5 ? C.navy : C.paper}"/>
      ${i === 5 ? scene(5, s) : scene(i, s)}
      ${i === 5 ? '' : `<rect width="600" height="750" fill="url(#none)" opacity="0"/>`}
      <rect width="600" height="750" filter="url(#gr${i})" opacity="0.10" style="mix-blend-mode:multiply"/>
    </svg>`;
  };
  window.artPalette = C;
})();
