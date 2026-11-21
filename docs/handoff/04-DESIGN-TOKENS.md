# 设计 Token 与配色系统 · TickFlow v1.13.0

> 机器可读数据：`docs/handoff/schemes.json`
> 目标：9 套配色 × 浅/深/系统；所有组件只消费 token；旧 6 主题/6 强调色可迁移。

---

## 1. 模型

```
data-mode   = light | dark        // 由用户选择或 system 推导
data-scheme = kun-default | sky | parchment | mint | sakura | dusk | amber | ink | custom
data-font   = 82                  // 70..120，百分比
data-width  = 896                 // 640..1200，px
```

- `data-mode` 决定取 `schemes[scheme].light` 还是 `.dark`。
- `data-scheme` 决定色板；`custom` 用用户覆盖值。
- `data-font` 控制 `--font-scale`；`data-width` 控制 `--content-w`。
- 主题切换**不重建 DOM**，只改 `<html>` 属性 + CSS 变量。

## 2. 应用方式（推荐）

### 2.1 首屏兜底

`css/theme.css` 里保留 `:root` 的默认 dark token + `[data-mode="light"]` 的默认 light token，避免 JS 未执行时白屏/闪白。

### 2.2 运行时注入

`js/modules/appearance.js`：

```js
const SCHEMES = await fetch('data/schemes.json').then(r => r.json()); // 或构建时内联
function applyAppearance(a) {
  const mode = a.mode === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : a.mode;
  const tokens = SCHEMES.schemes[a.scheme][mode];
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.dataset.scheme = a.scheme;
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty('--' + kebab(k), v));
  root.style.setProperty('--font-scale', a.fontSize / 82); // 82 = v1.12 正文基准，不是 16px 的 82%
  root.style.setProperty('--content-w', a.contentWidth + 'px');
  root.dataset.font = a.fontSize;
  root.dataset.width = a.contentWidth;
}
```

- 自定义：`a.custom` 覆盖 `bg/panel/border/accent`，其余从 kun-default 派生。
- 切换时加 `.theme-anim` 180ms，之后移除；`prefers-reduced-motion` 不加。
- 顶部岛窗口加载同一份 `schemes.json`，保证双岛同帧换肤。

### 2.3 CSS 消费

```css
.app-shell { background: var(--bg); color: var(--text); }
.sidebar   { background: var(--panel); border-right: 1px solid var(--border); }
.card      { background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-lg); }
.btn.pri   { background: var(--accent); color: var(--accent-ink); }
```

**禁止**：组件里写 `#0A1220`、`rgba(90,167,255,.14)` 等裸值；只能 `var(--...)`。

## 3. Token 清单

| Token | 用途 | 约束 |
|---|---|---|
| `--bg` | 窗口底色 | 不用纯黑/纯白 |
| `--panel` | 卡片/侧栏 | 比 bg 亮一档 |
| `--panel-2` | 次级面板/hover | 比 panel 亮一档 |
| `--panel-3` | 输入/控件底 | 比 panel2 亮一档 |
| `--border` | 1px 边框 | 低对比 |
| `--border-strong` | hover/选中边框 | 比 border 明显 |
| `--text` | 正文 | 对 panel ≥4.5 |
| `--text-2` | 次要 | 对 panel ≥4.5 |
| `--text-3` | 元信息 | 对 panel ≥4.5 |
| `--accent` | 主色 | 选中/主按钮/滑杆 |
| `--accent-2` | 同色系亮档 | 渐变只允许同色系 |
| `--accent-ink` | 彩色底上的文字 | dark 近黑 / light 白 |
| `--accent-soft` | 选中底/焦点环 | 透明色 |
| `--success` | 完成/已实现 | 不用于大底 |
| `--warning` | 到点/权限 | 不用于大底 |
| `--danger` | 删除/逾期 | 不用于大底 |
| `--selection` | 文本选中/选中行 | 低饱和 |

> 颜色语义不随 scheme 改；scheme 只改色相，不改“成功=绿、危险=红”的语义。

## 4. 类型与间距

### 字号

| Token | 值 | 用途 |
|---|---|---|
| `--fs-micro` | 11px | 元信息、标签 |
| `--fs-cap` | 12px | 辅助说明 |
| `--fs-body` | 13.5px | 正文、任务标题 |
| `--fs-title` | 14px | 卡片标题 |
| `--fs-h2` | 20px | 页面标题 |
| `--fs-h1` | 28px | 英雄标题 |

- 全局 `--font-scale` 乘到字号：**82% = v1.12 正文 13.5px 的基准点**，不是 16px 的 82%。推荐：
  ```css
  :root { --font-scale: 1; } /* 82% */
  html { font-size: calc(16px * var(--font-scale)); } /* 82% -> 16px；100% -> 19.5px */
  body { font-size: 0.84375rem; } /* 16 * 0.84375 = 13.5px */
  ```
  这样默认 82% 与 v1.12 视觉一致；100% 才变大，70% 才变小。若组件仍用 px，写 `font-size: calc(13.5px * var(--font-scale))` 等比例换算。
- 数字 `font-variant-numeric: tabular-nums`。

### 间距

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40`；不要 5/7/13 等随机值。

### 圆角

`--r-sm 6`、`--r-md 8`、`--r-lg 12`、`--r-xl 14`、`--r-pill 999`。

### 阴影

```css
--shadow-1: 0 1px 2px rgba(0,0,0,.28);
--shadow-2: 0 10px 28px rgba(0,0,0,.34);
--shadow-3: 0 24px 60px rgba(0,0,0,.50);
```

浅色方案用对应低透明黑；不要彩色外发光。

## 5. 9 套配色

| scheme | 名称 | 描述 | 主色（dark/light） |
|---|---|---|---|
| `kun-default` | 默认 | 雾灰底 · 柔和蓝 | `#5AA7FF` / `#2768C2` |
| `sky` | 晴空蓝白 | 白底 · 天空蓝 | `#6FB6FF` / `#1F6FD6` |
| `parchment` | 羊皮纸 | 米白纸张 · 青绿 · 梅紫 | `#37C2AE` / `#0A6F65` |
| `mint` | 薄荷 | 浅绿底 · 薄荷绿 | `#3DDC97` / `#0E7A5A` |
| `sakura` | 樱粉 | 奶白粉 · 樱桃红 | `#FF7A95` / `#C62F4A` |
| `dusk` | 暮紫 | 淡紫底 · 薰衣草紫 | `#A78BFA` / `#6A4BC8` |
| `amber` | 琥珀 | 暖米色 · 琥珀橙 | `#F5A623` / `#9A5B00` |
| `ink` | 墨石 | 黑白灰 · 无彩色 | `#D6D6D6` / `#4A4A4A` |
| `custom` | 自定义 | 背景/面板/边框/强调色 | 用户 |

完整 token 见 `schemes.json`。实现时：

1. 先按 JSON 原样落地。
2. 跑 `tests/theme.test.mjs` 的对比度断言；不达标时**只调该 scheme 的 text/text2/text3/panel**，不要改 token 名。
3. 记录调整到 `IMPLEMENTATION-NOTES.md`。

## 6. 旧主题迁移

v1.12 的 `settings.theme` / `settings.accent` 保留读取，迁移到新字段：

```js
const map = {
  graphite: ['kun-default', 'dark'],
  night:    ['ink', 'dark'],
  tundra:   ['mint', 'dark'],
  dawn:     ['parchment', 'light'],
  mist:     ['sky', 'light'],
  paper:    ['parchment', 'light'],
};
const [scheme, mode] = map[old.theme] || ['kun-default', 'dark'];
appearance.scheme = scheme;
appearance.mode = old.theme ? mode : 'system';
appearance.accentOverride = old.accent && old.accent !== 'blue' ? ACCENTS[old.accent] : null;
```

- 旧 `density` 保留：`normal | compact` 映射到 `--row-h`。
- 旧 `theme`/`accent` 字段**不要删**，保留一年，方便回滚。
- 迁移前强制 `Store.snapshot(true)`；失败回滚。

## 7. 对比度门槛

- 正文/元信息（`--text`/`--text-2`/`--text-3`）对 `--bg` 和 `--panel` 取最差 ≥ **4.5**。
- 主按钮文字（`--accent-ink`）对 `--accent` ≥ **4.5**。
- 非文本图形（圆环、开关、图标）对背景 ≥ **3.0**。
- 渐变按钮：取字形覆盖带内最差，不得用白色提亮顶部（v1.12 DEF-01 教训）。
- 禁用态可低于 4.5，但需明显“不可用”（opacity .45）。

## 8. 与现有文件的关系

| 文件 | 处理 |
|---|---|
| `css/theme.css` | 保留为“默认 token + 首屏兜底”；新增 `appearance.js` 运行时注入；删除 6 主题旧块 |
| `css/app.css` | 删除旧 `:root` 颜色声明、旧 `.btn.pri` 提亮渐变、蓝阴影（I-17） |
| `css/refresh.css` | 保留尺寸/字号/时长；颜色全部改 token |
| `css/extra.css` | 兼容层；逐步收编到 `app.css` |
| `css/features.css` | 新组件样式（侧栏/设置/配色卡/滑杆/涟漪） |
| `js/modules/theme.js` | 改为 `appearance.js` 的一部分，或保留 `TF.applyTheme` 兼容包装 |
| `tests/theme.test.mjs` | 改为读 `schemes.json`，断言 9×2 对比度 |

## 9. 验收

- [ ] 9 套 × 浅/深，`--text/--text-2/--text-3` 对 bg/panel ≥4.5
- [ ] 主按钮/滑杆/开关/焦点环可见
- [ ] 无组件裸 hex（`grep` 排除 token 文件）
- [ ] 切换方案不闪白、不重建 DOM、不丢滚动
- [ ] 顶部岛与主窗同帧换肤
- [ ] 旧主题迁移后视觉合理，可回滚
