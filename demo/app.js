/* app.js — nine app-interaction scenes. Each scene is a module with enter();
 * motion is driven by MO.spring / MO.springVec (engine.js) so every move has
 * physical weight, interruption velocity, and a reduced-motion shortcut.
 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const stage = $('#stage');
  const W = () => stage.clientWidth;
  const H = () => stage.clientHeight;
  const pad = (n) => String(n).padStart(2, '0');

  /* ── 1. drop & gather ───────────────────────────────────────────── */
  const intro = (() => {
    const stack = $('#itStack'), ui = document.getElementById('sc-intro');
    const PW = 192, PH = 240;
    let photos = [], timers = [];
    function place(el, v) {
      el.style.transform = `translate3d(${v[0]}px,${v[1]}px,0) rotate(${v[2]}deg) scale(${v[3]})`;
    }
    function build() {
      if (photos.length) return;
      for (let i = 0; i < 5; i++) {
        const d = document.createElement('div');
        d.className = 'it-ph';
        d.innerHTML = art(i);
        stack.appendChild(d);
        photos.push(d);
      }
    }
    function enter() {
      build();
      timers.forEach(clearTimeout);
      timers = [];
      ui.classList.remove('it-in');
      const w = W(), baseX = (w - PW) / 2;
      const JX = [-18, 12, -8, 16, -2], JY = [0, 10, 4, 14, 8], ROT = [-9, 6, -4, 9, -3];

      photos.forEach((p, i) => {
        p.style.opacity = '0';
        p._v = [baseX, -PH - 60, 0, 1];
        place(p, p._v);
      });

      photos.forEach((p, i) => {
        timers.push(setTimeout(() => {
          p.style.opacity = '1';
          const from = [baseX, -PH - 60, 0, 1];
          const to = [baseX + JX[i], 292 + JY[i], ROT[i], 1];
          MO.springVec({
            from, to, stiffness: 300, damping: 21,
            onUpdate: (v) => { p._v = v; place(p, v); },
            onComplete: () => { p._v = to.slice(); },
          });
        }, i * 95));
      });

      // gather: four spring into a fan, the fifth keeps falling out of frame
      timers.push(setTimeout(() => {
        const fan = [[-72, 6, -14], [-25, -12, -5], [25, 6, 5], [72, -12, 13]];
        photos.forEach((p, i) => {
          const from = p._v.slice();
          const to = i < 4
            ? [baseX + fan[i][0], 292 + fan[i][1], fan[i][2], 0.94]
            : [baseX, H() + PH + 80, -18, 0.9];
          MO.springVec({
            from, to,
            stiffness: i < 4 ? 250 : 130,
            damping: i < 4 ? 20 : 28,
            velocity: i < 4 ? undefined : [0, 520, 0, 0],
            onUpdate: (v) => { p._v = v; place(p, v); },
          });
        });
        ui.classList.add('it-in');
      }, 1080));
    }
    return { enter };
  })();

  /* ── 2. fan stack swipe ─────────────────────────────────────────── */
  const fan = (() => {
    const deck = $('#fanDeck'), dotBox = $('#fanDots');
    const title = $('#fanTitle'), kicker = $('#fanKicker');
    const DATA = [
      ['赛里木湖', '高山冷水湖'], ['长白山', '火山与森林'],
      ['禾木村', '白桦林与木屋'], ['东山岛', '海边公路'],
    ];
    const N = 4;
    let cards = [], idx = 0, busy = false;

    function build() {
      if (cards.length) return;
      DATA.forEach((d, i) => {
        const c = document.createElement('div');
        c.className = 'fan-card';
        c.innerHTML = art(i);
        deck.appendChild(c);
        cards.push(c);
        const dot = document.createElement('i');
        dotBox.appendChild(dot);
      });
    }
    function layout() {
      const cw = Math.round(W() * 0.7), ch = Math.round(cw * 1.25);
      cards.forEach((c) => {
        c.style.width = cw + 'px';
        c.style.height = ch + 'px';
        c._cx = (W() - cw) / 2;
        c._cy = Math.max(146, Math.min(176, H() * 0.21));
      });
      const info = $('#fanInfo');
      info.style.top = (cards[0]._cy + ch + 24) + 'px';
      $('#fanDots').style.bottom = (H() - (cards[0]._cy + ch + 24 + 64 + 26)) + 'px';
      info.classList.add('on');
    }
    function slot(i) {
      const d = i - idx;                        // 0 = front of the fan
      if (!d) return [0, 0, 0, 1];
      const side = d % 2 ? 1 : -1, mag = Math.ceil(Math.abs(d) / 2);
      return [side * mag * 46, Math.abs(d) * 7, side * mag * 10, 1 - Math.abs(d) * 0.05];
    }
    function place(i, v) {
      const c = cards[i];
      c.style.transform = `translate3d(${c._cx + v[0]}px,${c._cy + v[1]}px,0) rotate(${v[2]}deg) scale(${v[3]})`;
      c.style.zIndex = String(30 - Math.abs(i - idx));
    }
    function arrange(vel) {
      cards.forEach((c, i) => {
        const to = slot(i), from = c._v || to.slice();
        MO.springVec({
          from, to, stiffness: 260, damping: 22,
          velocity: i === idx && vel ? [vel.vx, 0, vel.vx * 0.02, 0] : undefined,
          onUpdate: (v) => { c._v = v; place(i, v); },
          onComplete: () => { c._v = to.slice(); },
        });
      });
    }
    function head() {
      title.classList.add('swap');
      setTimeout(() => {
        title.textContent = DATA[idx][0];
        $('#fanMeta').textContent = DATA[idx][1];
        kicker.textContent = pad(idx + 1) + ' / ' + pad(N);
        title.classList.remove('swap');
      }, 200);
      $$('i', dotBox).forEach((d, i) => d.classList.toggle('on', i === idx));
    }
    function drag() {
      deck.addEventListener('pointerdown', (e) => {
        if (busy) return;
        const t = e.target.closest('.fan-card');
        if (!t || t !== cards[idx]) return;
        const tr = MO.tracker();
        const sx = e.clientX, sy = e.clientY;
        const start = (cards[idx]._v || slot(idx)).slice();
        tr.add(e.clientX, e.clientY);
        deck.setPointerCapture(e.pointerId);
        let dx = 0;
        const move = (ev) => {
          dx = ev.clientX - sx;
          tr.add(ev.clientX, ev.clientY);
          place(idx, [start[0] + dx, start[1] + dx * 0.05, start[2] + dx * 0.045, start[3]]);
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          const v = tr.v();
          const far = Math.abs(dx) > W() * 0.18 || Math.abs(v.vx) > 420;
          cards[idx]._v = [start[0] + dx, start[1], start[2] + dx * 0.045, start[3]];
          if (far) {
            busy = true;
            idx = (idx + (dx < 0 ? 1 : -1) + N) % N;
            head();
            arrange({ vx: v.vx });
            setTimeout(() => { busy = false; }, 400);
          } else arrange(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }
    function enter() {
      build(); layout();
      idx = 0; cards.forEach((c) => { c._v = null; });
      head(); arrange(null); drag();
      $$('i', dotBox).forEach((d, i) => d.classList.toggle('on', i === 0));
    }
    return { enter };
  })();

  /* ── 3. swipe to triage ─────────────────────────────────────────── */
  const triage = (() => {
    const deck = $('#trDeck'), count = $('#trCount'), done = $('#trDone');
    const sOk = $('#stampOk'), sNo = $('#stampNo');
    const DATA = [
      ['赛里木湖', '高山冷水湖 · 车程 2 小时'], ['长白山', '火山与森林 · 4 小时'],
      ['禾木村', '白桦林木屋 · 6 小时'], ['东山岛', '海边公路 · 3 小时'],
    ];
    let cards = [], top = 0, busy = false;

    function build() {
      if (cards.length) return;
      DATA.forEach((d) => {
        const c = document.createElement('div');
        c.className = 'tr-card';
        c.innerHTML = art(cards.length) +
          `<div class="tr-cap"><b>${d[0]}</b><span>${d[1]}</span></div>`;
        deck.appendChild(c);
        cards.push(c);
      });
    }
    function layout() {
      const cw = Math.round(W() * 0.82), ch = Math.round(cw * 1.34);
      const top0 = 92, bot0 = H() - 118;
      cards.forEach((c) => {
        c.style.width = cw + 'px';
        c.style.height = ch + 'px';
        c._cx = (W() - cw) / 2;
        c._cy = Math.max(top0, top0 + (bot0 - top0 - ch) / 2);
      });
    }
    function place(c, v) {
      c.style.transform = `translate3d(${c._cx + v[0]}px,${c._cy + v[1]}px,0) rotate(${v[2]}deg) scale(${v[3]})`;
    }
    function slot(i) { const d = i - top; return [0, d * 9, 0, 1 - Math.max(0, d) * 0.05]; }
    function arrange(vel) {
      cards.forEach((c, i) => {
        if (c.dataset.gone === '1' || c.dataset.flying === '1') return;
        const to = i < top ? [0, 0, 0, 1] : slot(i), from = c._v || to.slice();
        c.style.zIndex = String(40 - i);
        MO.springVec({
          from, to, stiffness: 300, damping: 26,
          velocity: i === top && vel ? [vel.vx * 0.6, 0, 0, 0] : undefined,
          onUpdate: (v) => { c._v = v; place(c, v); },
          onComplete: () => { c._v = to.slice(); },
        });
      });
    }
    function count_() {
      const left = cards.length - top;
      count.textContent = left ? '剩 ' + left + ' 个' : '都看完了';
      done.hidden = left > 0;
    }
    function fling(dir, vx) {
      if (top >= cards.length) return;
      const c = cards[top];
      const from = (c._v || [0, 0, 0, 1]).slice();
      const to = [dir * (W() + 220), 30, dir * 18, 1];
      c.dataset.flying = '1';
      MO.springVec({
        from, to, stiffness: 120, damping: 27, velocity: [vx || dir * 900, 0, 0, 0],
        onUpdate: (v) => { c._v = v; place(c, v); },
        onComplete: () => {
          c.dataset.gone = '1';
          c.dataset.flying = '0';
          c.style.display = 'none';
        },
      });
      // promote NOW, not when the spring settles: the card is already off-screen at
      // ~150 ms and the next one must be on its way up in the same beat.
      top++;
      count_();
      arrange(null);
      sOk.style.opacity = '0';
      sNo.style.opacity = '0';
    }
    function drag() {
      deck.addEventListener('pointerdown', (e) => {
        if (busy || top >= cards.length) return;
        const t = e.target.closest('.tr-card');
        if (!t || t !== cards[top]) return;
        const tr = MO.tracker();
        const sx = e.clientX;
        const start = (cards[top]._v || [0, 0, 0, 1]).slice();
        tr.add(e.clientX, 0);
        deck.setPointerCapture(e.pointerId);
        let dx = 0;
        const move = (ev) => {
          dx = ev.clientX - sx;
          tr.add(ev.clientX, 0);
          place(cards[top], [start[0] + dx, start[1] + Math.abs(dx) * 0.02, start[2] + dx * 0.05, start[3]]);
          const k = Math.min(1, Math.abs(dx) / 110);
          sOk.style.opacity = dx > 0 ? k.toFixed(2) : '0';
          sNo.style.opacity = dx < 0 ? k.toFixed(2) : '0';
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          const v = tr.v();
          if (Math.abs(dx) > 96 || Math.abs(v.vx) > 620) {
            cards[top]._v = [start[0] + dx, start[1], start[2] + dx * 0.05, start[3]];
            fling(dx > 0 ? 1 : -1, v.vx);
          } else {
            cards[top]._v = [start[0] + dx, start[1] + Math.abs(dx) * 0.02, start[2] + dx * 0.05, start[3]];
            arrange(null);
            sOk.style.opacity = '0';
            sNo.style.opacity = '0';
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }
    function reset() {
      top = 0; busy = false;
      cards.forEach((c) => { c.dataset.gone = '0'; c.style.display = ''; c._v = null; });
      arrange(null); count_();
      sOk.style.opacity = sNo.style.opacity = '0';
    }
    function enter() {
      build(); layout(); drag();
      $('#trReset').onclick = reset;
      reset();
    }
    return { enter, fling, reset };
  })();

  /* ── 4. shared element expand ──────────────────────────────────── */
  const expand = (() => {
    const grid = $('#exGrid'), detail = $('#exDetail'), card = $('#exCard');
    const back = $('#exBack'), scrim = $('#exScrim'), name = $('#exName'), sub = $('#exSub');
    const DATA = [['赛里木湖', '高山冷水湖 · 车程 2 小时'], ['长白山', '火山与森林 · 4 小时'],
      ['禾木村', '白桦林木屋 · 6 小时'], ['东山岛', '海边公路 · 3 小时']];
    let isOpen = false, target = null, curIdx = 0;

    function local(el) {
      const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    }
    function build() {
      if (grid.children.length) return;
      DATA.forEach((d, i) => {
        const t = document.createElement('div');
        t.className = 'ex-thumb';
        t.innerHTML = art(i) + `<b>${d[0]}</b>`;
        t.addEventListener('click', () => open(t, i));
        grid.appendChild(t);
      });
    }
    function open(thumb, i) {
      if (isOpen) return;
      isOpen = true; curIdx = i;
      const r = local(thumb), w = W(), h = H();
      const inset = 26;
      let tw = w - inset * 2, th = tw * 1.25;
      const maxH = h - 210;                       // leave room for the copy under it
      if (th > maxH) { th = maxH; tw = th * 0.8; }
      const tx = (w - tw) / 2, ty = Math.max(28, (h - th - 210) / 2);
      $('#exUnder').style.top = (ty + th + 16) + 'px';
      card.style.left = r.x + 'px';
      card.style.top = r.y + 'px';
      card.style.width = r.w + 'px';
      card.style.height = r.h + 'px';
      card.innerHTML = art(i);
      name.textContent = DATA[i][0];
      sub.textContent = DATA[i][1];
      const s = tw / r.w, dx = tx - r.x, dy = ty - r.y;
      detail.classList.add('on');
      requestAnimationFrame(() => {
        detail.classList.add('open');
        target = [dx, dy, s];
        MO.springVec({
          from: [0, 0, 1], to: target, stiffness: 300, damping: 30,
          onUpdate: (v) => {
            card.style.transform = `translate3d(${v[0]}px,${v[1]}px,0) scale(${v[2]})`;
          },
        });
      });
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      detail.classList.remove('open');
      const from = target || [0, 0, 1];
      MO.springVec({
        from, to: [0, 0, 1], stiffness: 340, damping: 31,
        onUpdate: (v) => {
          card.style.transform = `translate3d(${v[0]}px,${v[1]}px,0) scale(${v[2]})`;
        },
        onComplete: () => { detail.classList.remove('on'); card.innerHTML = ''; },
      });
    }
    function enter() {
      build();
      if (isOpen) { isOpen = false; detail.classList.remove('on', 'open'); card.innerHTML = ''; }
      back.onclick = close;
      scrim.onclick = close;
    }
    return { enter, open, close };
  })();

  /* ── 5. dismissible sheet ──────────────────────────────────────── */
  const sheetMod = (() => {
    const map = $('#shMap'), panel = $('#shSheet'), openBtn = $('#shOpen');
    const closeBtn = $('#shClose'), handle = $('#shHandle'), topEl = $('#shTop');
    let up = true, y = 0, h = 400;
    function setY(v) {
      y = v;
      panel.style.transform = `translateY(${v}px)`;
      panel.style.opacity = String(MO.clamp(1 - (v / h) * 1.3, 0, 1));
    }
    function setScale(s) { map.style.transform = `scale(${s})`; }
    function dismiss() {
      if (!up) return;
      up = false;
      closeBtn.blur();
      MO.spring({
        from: y, to: h, stiffness: 300, damping: 30, onUpdate: setY,
        onComplete: () => openBtn.classList.add('on'),
      });
      MO.spring({ from: 1, to: 1.14, stiffness: 240, damping: 28, onUpdate: setScale });
      map.style.borderRadius = '0px';
      topEl.classList.add('light');
    }
    function show() {
      if (up) return;
      up = true;
      openBtn.classList.remove('on');
      map.style.borderRadius = '22px';
      topEl.classList.remove('light');
      MO.spring({ from: y, to: 0, stiffness: 400, damping: 21, onUpdate: setY });
      MO.spring({ from: 1.14, to: 1, stiffness: 380, damping: 27, onUpdate: setScale });
    }
    function drag() {
      panel.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        panel.setPointerCapture(e.pointerId);
        const startY = y, sy = e.clientY;
        let dy = 0;
        const move = (ev) => {
          dy = ev.clientY - sy;
          const v = dy > 0 ? dy : MO.rubber(dy, 90);
          setY(MO.clamp(startY + v, 0, h));
          setScale(1 + (Math.min(dy, h) / h) * 0.14);
        };
        const end = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          if (dy > 90) dismiss();
          else {
            MO.spring({ from: y, to: 0, stiffness: 420, damping: 24, onUpdate: setY });
            MO.spring({ from: 1 + (Math.min(dy, h) / h) * 0.14, to: 1, stiffness: 400, damping: 27, onUpdate: setScale });
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      });
    }
    function enter() {
      h = panel.offsetHeight + 40;
      up = true; y = 0;
      panel.style.opacity = '1';
      setY(0); setScale(1);
      map.style.borderRadius = '22px';
      map.innerHTML = art(3) + `
        <svg class="sh-route" viewBox="0 0 370 790" preserveAspectRatio="none">
          <path d="M212 302 C176 380 128 460 104 540 S128 664 186 704"
            fill="none" stroke="#22282e" stroke-width="3" stroke-dasharray="2 11"
            stroke-linecap="round" opacity=".5"/>
        </svg>
        <div class="sh-pin"></div>
        <span class="sh-lb a">才村码头</span><span class="sh-lb b">喜洲 · 12 km</span>`;
      openBtn.classList.remove('on');
      topEl.classList.remove('light');
      closeBtn.onclick = dismiss;
      openBtn.onclick = show;
      if (!panel.dataset.bound) { panel.dataset.bound = '1'; drag(); }
    }
    return { enter, dismiss, show };
  })();

  /* ── 6. staggered title swap ───────────────────────────────────── */
  const titles = (() => {
    const hero = $('#tsHero'), title = $('#tsTitle'), sub = $('#tsSub'), next = $('#tsNext');
    const SETS = [
      { lines: ['把周末', '交给一座山', '和一条湖'], sub: '3 天 · 2 晚 · 全程徒步', art: 0 },
      { lines: ['往南开四小时', '海就在路边'], sub: '2 天 · 1 晚 · 自驾', art: 3 },
      { lines: ['住进木屋', '听一夜白桦'], sub: '4 天 · 3 晚 · 含向导', art: 2 },
    ];
    let i = 0, busy = false;
    const render = (s) => s.lines.map((l) => `<span class="mask"><i>${l}</i></span>`).join('');
    function setHero(k) {
      MO.spring({
        from: 1, to: 0.94, stiffness: 300, damping: 32,
        onUpdate: (v) => {
          hero.style.transform = `scale(${v})`;
          hero.style.opacity = String(MO.clamp(1 - (1 - v) * 4.2, 0.5, 1));
        },
      });
    }
    function swap() {
      if (busy) return;
      busy = true;
      $$('i', title).forEach((el, k) => {
        el.style.transition = 'transform .3s cubic-bezier(.4,0,.7,.4)';
        el.style.transitionDelay = (k * 60) + 'ms';
        el.style.transform = 'translateY(105%)';           // exits downward, 60 ms apart
      });
      sub.classList.remove('in');
      setHero();
      setTimeout(() => {
        i = (i + 1) % SETS.length;
        const s = SETS[i];
        title.innerHTML = render(s);
        const lines = $$('i', title);
        lines.forEach((el) => { el.style.transition = 'none'; el.style.transform = 'translateY(105%)'; });
        void title.offsetHeight;
        lines.forEach((el, k) => {
          el.style.transition = 'transform .52s cubic-bezier(.22,1,.36,1)';
          el.style.transitionDelay = (k * 60) + 'ms';      // new lines rise, 60 ms apart
          el.style.transform = 'translateY(0)';
        });
        sub.textContent = s.sub;
        sub.classList.add('in');
        hero.innerHTML = art(s.art);
        MO.spring({
          from: 0.94, to: 1, stiffness: 380, damping: 20,
          onUpdate: (v) => {
            hero.style.transform = `scale(${v})`;
            hero.style.opacity = String(MO.clamp(1 - (1 - v) * 4.2, 0.5, 1));
          },
        });
      }, 330);
      setTimeout(() => { busy = false; }, 900);
    }
    function enter() {
      i = 0; busy = false;
      const s = SETS[0];
      title.innerHTML = render(s);
      sub.textContent = s.sub;
      hero.innerHTML = art(s.art);
      hero.style.transform = 'scale(1)';
      hero.style.opacity = '1';
      title.classList.add('in'); sub.classList.add('in');
      next.onclick = swap;
    }
    return { enter, swap };
  })();

  /* ── 7. inertial picker wheel ──────────────────────────────────── */
  const wheel = (() => {
    const vp = $('#whVp'), col = $('#whCol'), out = $('#whValue');
    const ITEM = 56, N = 24;
    let idx = 7, y = 0;
    const centre = () => vp.clientHeight / 2 - ITEM / 2;
    function build() {
      if (col.children.length) return;
      col.innerHTML = Array.from({ length: N }, (_, i) =>
        `<div class="wh-item" data-i="${i}">${pad(i)}:00</div>`).join('');
    }
    function setY(v) {
      y = v;
      col.style.transform = `translate3d(0,${v}px,0)`;
      const c = MO.clamp(Math.round((centre() - v) / ITEM), 0, N - 1);
      $$('.wh-item', col).forEach((el, i) => el.classList.toggle('on', i === c));
    }
    function settle(target, vel, done) {
      const to = centre() - target * ITEM;
      MO.spring({
        from: y, to, stiffness: 210, damping: 23, velocity: vel || 0,
        onUpdate: setY,
        onComplete: () => { idx = target; out.textContent = pad(target) + ':00'; done && done(); },
      });
    }
    function drag() {
      vp.addEventListener('pointerdown', (e) => {
        vp.setPointerCapture(e.pointerId);
        const tr = MO.tracker();
        const sy = e.clientY, startY = y;
        tr.add(e.clientY, 0);
        const minY = centre() - (N - 1) * ITEM, maxY = centre();
        let moved = false;
        const move = (ev) => {
          const dy = ev.clientY - sy;
          if (Math.abs(dy) > 4) moved = true;
          tr.add(ev.clientY, 0);
          let v = startY + dy;
          if (v > maxY) v = maxY + MO.rubber(v - maxY, 130);
          if (v < minY) v = minY + MO.rubber(v - minY, 130);
          setY(v);
        };
        const end = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          if (!moved) return;
          const vy = tr.v().vy;                              // px/s
          const pos = (centre() - y) / ITEM;                 // in items
          const target = MO.clamp(Math.round(pos + (vy / ITEM) * 0.22), 0, N - 1);
          settle(target, vy * 0.35);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      });
      col.addEventListener('click', (e) => {
        const it = e.target.closest('.wh-item');
        if (it) settle(Number(it.dataset.i), 0);
      });
    }
    function enter() {
      build();
      idx = 7;
      col.querySelectorAll('.wh-item').forEach((el, i) => el.style.color = '');
      setY(centre() - idx * ITEM);
      out.textContent = pad(idx) + ':00';
      if (!vp.dataset.bound) { vp.dataset.bound = '1'; drag(); }
    }
    return { enter };
  })();

  /* ── 8. complete button ────────────────────────────────────────── */
  const comp = (() => {
    const btn = $('#cpBtn'), burst = $('#cpBurst'), ph = $('#cpPh');
    let state = 'idle';
    function particles() {
      const r = btn.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const cx = r.left - s.left + r.width / 2, cy = r.top - s.top + r.height / 2;
      for (let i = 0; i < 14; i++) {
        const p = document.createElement('span');
        p.className = 'cp-p';
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.marginLeft = '-3.5px';
        p.style.marginTop = '-3.5px';
        p.style.transform = 'translate(0,0) scale(.4)';
        p.style.opacity = '1';
        burst.appendChild(p);
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.35;
        const d = 44 + Math.random() * 30;
        requestAnimationFrame(() => {
          p.style.transition = `transform .62s cubic-bezier(.16,.72,.3,1) ${i * 8}ms,opacity .62s ${i * 8}ms`;
          p.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1)`;
          p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 1000);
      }
    }
    function reset() {
      state = 'idle';
      btn.className = 'cp-btn';
      btn.style.clipPath = 'inset(0 round 999px)';
    }
    function run() {
      if (state === 'done') { reset(); return; }
      if (state !== 'idle') return;
      state = 'busy';
      btn.classList.add('busy');
      btn.style.clipPath = 'inset(0 calc(50% - 27px) round 999px)';   // pill → circle, no layout
      setTimeout(() => btn.classList.add('checked'), 230);            // the tick draws
      setTimeout(particles, 760);
      setTimeout(() => {
        btn.classList.add('added');
        btn.style.clipPath = 'inset(0 0 round 999px)';                // back to a pill
        btn.classList.add('done');
        state = 'done';
      }, 880);
    }
    function enter() {
      ph.innerHTML = art(3);
      reset();
      btn.onclick = run;
    }
    return { enter, run };
  })();

  /* ── 9. linked cascade ─────────────────────────────────────────── */
  const casc = (() => {
    const list = $('#caList'), head = $('#caHead'), count = $('#caCount');
    const num = $('#caNum'), prog = $('#caProg');
    const TOTAL = 5, on = new Set();
    function roll(n) {
      num.classList.add('out');
      setTimeout(() => { num.textContent = n; num.classList.remove('out'); }, 150);
    }
    function update() {
      const n = on.size;
      count.textContent = n + ' / ' + TOTAL;
      prog.style.strokeDashoffset = String(264 - (n / TOTAL) * 264);
      roll(n);
      head.classList.toggle('warm', n > 0);
    }
    function bind() {
      list.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const k = li.dataset.key;
        if (on.has(k)) { on.delete(k); li.classList.remove('on'); }
        else { on.add(k); li.classList.add('on'); }
        update();
      });
    }
    function enter() {
      on.clear();
      $$('li', list).forEach((li) => li.classList.remove('on'));
      head.classList.remove('warm');
      num.textContent = '0';
      count.textContent = '0 / 5';
      prog.style.strokeDashoffset = '264';
      if (!list.dataset.bound) { list.dataset.bound = '1'; bind(); }
    }
    return { enter };
  })();

  /* ── scene router: circular reveal from the tapped chip ────────── */
  const SCENES = { intro, fan, triage, expand, sheet: sheetMod, titles, wheel, comp: comp, casc };
  const NOTES = {
    intro: '<b>开场落下</b> · 五张照片依次落下堆叠，四张用弹簧收成扇形，标题随后升起',
    fan: '<b>扇形叠</b> · 左右拖动卡片，整组用弹簧重新摆位，标题与指示点跟随',
    triage: '<b>滑动分拣</b> · 拖过阈值或甩出去，卡片飞出，下一张从缩小压暗弹回',
    expand: '<b>共享元素</b> · 缩略图以左上角为原点位移加等比放大，操作按钮延迟 0.18 秒弹入',
    sheet: '<b>可收面板</b> · 下拉或点收起，面板下滑淡出、地图放大填满，圆角按钮回升',
    titles: '<b>逐行标题</b> · 旧标题逐行下落（间隔 60ms），新标题逐行上升，主视觉弹回',
    wheel: '<b>惯性滚轮</b> · 甩动带惯性减速，自动吸附到刻度，越界像橡皮筋弹回',
    comp: '<b>完成反馈</b> · 药丸收成圆、一笔画出对勾、粒子迸发，最后变「已加入」',
    casc: '<b>联动勾选</b> · 一个勾选同时驱动进度环、数字滚动、顶部背景',
  };
  let cur = 'intro';

  function show(id, ev) {
    if (id === cur || !SCENES[id]) return;
    const next = document.getElementById('sc-' + id);
    const prev = document.getElementById('sc-' + cur);
    const s = stage.getBoundingClientRect();
    let ox = s.width / 2, oy = s.height - 120;
    if (ev && ev.currentTarget) {
      const r = ev.currentTarget.getBoundingClientRect();
      ox = r.left - s.left + r.width / 2;
      oy = r.top - s.top + r.height / 2;
    }
    SCENES[id].enter();
    if (MO.reduce) {
      prev.classList.remove('on');
      next.classList.add('on');
    } else {
      next.classList.add('on');
      next.style.clipPath = `circle(0px at ${ox}px ${oy}px)`;
      const R = Math.hypot(Math.max(ox, s.width - ox), Math.max(oy, s.height - oy)) + 60;
      requestAnimationFrame(() => {
        next.style.transition = 'clip-path .56s cubic-bezier(.32,.9,.24,1)';
        next.style.clipPath = `circle(${R}px at ${ox}px ${oy}px)`;
      });
      setTimeout(() => {
        next.style.transition = '';
        next.style.clipPath = '';
        prev.classList.remove('on');
      }, 590);
    }
    cur = id;
    $$('#chips button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sc === id)));
    $('#note').innerHTML = NOTES[id];
  }

  $$('#chips button').forEach((b) => b.addEventListener('click', (e) => show(b.dataset.sc, e)));

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => SCENES[cur].enter(), 220);
  });

  SCENES.intro.enter();
  window.__demo = { show, SCENES, get cur() { return cur; } };
})();
