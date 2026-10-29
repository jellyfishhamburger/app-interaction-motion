---
name: app-interaction-motion
description: Use when app or mini-program interactions must feel native. 19 gesture-driven patterns (drop-and-gather intro, shared-element expand, swipe-to-triage, inertial picker, coordinated feedback) with a spring engine, the craft rules that make them read as designed, and a CDP harness that proves each one frame by frame.
version: 1.0.0
license: MIT
platforms: [windows, macos, linux]
metadata:
  hermes:
    tags: [motion, gesture, spring, shared-element, mobile, mini-program, feedback, app]
    category: creative
    related_skills: [web-motion-design, touch-first-web-ui, design-taste-frontend, local-web-ui-verification]
---

# App-grade interaction motion

Class of work: 「把 App / 小程序做得高级一点」「这些交互细节能不能实现」「让它不像模板导出的」.
The deliverable is not a page full of effects — it is **a small number of gestures, each with a
complete and coordinated response**, driven by real physics and proven on a phone.

**Scope.** Owns gesture-driven motion on an app screen: drag/fling/snap, sheets, shared-element
transitions, staged micro-feedback, and one gesture driving several elements at once.
Not this skill: page entrances and scroll reveals (`web-motion-design`), page structure and copy
(`landing-page-design`), art direction and the anti-slop house style (`design-taste-frontend`),
thumb-sized hit areas and one-hand layout (`touch-first-web-ui`).

## The one rule everything else serves

> **让每一次触碰都有清楚回应。** A tap that only changes colour is why a build feels cheap; a tap that
> moves the thing, updates three readouts, and lands somewhere feels expensive — even when the code is
> smaller.

Five rules that follow from it:

1. **One gesture, several synchronised responses.** Ticking a row grows a ring, rolls a number, changes
   the header tone. Keep the parts on one timeline (same start, `60–90 ms` stagger at most) so they read
   as one event, not three.
2. **Follow the finger, then hand the velocity to a spring.** While dragging, write the transform
   directly (no easing). On release, seed the spring with the measured pointer velocity, or the object
   stops dead and the gesture feels cut.
3. **Two stages per object: hover prepares, tap commits.** A hover that does nothing reads dead; a tap
   that plays the same animation regardless of the gesture reads unresponsive.
4. **Act before the animation ends** (~45 % in, or 250–320 ms), so the affordance never becomes a
   loading screen.
5. **Every stage degrades.** `prefers-reduced-motion` jumps to the end state (the engine does this for
   you); hover is gated behind `@media (hover:hover) and (pointer:fine)`.

## The catalogue: 19 patterns

Full mechanisms, parameters and code: `references/patterns.md`. Pick **two or three** for one build —
a screen remembered for one move beats a screen with nineteen.

| # | 模式 | 触发 | 核心机制 | 用在哪 |
|---|---|---|---|---|
| 1 | 开场落下收拢 | enter | 重力落下 → 停顿 → 弹簧收成扇形，其余飞出、标题升起 | 首页首屏 |
| 2 | 扇形叠切换 | drag | 整组按索引重排位（弹簧），标题与指示点跟随 | 目的地 / 商品浏览 |
| 3 | 滑动分拣 | drag + fling | 跟手 + 阈值 + 飞出，下一张从缩小压暗弹回 | 推荐、待办处理 |
| 4 | 共享元素放大 | tap | 4:5 缩略图以左上角为原点位移 + 等比放大，操作延迟 0.18 s | 列表 → 详情 |
| 5 | 可收起面板 | drag / tap | 面板下滑淡出，舞台位移放大填满，圆角按钮原路回升 | 地图 + 行程 |
| 6 | 逐行标题切换 | tap | 每行独立遮罩，旧标题逐行下落 60 ms，新标题逐行上升 | 换内容不换页 |
| 7 | 惯性滚轮 | drag + fling | 速度 → 摩擦减速 → 吸附刻度，越界橡皮筋 | 时间 / 数量选择 |
| 8 | 完成反馈按钮 | tap | 药丸 clip-path 收成圆 → 一笔画勾 → 粒子 → 变「已加入」 | 主行动按钮 |
| 9 | 联动勾选 | tap | 一项勾选驱动进度环 + 数字滚动 + 顶部背景 | 待办 / 清单 |
| 10 | 叠卡展开 | tap | 层叠卡片依次展开再整齐收回，节省空间 | 素材、图层、相册 |
| 11 | 吸附卡 + 画线 | drag + snap | 松手吸附到中间卡，停稳后时间线逐段绘出 | 日程、时间线 |
| 12 | 圆形扩散转场 | tap | 从手指位置扩散铺满全屏（`clip-path: circle()`） | 页签切换、开新页 |
| 13 | 空行程引导 | 状态 | 空态给发现入口，返回时内容依次入场 | 冷启动 / 空列表 |
| 14 | 分类筛选联动 | tap | 选中态切换 + 结果卡片依次进入（不是整块重绘） | 筛选、标签 |
| 15 | 滑卡回弹 | drag | 短拖松手回弹；过阈值顶卡移走、后卡顶上、计数减一 | 卡片流 |
| 16 | 天数联动 | tap | 加减同时改两处数字，减到 1 禁用减号（状态不只靠颜色） | 预订、排期 |
| 17 | 行程确认 | tap | 按钮变「已加入」，进度环与地点数依次更新 | 加入购物车 / 加入行程 |
| 18 | 波形进度条 | drag | 一排竖条表示进度，已过部分高亮，按住拖动 scrub | 音频、长文、流程 |
| 19 | 图片展开（列表内） | tap | 小图连续展开成大图，文字后进入，返回收回原位 | 画廊、朋友圈式流 |

## Procedure

1. **Inventory the triggers before writing CSS.** Tag every block `enter` / `drag` / `tap` / `state`.
   Anything without a trigger is decoration — cut it.
2. **Tokens first.** `--mo` (intensity multiplier), `--dens`, `--radius`, one easing pair, ≤3 durations.
   Durations written `calc(450ms * var(--mo))`; JS reads the same value so scripted timings scale too.
3. **One signature move, perfect, at 390 px.** Then the coordinated feedback, then everything else.
4. **Build one object at a time and screenshot each state** (idle / mid / end). A batch of "done" whose
   entries were never frame-checked is how 水平忽高忽低 happens.
5. **Give every scene content density.** A layout with one card and 200 px of empty ground reads
   unfinished no matter how good the spring is — add the real list, the meta row, the caption.
6. **Degrade, then prove** with `demo/verify.mjs` (real pointer events, stepped scroll, 1440 + 390,
   reduced-motion reload).

## Physics

`references/gesture-physics.md` — closed-form damped oscillator, 2-D vector springs with velocity
hand-off, pointer velocity tracker, rubber-band overscroll, fling landing prediction, and a table of
measured feel parameters (stiffness / damping per interaction).

Rules that matter most:

- **`cubic-bezier` cannot overshoot.** Anything that must read as a physical object (a card taking the
  next slot, a panel dropping back, a wheel snapping) is driven by the spring, not a transition.
- **Never animate `width`/`height`/`top` for the move.** `transform`, `opacity`, `clip-path` only; a
  pill that must become a circle uses `clip-path: inset()` so no layout happens.
- **Interruption must carry velocity** — reversing mid-flight with `v = 0` stutters.
- **A spring that must fly off-screen is not a spring you wait for.** Promote the next item the moment
  the gesture commits; hide the traveller when it finishes.

## Craft: why a build looks designed instead of generated

`references/craft-and-look.md`. Short form:

- **One ground, one ink, one accent** (paper cream · near-black · a single warm red reads designed;
  five pastels reads generated). Muted, slightly desaturated, flat fills — no gradients, no glows.
- **Hand-drawn illustration language:** no outlines, hand-cut irregular silhouettes, one flat colour per
  shape, a print grain over everything (`feTurbulence` at ~0.13 opacity). Reference: the gouache
  illustrations on fred.pt.
- **Two or three type sizes do the work**; the number or the object is the hero, not the label.
- **Fill the frame.** Every screen gets a real composition: a dominant element plus the content it
  carries. Empty band taller than ~half a screen = unfinished section, not a rest.

## Pitfalls (all of these were real bugs)

- **`[hidden]` loses to `display:flex`.** A "done" overlay styled `position:absolute;inset:0;display:flex`
  covers the whole scene even with `hidden` set, and hides the header, the buttons and the stamps — while
  the cards still show, because their inline `z-index` lifts them above it. Add `[hidden]{display:none}`.
- **Promoting the next card inside the fly-out's `onComplete`** makes a swipe feel broken: the card leaves
  the screen in ~150 ms, but an over-damped spring keeps chasing for over a second, so the next card
  waits. Advance the index at commit time; let the traveller finish on its own.
- **A 4:5 shared element scaled to a full-bleed box** leaves the copy floating at the screen bottom,
  disconnected from the image. Reserve ~210 px for the copy and position it under the image's real rect.
- **A hub of empty space under a card** is the most common "unfinished" report. Enlarge the card, or add
  the meta row / itinerary / hint that the screen already implies.
- **A picker that snaps but does not coast** feels like a slider, not a wheel: multiply release velocity
  by the item height to predict the landing, then spring to it with the same velocity.
- **Synthetic `element.click()` never triggers `:hover`** and real drags need `pointerdown` +
  `setPointerCapture`. Verify with `Input.dispatchMouseEvent`, not with `.click()`.
- **A number that changes by swapping text jumps.** Roll it: `translateY` inside an overflow-hidden
  box, swap the text mid-flight.

## Files

| File | Read it when |
|---|---|
| `references/patterns.md` | Building any of the 19: mechanism, parameters, code sketch, pitfalls. |
| `references/gesture-physics.md` | Anything drag/fling/snap/spring: the engine and the feel numbers. |
| `references/craft-and-look.md` | The look: palette, hand-drawn illustration, composition density, typography. |
| `demo/` | A working 9-scene harness (drop & gather, fan, triage, shared element, sheet, title swap, wheel, complete button, cascade). `node demo/serve.mjs` or open `demo/index.html`. |
| `demo/verify.mjs` | The proof: 24 assertions incl. real drags, spring sampling, 390 px overflow, reduced motion. |
