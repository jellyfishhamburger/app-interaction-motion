# The 19 patterns

Each entry: **触发** (what starts it) · **机制** (the mechanism that makes it read right) · **参数**
(the numbers that matter) · **代码** (a sketch; the running version is in `demo/app.js`).

Two rules apply to all of them: `transform` / `opacity` / `clip-path` only, and the release velocity is
always handed to the spring (`MO.spring` / `MO.springVec` in `demo/engine.js`).

---

## A. 首屏与浏览

### 1. 开场落下收拢 (drop and gathering intro)
- **触发** enter，每次进入首页只播一次。
- **机制** 五张照片从画面上方落下（弹簧 `stiffness 300 / damping 21`，落点有轻微过冲 = 重量感），
  依次错开 95 ms 形成堆叠；停顿约 700 ms 后四张用更大的行程收成扇形（`250 / 20`），第五张带着
  向下的初速度继续飞出画面（`130 / 28` + `velocity [0, 520]`），标题与面板随后升起。
- **参数** 落下 95 ms 递增；堆叠抖动 ±18 px、±9°；扇形展开 x ±25 / ±72、rotate ∓5 / ∓14°、scale 0.94。
- **代码**
```js
photos.forEach((p, i) => setTimeout(() => {
  MO.springVec({ from: [x, -PH - 60, 0, 1], to: [x + JX[i], 292 + JY[i], ROT[i], 1],
    stiffness: 300, damping: 21, onUpdate: v => place(p, v) });
}, i * 95));
// 收拢：四张进扇形，第五张继续下落
MO.springVec({ from: p._v, to: [x, H() + PH + 80, -18, 0.9],
  stiffness: 130, damping: 28, velocity: [0, 520, 0, 0], onUpdate: v => place(p, v) });
```
- **坑** 照片必须居中（`baseX = (w - PW) / 2`），扇形偏移直接从中心加减，否则右侧会被屏幕切掉；
  标题用 `overflow:hidden` 的行遮罩上浮，不要整体淡入。

### 2. 扇形叠切换 (fan stack swipe)
- **触发** 左右拖动最前那张卡。
- **机制** 松手后**整组按新索引重新计算插槽**，每张各自 spring 到新位置——不是只移动一张，整叠一起
  重排才有"扇形"的层次。
- **参数** 偏移 46 px / 层、rotate 10° / 层、scale 每层 −0.05、`spring 260 / 22`。
- **代码**
```js
const slot = i => { const d = i - idx; if (!d) return [0,0,0,1];
  const side = d % 2 ? 1 : -1, mag = Math.ceil(Math.abs(d)/2);
  return [side*mag*46, Math.abs(d)*7, side*mag*10, 1 - Math.abs(d)*0.05]; };
cards.forEach((c, i) => MO.springVec({ from: c._v || slot(i), to: slot(i),
  stiffness: 260, damping: 22, velocity: i === idx ? [v.vx, 0, v.vx*0.02, 0] : undefined,
  onUpdate: v => { c._v = v; place(i, v); } }));
```
- **坑** 只在拖过 `0.18 × 宽度` 或 `|vx| > 420` 时换页，否则回弹；标题与指示点跟索引走，不要等动画结束。

### 13. 空行程引导 (empty-state handoff)
- **触发** 列表为空（`state`）；返回时反向。
- **机制** 空态不是一张哭脸，而是一个**发现入口**；点击它切到发现页，内容按 `60–90 ms` 依次入场，
  让人感到"有东西进来了"。
- **坑** 空态与内容态共用同一容器时，记得清掉旧的 `transform`，否则回来的卡片都带着上次的位移。

### 14. 分类筛选联动 (filter with staggered entry)
- **触发** 点击分类 chip。
- **机制** 三件事同时发生：chip 选中态（背景 + 文字色，加 `layout shift` 为零的 `clip-path` 或胶囊滑动）、
  结果区先淡出 120 ms，再让新卡片以 `70 ms` 间隔依次进入。
- **参数** 入场 `translateY 16 → 0`, `opacity 0 → 1`, `spring 320 / 26`。
- **坑** 不要整块重绘后直接出现——一次性替换内容，用户读到的是"闪了一下"。

---

## B. 手势卡

### 3. 滑动分拣 (swipe to triage)
- **触发** `pointerdown` 在顶卡上拖动。
- **机制** 跟手写 `translate3d(dx, dy*0.02, 0) rotate(dx*0.05deg)`，同时两个印章的 `opacity`
  按 `min(1, |dx| / 110)` 增长；松手过阈值就带着 `vx` 飞出，下一张从 `scale .95` 弹回 1。
- **参数** 阈值 `96 px` 或 `|vx| > 620`；飞出 `spring 120 / 27` + `velocity vx`，目标在屏幕外
  `W + 220`；左右两侧各自对应两种操作（跳过 / 收藏）。
- **代码**
```js
MO.springVec({ from: c._v, to: [dir * (W() + 220), 30, dir * 18, 1],
  stiffness: 120, damping: 27, velocity: [vx, 0, 0, 0], onUpdate: v => place(c, v) });
top++; count_(); arrange(null);      // 立即顶上，不等飞出结束
```
- **坑** 见 `SKILL.md` 的 pitfall：在 `onComplete` 里才 `top++` 会让下一张等一秒多。

### 15. 滑卡回弹 (snap-back)
- **触发** 短拖后松手（未过阈值）。
- **机制** 用**当前拖到的位置**作为 `from` 重新起一个 spring（不是 `from: 0`），否则卡片会瞬移回原点
  再动，节奏断掉。
- **参数** 回弹 `340 / 30`，`epsilon .35`。
- **坑** 回弹时清掉印章透明度，否则下次拖动的印章会从上次的残留开始。

### 11. 吸附卡 + 画线 (scrub-snap with a timeline that draws)
- **触发** 上下拖动一组卡片，松手。
- **机制** 两段：卡片先 spring 吸附到最近的中间位（`stiffness 280 / damping 28`）；**在 `onComplete`
  里**再启动时间线绘制（`stroke-dashoffset` 250 → 0，每段间隔 80 ms），"停稳 → 画线"的顺序就是节奏。
- **坑** 不要在拖动过程中画线，手指还在动时线就在长，会显得失控。停稳后再画。

---

## C. 转场与共享元素

### 4 / 19. 共享元素放大 (shared element expand)
- **触发** 点击缩略图。
- **机制** FLIP：以缩略图 `getBoundingClientRect()` 为起点，把大图元素定位成缩略图大小，再
  `translate + 等比 scale` 到目标框。**两端比例必须一致（4:5 对 4:5）**，scale 才是等比的。
- **参数** 放大 `spring 300 / 30`；操作按钮 `transition-delay .18s`；返回 `340 / 31`。
- **代码**
```js
const s = tw / r.w, dx = tx - r.x, dy = ty - r.y;
MO.springVec({ from: [0, 0, 1], to: [dx, dy, s], stiffness: 300, damping: 30,
  onUpdate: v => card.style.transform = `translate3d(${v[0]}px,${v[1]}px,0) scale(${v[2]})` });
```
- **坑**
  - 目标框要**给文案留位置**（预留约 210 px），否则标题会飘在屏幕底部、和图片脱开；
  - 遮罩用页底色而不是黑色 20%，否则更像弹窗而不是"进入下一页"；
  - 返回时把 `from` 设为当前值再回到 `[0,0,1]`，中途打断也能接着走。

### 5. 可收起面板 (dismissible sheet)
- **触发** 下拉超过 90 px，或点「收起」。
- **机制** 两件事同步：面板 `translateY → 高度 + 40` 并淡出（`300 / 30`），**舞台同时 scale 1 → 1.14
  并去掉圆角**，把面板让出的空位填满；底部留一个圆角按钮，点击原路回升（`400 / 21`，带过冲）。
- **参数** 拖动时舞台 scale 跟随 `1 + dy/height * 0.14`。
- **坑** 只让面板消失、舞台不动，会出现一块死空间，读起来像"关掉之后不知道看哪儿"。

### 12. 圆形扩散转场 (circular reveal)
- **触发** 点击底部页签 / 任何切换入口。
- **机制** `clip-path: circle(0px at x y)` → `circle(Rpx at x y)`，圆心取**被点元素在舞台坐标系里的中心**
  （页签在屏幕下方时半径为 `hypot(...) + 60`）；新页先挂上、旧页在动画结束后移除。
- **参数** `.56s cubic-bezier(.32,.9,.24,1)`；`prefers-reduced-motion` 直接切。
- **坑** 用 `element.click()` 触发时 `currentTarget` 还在，但键盘触发（Enter）没有坐标——回退到屏幕中心。

---

## D. 文本

### 6. 逐行标题切换 (staggered title swap)
- **触发** 点击「换一批」或索引变化。
- **机制** 每行独立 `overflow:hidden` 遮罩：旧行 `translateY(105%)` 下落，`60 ms` 递增；
  新行先置 `105%`，再逐行升到 0（同样 60 ms 递增）；主视觉 `scale 1 → .94` 缩小淡出，随后
  `380 / 20` 弹回并换成新图。
- **参数** 旧行 300 ms、新行 520 ms、行间隔 60 ms、换文本的时刻 330 ms（旧行已让位）。
- **坑** CJK 标题按字符拆分会在任意字间换行；用显式行数组（一行一个 `<span>`），行数固定 2–3 行。

---

## E. 控件与反馈

### 7. 惯性滚轮 (inertial picker)
- **触发** 拖动滚轮列，松手。
- **机制** 拖动时越界用橡皮筋压缩（`MO.rubber`）；松手后用指针速度预测落点
  `pos + (vy / ITEM) * 0.22`，再 spring 到该刻度的整数位置，并把 `vy * 0.35` 作为初速度，于是
  会先冲过一点再回来——这才是"惯性"。
- **参数** `ITEM 56 px`、吸附 `210 / 23`、橡皮筋 `factor .55`、预测系数 `0.22`。
- **代码**
```js
const vy = tr.v().vy, pos = (centre() - y) / ITEM;
const target = clamp(Math.round(pos + (vy / ITEM) * 0.22), 0, N - 1);
MO.spring({ from: y, to: centre() - target * ITEM, stiffness: 210, damping: 23, velocity: vy * 0.35 });
```
- **坑** 没有 `velocity` 的吸附读起来像滑块一格一格跳；每一次拖动都要 `moved = true` 才算手势，
  纯点击走另一条路径。

### 8. 完成反馈按钮 (staged completion)
- **触发** 点击主行动按钮。
- **机制** 四拍、每拍都有可见反馈：
  1. `clip-path: inset(0 → calc(50% - 27px))` 把药丸收成圆（**不是动画 width**，没有 layout）；
  2. 对勾 `stroke-dashoffset 26 → 0`，一笔画出；
  3. 14 个粒子沿圆周迸发（`translate + scale`，`8 ms` 递增，620 ms 淡出）；
  4. `clip-path` 展开回药丸、底色换成完成色、文案换「已加入 · 3 个地点」。
- **参数** 230 / 740 / 760 / 880 ms 四个节点。
- **坑** 用 `scaleX` 把按钮压扁会把文字挤变形；粒子容器 `pointer-events:none`，否则挡住再次点击。

### 9. 联动勾选 (coordinated cascade)
- **触发** 勾选一行。
- **机制** 一个动作驱动四处：`stroke-dashoffset` 按 `1 - n/total` 增长（`transition .55s`）、
  数字用 `translateY` 滚动换值、顶部背景换色阶、计数文案更新。四处同时起步。
- **参数** 环 `stroke-dasharray 264`（r=42）、数字滚动 150 ms 换字、背景 `transition .5s`。
- **代码**
```js
prog.style.strokeDashoffset = String(264 - (n / TOTAL) * 264);
num.classList.add('out'); setTimeout(() => { num.textContent = n; num.classList.remove('out'); }, 150);
head.classList.toggle('warm', n > 0);
```
- **坑** 直接把 `textContent` 换掉会"跳"；用外层 `overflow:hidden` + 内层 `translateY` 才有滚动感。

### 16. 天数联动 (stepper that updates two places)
- **触发** 点 + / −。
- **机制** 一处改、两处同步（顶部摘要与底部总价）；两个数字用同一 spring 或同一 `transition`，
  **减到最小值时禁用减号，并且视觉上真的变灰 + `disabled` + `aria-disabled`**，不只靠颜色。
- **坑** 只禁用不提示会被当成 bug；把边界值写在旁边（"最少 1 天"）。

### 17. 行程确认 (add-to-trip confirmation)
- **触发** 点「加入行程」。
- **机制** 复用 8 的四拍，但收尾是**数字类反馈**：进度环 `+1/N`、地点数 `n → n+1` 递增。
- **坑** 按钮不要变成 loading——`已加入` 是一个终态，可以再点一次取消（给出明确文案）。

### 18. 波形进度条 (waveform scrubber)
- **触发** 按住拖动。
- **机制** 一排竖条（约 60–90 根，高度由数据生成），已过部分用强调色、未过部分低对比；
  拖动时**只改已过区间的宽度**（一个 `clip-path` 或 `scaleX`），不要逐根改 `background`。
- **参数** 拖动时不做 easing；松手后可吸附到 5% 的整数步（`spring 300 / 30`）。
- **坑** 竖条数量随容器宽度变化时，重排要保数据映射（`data-i` → 区间），否则进度会错位。

---

## F. 容器

### 10. 叠卡展开 (stacked cards that unfold)
- **触发** 点击叠放卡片。
- **机制** 每张卡按索引 `y = i*8`、`scale = 1 - i*0.04` 叠放；点击后依次（`60 ms`）展开成纵向列表
  （`spring 300 / 26`），再点一次整齐叠回。
- **坑** 展开后要给容器高度变化留出口（`height:auto` 的父容器 + 子元素 `transform` 动画），
  否则会裁掉第一部分；或者用 `overflow:visible` + 占位元素。
