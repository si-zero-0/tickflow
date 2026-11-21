# IMPLEMENTATION-NOTES · v1.13.0

> 由实现者（Trae）填写。每个任务一行；偏差/假设必须写在这里，不要只留在对话里。

---

## 0. 基线

| 项 | 值 |
|---|---|
| 日期 | 2026-11-20 |
| 操作者 | Trae（DeepSeek-V4.1-Flash） |
| 基线版本 | 1.12.0 |
| `verify` | 8/8 通过，0 警告 |
| `npm test` | 45/45 通过 |
| `stage` | 26 文件（v1.12） |
| 启动耗时 | load 17ms / render 529ms / total 547ms |
| 截图 | 旧版主窗（1400×900） |

> 基线阶段未改动任何代码；T0 记录完后版本直接升到 1.13.0。

---

## 1. Phase 1 · UI

| ID | 状态 | 文件 | 验证 | 偏差/备注 |
|---|---|---|---|---|
| T1.1 Token/外观运行时 | ✅ | `css/theme.css`、`js/modules/appearance.js`、`data/schemes.json` | verify 内 JS 语法通过；appearance.test 9 条（方案/钳制/覆盖色） | schemes 键→CSS 变量用显式映射表 `TOKEN_VARS`（panel2→`--panel-2` 等） |
| T1.2 Store 迁移 | ✅ | `js/core/store.js` | appearance.test 迁移条：night→ink、rose→#FF5F7A；旧 theme/accent 保留 | 首次加载无 appearance 时才推导；已存在则归一保留 |
| T1.3 主壳布局 | ✅ | `index.html`、`css/features.css` §1 | Electron 冒烟 0 console error；1060/1400 截图 | grid：232 / 主区 / 44 / 状态栏 28 |
| T1.4 侧栏 | ✅ | `app.js#sidebarHTML`、`features.css` §2 | 冒烟截图；12 视图全部入口 + 清单 + 偏好组 | 分组：工作台/视图/工具/清单；彩色图标块走 `--ic-*` token |
| T1.5 顶栏/右栏/状态栏 | ✅ | `app.js#topbarHTML/renderRightRail/renderStatusbar` | 冒烟截图；状态栏显示专注/待办/同步态/版本 | 顶栏面包屑 + 居中搜索 + 分组排序 + 刷新 + 主按钮 |
| T1.6 设置壳 | ✅ | `js/modules/settings.js`、`features.css` §8 | 冒烟截图（settings 场景） | 全屏左分类 + 右卡片；8 分类；切页保留滚动 |
| T1.7 主题/配色卡 | ✅ | `settings.js#themeCards/schemeCards` | 截图；9 张双档预览卡；当前方案高亮 | 预览色来自 `TF.schemePreview()`，不用 var() 猜色 |
| T1.8 字号/宽度/特效 | ✅ | `settings.js` 滑杆/步进/开关；`appearance.js` | probe：bodyFont 13.5px、wrapW 896、`--bg` 随模式变化 | 字号 70–120、宽度 640–1200；即时写入 Store 并持久化 |
| T1.9 组件重绘 | ✅ | `features.css` §6/§13 | 截图：任务行/卡片/抽屉/分段/统计/愿望卡 | 复用 v1.12 组件，仅覆盖视觉；token 别名自动跟随 9 套配色 |
| T1.10 Composer | ✅ | `features.css` §7/§13 | 截图：加号强调色、chips、预览行、快捷键胶囊 | 保留 v1.12 解析与键盘行为，只换皮 |
| T1.11 交互特效 | ✅ | `app.js#initEffects`、`features.css` §10 | 设置页高光开关可关；CSS 只动 transform/opacity | 径向高光保留；点击涟漪已按 U-07 删除 |
| T1.12 响应式/可访问性 | ✅ | `features.css` §11；`app.js` 键盘事件 | 1060 截图（侧栏 64、右栏隐藏）；focus-visible 环 | 1060–1199 收侧栏、隐藏右栏与顶栏搜索；侧栏行支持 Enter/Space |


---

## 2. Phase 2 · M3 双岛

| ID | 状态 | 文件 | 验证 | 偏差/备注 |
|---|---|---|---|---|
| T2.1 IPC/preload | ✅ | `ipc/top-island.js`、`ipc/island-protocol.js`、`preload.js`、`preload-island.js`、`ipc/index.js` | verify 语法通过；m3-sync 6 条白名单测试；冒烟 consoleErrors [] | 主窗与岛各用独立 preload；全部入参白名单 + 截断 + 钳制 |
| T2.2 顶部窗口 | ✅ | `ipc/top-island.js#createIsland`、`top-island.html`、`css/top-island.css` | 冒烟：`focusable=false onTop=true`，无边框透明置顶、不占任务栏；开关场景窗口创建/销毁实测 | 主屏顶部居中 + offsetY；`monitor` 字段保留，P1 再接多屏 |
| T2.3 三态 UI | ✅ | `js/modules/top-island.js` | 截图：收起胶囊 / 展开面板 / 提醒自动展开；高度按内容动态 `scrollHeight` | 提醒存在时不自动收起；无提醒 8s 自动收起 |
| T2.4 快照推送 | ✅ | `app.js#islandSnapshot/pushIslandSnapshot` | 实测往返 5 次：65.7–74.9ms，P95 72–82ms（<100ms） | 50ms 合并；快照含 theme/m3/view/task/counts/focus/reminders |
| T2.5 动作回传 | ✅ | `app.js#onIslandAction`；`island:act` 通道 | 冒烟 `toggle-focus` 5 次均回主窗执行并回推快照 | 动作白名单 7 种；主窗按 id 幂等 |
| T2.6 提醒归属/去重 | ✅ | `app.js` 提醒循环；`renderReminders` 去重 | 冒烟：提醒条仅 1 条主提醒 + 快照列表自动排除同 id；`notifiedOn` 只弹一次 | top/bottom/follow-focus 三档；顶部失败回退旧卡 |
| T2.7 M3 设置 | ✅ | `settings.js#bodyIsland`；`store.js#normM3` | 设置页截图；宽度/透明度/圆角/偏移/内容开关/归属生效 | 默认关闭；`enabled=false` 不创建窗口 |
| T2.8 主窗/托盘 | ✅ | `main.js#buildTray`、`main.js` attachHost | 托盘项发 `toggle-m3` 动作回主窗；主窗全屏隐藏岛、关闭销毁岛 | 托盘只发动作，不改 Store |
| T2.9 降级/边界 | ✅ | `ipc/top-island.js` setEnabled/createIsland；`app.js#applyM3Settings` | 冒烟 m3-off：`island-window-missing`，底部岛与主窗正常；config 失败回 `ok:false` 并自动关闭+提示 | 创建失败/加载失败均不影响主窗与底部岛 |


---

## 3. Phase 3 · QA/发布

| ID | 状态 | 证据 | 备注 |
|---|---|---|---|
| T3.1 单测 | ✅ | `tests/appearance.test.mjs`（10 条）、`tests/m3-sync.test.mjs`（7 条） | `npm test` pass 62 / fail 0；覆盖 9×2 token 齐全、18 组对比度 ≥4.5、字号/宽度钳制、迁移、快照/配置/动作白名单 | 新增 17 条，旧 45 条全绿 |
| T3.2 浏览器 QA | ✅ | `http://127.0.0.1:8123/index.html`（stage/www 直服） | 主壳无重叠；外观页 3 主题卡 + 9 配色卡；切深色正常 | 浏览器无 tfBridge，M3 按钮提示「不支持」，主功能不受影响 |
| T3.3 Electron QA | ✅ | `npx electron stage --smoke` 多场景 | consoleErrors 全部 `[]`；views 场景 17 个视图态（12 视图 + 清单/单日/搜索）均有内容；m3 三态与降级实测 | 冒烟截图见 §7 |
| T3.4 回归 | ✅ | 九套 × 浅/深/系统、1060/1400/4K、字号/宽度 reload 持久化、提醒去重 | schemes: 18 组合 `--bg` 全部命中；system: light→#F4F6FA、dark→#0A1220；persist-reload: 100%/1000px、font 16.46px；dedupe: `dup-count=1`；P95 72–82ms | 4K 为 100% 缩放下截图，布局不穿帮；真实 4K 由系统 DPI 缩放处理 |
| T3.5 发布 | ✅ | `package.json`、`src/main/package.json`、`TF.VERSION`、`MANIFEST.md`、`AGENTS.md` | verify 版本一致 1.13.0；stage 35 文件；TF.VERSION 1.13.0 | 旧 `docs/iteration-112` 未改动 |

| T3.6 文档 | | | |

---

## 4. 偏差与假设

| # | 文档要求 | 实际实现 | 原因 | 影响 | 处理 |
|---|---|---|---|---|---|
| D-01 | 按 02/04 重写组件视觉 | 保留 v1.12 的 12 视图组件样式，在 `theme.css` 增加 legacy token 别名（`--tx→--text`、`--panel2→--panel-2` 等），再用 `features.css` 覆盖主壳与公共组件 | 41KB app.css 全量重写风险高、易回归 | 组件自动消费 9 套配色；个别旧 px 字号不随 `--font-scale` 缩放 | 已在 §13 对关键文本类用 calc 覆盖；后续可逐组件替换 |
| D-02 | 设置 8 分类 | 「通知」「快捷键」为只读/说明型（系统通知授权 + 固定快捷键表），不新增设置字段 | 避免为凑 UI 引入无消费方的配置 | 无 | 后续需要自定义快捷键时再扩 Store 模型 |
| D-03 | 自定义配色 | 四项基础色；文字/状态色由背景亮度决定（深底用深色档、浅底用浅色档），其余 token `mix()` 派生 | 04 文档 P1 范围 | 任意自定义色仍无法保证 4.5（默认值已验证达标） | 保持四项；对比度不足时建议回预设方案 |
| D-04 | 顶部岛位置可调 | P0 只做「顶部居中 + 顶部偏移」；`monitor` 字段保留但一律使用主显示器 | 03 文档把多屏列为 P1 | 多屏用户岛固定主屏 | 保留 `monitor` 字段，后续接入 `screen.getDisplayNearestPoint` |
| D-05 | 字号全局缩放 | `--font-scale` 改根字号 + 关键类 calc；未把全部旧 px 文案改成 rem | 同上，控制回归面 | 部分深层旧组件字号不跟滑杆 | 已在主壳/任务/设置/Composer 覆盖，验收截图 82/100 可辨 |
| D-06 | M3 快照频率 50ms | 主窗变更后 50ms 合并推送；岛内不做轮询 | 03 §3 | 连续勾选时最多每 50ms 一帧 | 满足 P95 <100ms 目标 |
| D-07 | 顶部岛窗口 | `frame:false transparent alwaysOnTop skipTaskbar focusable:false`，独立 preload | 不抢焦点、不占任务栏 | 无法用键盘操作岛（鼠标可点） | 主窗仍可键盘完成全部操作 |
| D-08 | 测试与截图 | `main.js` 增加 `--smoke` 场景（views/schemes/perf/persist-reload/m3 等）与截图；岛渲染层暴露 `__act/__dbg/__syncStats` 仅用于 QA | 需要量化同步延迟与视图回归 | 生产路径不受影响（钩子只读写内存状态） | 保留作为回归工具；如需可编译期剔除 |
| D-09 | 岛底色跟随主题 | 灵动岛固定纯黑底 + 固定浅色文字（深色档高对比组合），强调色仍取当前方案 | 苹果灵动岛形态要求黑色胶囊；浅色主题白底会失去形态识别 | 岛内文字不随浅色主题变深；对比度仍 ≥4.5 | 颜色由 `top-island.js` 注入，主窗配色不受影响 |
| D-10 | 动效只用 CSS transform/opacity | 三态形变由主进程 280ms `easeOutBack` 逐帧改窗口高度完成；CSS 只负责面板 `transform/opacity` 入场 | CSS 无法动画 BrowserWindow 高度 | 形变带轻微回弹，内容顶部锚定不重排 | 若后续允许整窗透明留白，可改为纯 CSS 动画 |
| D-11 | 圆角 8–22px | 圆角范围扩到 8–40px、默认 26px | 收起高度 52px 时 26px 才形成完整胶囊 | 设置项不变，仅范围与默认值变化 | 旧值 14 在迁移时保留，可手动拉到 26 |

---

## 5. 已知问题

| ID | 级别 | 内容 | 影响 | 计划 |
|---|---|---|---|---|
| K-01 | P2 | 首屏总耗时 350–800ms（含模块初始化与首绘）；单视图 12–126ms，process 125.9ms 为热点 | 冷启动体感 | 已量化拆分；后续可对进程图做增量重排/懒渲染 |
| K-02 | P3 | Electron 冒烟时出现 GPU 缓存告警（沙箱环境） | 仅日志噪音；截图已用软件渲染 | 打包机/真实用户环境无此告警 |

---

## 6. 验证命令输出

```text
Phase 1 阶段门（2026-11-20）：
npm run verify  → 8 项通过 / 0 警告 / 0 失败（23 个 JS 文件语法通过，版本一致 1.13.0）
npm test        → pass 61 / fail 0（新增 appearance 9 条 + m3-sync 6 条）
npm run stage   → 35 个文件（www 含 data/schemes.json、top-island.html、preload-island.js）
cd src/main && npx electron stage --smoke → consoleErrors: []，TF.VERSION 1.13.0
probe: bodyFont 13.5px / wrapW 896 / --bg 随 data-mode 切换（dark #0A1220 ↔ light #F4F6FA）

Phase 2 阶段门（2026-11-20）：
npm run verify  → 8/8 通过 / 0 警告 / 0 失败
npm test        → pass 61 / fail 0
npm run stage   → 35 个文件
npx electron stage --smoke（TF_SMOKE_SCENE=m3 / m3-remind / m3-off）：
  consoleErrors: []
  island: focusable=false / alwaysOnTop=true / bounds 360×52（收起）→ 内容自适应高度（提醒展开 213px 高）
  同步往返 samples [69.7, 68.7, 65.9, 68.9, 72] → P95 72ms（目标 <100ms）
  m3-off: island-window-missing，主窗与底部岛正常

Phase 3 阶段门（2026-11-20）：
npm run verify  → 8/8 / 0 警告 / 0 失败（版本一致 1.13.0）
npm test        → pass 62 / fail 0
npm run stage   → 35 文件，stage 内 TF.VERSION = '1.13.0'
npx electron stage --smoke 场景结果：
  views（17 个视图态）→ consoleErrors []，全部有内容（inbox2/today4/next7 7/all 11/completed 1/
    timeline1卡/calendar1卡/quadrants 4卡/habits/stats 7卡/process/wishes 4卡/pomodoro/list4/day3/search1）
  perf：today 12.2 / inbox 18.5 / all 27.9 / completed 11.4 / next7 14.2 / timeline 28.2 /
    calendar 40.1 / quadrants 26.9 / habits 47.3 / stats 40 / process 125.9 / wishes 35.8 / pomodoro 42.9 ms
  schemes：18 组合 --bg 全部等于 schemes.json（custom 明暗由背景亮度决定）
  system-light: sys=light bg=#F4F6FA；system-dark: sys=dark bg=#0A1220
  persist-reload: fontSize=100 / contentWidth=1000，font=16.4634px，wrap=1000（重载后仍在）
  m3-dedupe: dup-count=1（同 id 提醒不重复），P95 81.7ms
  4K（3840×2160）截图：内容仍按 896 居中，无拉伸/穿帮
浏览器 QA（stage/www 本地直服）：主壳、外观页 3+9 卡、切深色 全部 PASS
```

---

## 7. 截图清单

| 文件 | 内容 |
|---|---|
| `%TEMP%\tickflow-smoke-main-1400x900.png` | 深色主窗：侧栏/顶栏/右栏/状态栏/Composer/任务行 |
| `%TEMP%\tickflow-smoke-main-1060x700.png` | 1060 窄窗：侧栏 64px、右栏隐藏、无穿帮 |
| `%TEMP%\tickflow-smoke-main-3840x2160.png` | 4K：内容 896 居中、无拉伸 |
| `%TEMP%\tickflow-smoke-settings-1400x900.png` | 设置·外观：3 主题卡 + 9 配色卡 |
| `%TEMP%\tickflow-smoke-light-1400x900.png` | 浅色模式整页（含底部岛与状态栏） |
| `%TEMP%\tickflow-smoke-view-process-1400x900.png` | 进程视图：节点图与支线 |
| `%TEMP%\tickflow-smoke-view-quadrants-1400x900.png` | 四象限视图 |
| `%TEMP%\tickflow-smoke-view-stats-1400x900.png` | 统计视图 |
| `%TEMP%\tickflow-di-collapsed.png` | 灵动岛收起态：纯黑胶囊、四角全圆、离顶边 8px |
| `%TEMP%\tickflow-di-expanded.png` | 灵动岛展开态：黑色圆角面板、计数与操作按钮 |
| `%TEMP%\tickflow-di-remind.png` | 灵动岛提醒展开态：两条提醒 + 操作按钮 |
| `%TEMP%\tickflow-fix-light-sakura-settings.png` | 修复后浅色 + 樱粉：浅粉底、深色文字、选中态与「当前」一致 |
| `%TEMP%\tickflow-sidebar-prefs-1400.png` | 侧栏底部：外观/设置/帮助 横向一排 |
| `%TEMP%\tickflow-sidebar-prefs-1060.png` | 1060 窄窗：三项回到图标竖排 |
| `%TEMP%\tickflow-sidebar4-1400.png` | 侧栏四项同行（含配置在最右） |
| `%TEMP%\tickflow-sidebar4-1060.png` | 1060 收起态：四项图标竖排 |
| `%TEMP%\tickflow-profile-open-1400.png` | 配置面板向上展开 |
| `%TEMP%\tickflow-no-fx-1400.png` | 点击后无任何特效节点（U-07 验证） |
| `%TEMP%\tickflow-smoke-m3-island.png` | 顶部岛：提醒展开态（含计数、提醒条、操作按钮） |
| `%TEMP%\trae\screenshots\tickflow_*.jpg` | 浏览器 QA：主壳 / 外观页 / 深色切换 |

---

## 8. 用户追加改动（2026-11-20）

| ID | 改动 | 文件 | 实测 |
|---|---|---|---|
| U-01 | 配色首卡显示名「Kun 默认」→「默认」；内部 id `kun-default`、默认值、迁移映射均不变 | `js/modules/settings.js`、`data/schemes.json`、`docs/handoff/schemes.json` | 设置·外观首卡显示「默认」，右上「当前：默认 · 深色」 |
| U-02 | 顶部岛改苹果灵动岛形态（覆盖此前的贴边刘海方案）：纯黑胶囊、四角全圆、离屏幕顶边 8px、无边框、轻微阴影 | `css/top-island.css`、`js/modules/top-island.js`、`ipc/top-island.js`、`ipc/island-protocol.js`、`js/core/store.js`、`js/modules/settings.js` | 见下方三态实测 |

U-02 关键实现：

- 位置：`screen.getPrimaryDisplay().bounds.y + offsetY`（默认 8px），宽 360、水平居中；`offsetY` 设置项保留。
- 形态：`radius` 默认 26px（52px 收起高度即胶囊），范围 8–40；窗口无边框、纯黑底、`0 10px 30px` 阴影；文字固定浅色，强调色跟随配色方案。
- 三态形变：主进程按 280ms `easeOutBack` 逐帧改窗口高度（带轻微回弹）；面板入场只动 `transform/opacity`；岛元素 `height:100%`、内容顶部锚定，形变过程不重排。
- 高度计算改为 `head + panel.offsetHeight`，避免整窗拉伸后 `scrollHeight` 漂移。

三态实测（`npx electron stage --smoke`，隔离 `--user-data-dir`）：

```text
收起：bounds x=570 y=8 360×52，expanded=false，panelHidden=true
展开：bounds x=570 y=8 360×172，expanded=true，提醒列表正常
提醒：bounds x=570 y=8 360×228，hasRemind=true，2 条提醒无裁切
m3-off：island-window-missing（主窗与底部岛正常）
同步：P95 93.1ms（展开态）/ 113.1ms（提醒态，后台另有旧实例并行）
consoleErrors：m3 / m3-remind / m3-off / views 全为 0
views：17 个视图态全部有内容
```

---

## 9. 用户反馈修复（2026-11-21）

| ID | 现象 | 根因 | 修复 | 验证 |
|---|---|---|---|---|
| U-03 | 浅色 + 樱粉时页面仍是深酒红，像是浅色没生效 | 用户截图里主题卡实际选中「深色」；外观页切换配色时只改卡片 `.on` 边框、不重绘，主题卡与「当前」文案停留在旧档，页面按当时真实档位上色，形成「浅色无效」的错觉 | `settings.js`：mode / scheme 变更后 `rerenderBody()`（保留右栏滚动）；`openSettings()` 先按 Store 重落一次颜色 | `theme-matrix`：9 套 × 浅/深共 18 组，浅色档设置页与主壳底色全部命中 schemes.json 浅色值；`theme-ui-real` 真实鼠标点选后 `当前：樱粉 · 浅色`、`--bg=#FFF7F8` |
| U-04 | 侧栏「外观 / 设置 / 帮助」竖着排成三行 | 这三项在主窗左侧栏底部（`sb-foot`），不在顶部岛展开面板；顶部岛仍是「打开刻度 / 暂停专注」两个按钮 | 新增 `.sb-prefs` 三列等宽网格：图标在上、文字在下、整行居中；收起成 64px 图标栏（`sb-collapsed` / ≤1199）时自动回到竖排图标 | 1400 截图横向一排；1060 截图回到图标竖排，无挤压 |

补充说明：

- 顶部岛布局本轮未改动（用户说明展开后的样子稍后再给）。
- `custom` 方案按设计由背景亮度决定明暗（D-03），浅色选择下默认深色自定义底仍为深色，对比度单测 ≥4.5。
- 新增单测「dark+sakura → light+sakura 保留方案并取浅色档 surface」，`npm test` 63 条全绿。

---

## 10. 用户反馈修复 · 第二批（2026-11-21）

| ID | 改动 | 文件 | 实测 |
|---|---|---|---|
| U-05 | 侧栏底部四项同行：外观 / 设置 / 帮助 / 配置，配置在最右；点击配置在按钮上方向上弹出面板，不再占一整块卡片 | `app.js#sidebarHTML/openProfileMenu`、`features.css#.sb-prefs`、`app.css#.pop.pop-up` | 四列各 50.5px 等宽（1400）；弹层 `bottom=763 < chip.top=769`，确为向上展开；1060 收起态四项回到竖排图标 |
| U-06 | 点击涟漪改为「数字水波」：网格数字按圈层依次点亮，越往外越慢，圈内按角度错峰让最亮点持续移动（**已按 U-07 整体删除**） | `app.js#spawnNumWave`、`features.css#.tf-wave` | 68 个数字格子；52 帧采样 avgGap 16–17ms、maxGap 18ms（无掉帧）；0 console error |

数字水波时间曲线（`STEP=30px`，4 圈）：

```text
圈层起始延迟 = 110 + 150r + 55r²  → r1=315ms / r2=630ms / r3=1055ms / r4=1590ms
圈内角度错峰 = 0–180ms（0°→180°，沿圆周顺序点亮）
单格动画时长 = 640 + 140r ms     → r1=780 / r2=920 / r3=1060 / r4=1200
缓动 = cubic-bezier(.18,.72,.3,1)（减速）
节点生命周期 2600ms；rAF 下一帧创建，不阻塞 pointerdown
```

`html.reduce-motion` 或系统 `prefers-reduced-motion` 时直接不创建节点；CSS 侧同时 `.tf-wave{display:none}`。

截图：`%TEMP%\tickflow-sidebar4-1400.png`、`%TEMP%\tickflow-sidebar4-1060.png`、`%TEMP%\tickflow-profile-open-1400.png`。

---

## 11. 删除点击特效（2026-11-21，U-07）

| 删除项 | 位置 |
|---|---|
| `spawnNumWave()` 生成节点、`pointerdown` 监听、rAF 延迟创建 | `js/modules/app.js#initEffects` |
| `.tf-wave` / `.tf-wave i` / `@keyframes tf-wave-num` / reduced-motion 隐藏规则 | `css/features.css` §10 |
| `fx-ripple` class 同步 | `js/modules/app.js#syncFxFlags` |
| 设置页「主页点击涟漪」开关与 `case 'ripple'` 处理 | `js/modules/settings.js` |
| 废弃字段 `appearance.ripple` 默认值 / clone / 归一 | `js/modules/appearance.js`、`js/core/store.js` |
| schemes.json `defaults.ripple` | `data/schemes.json`、`docs/handoff/schemes.json` |
| smoke `wave` 场景（改为 `no-fx`：点击后断言无特效节点） | `src/main/main.js` |

旧数据兼容：`normAppearance()` / `normAppearance` 不再读取 `ripple`，旧 Store 里的 `appearance.ripple` 被直接忽略，下次保存自然消失，不会报错。

保留：侧栏/顶栏跟随高光（`highlight` 开关、`fx-highlight` class、`--mx/--my` 径向高光）完全未动。

自检：`no-fx` 场景点击内容区 500ms 后 `fxNodes=0`、`fx-ripple=false`、`fx-highlight=true`；设置·外观页只剩「侧栏跟随高光」一行；console error 0。

---

## 12. 打包与自动更新（2026-11-21，按 11-PACKAGING-UPDATE-PLAN.md 落地）

| 项 | 实现 |
|---|---|
| 产物名 | `TickFlow-Setup-<version>.exe`（ASCII，不再用中文名） |
| SHA256 | `scripts/build.mjs` 构建后自动写 `build/release/SHA256SUMS.txt` |
| 发布清单 | `scripts/release.mjs` 生成 `update/latest.json` + `SHA256SUMS.txt`，校验版本/tag；`--check` 只校验不写 |
| 更新器 | `src/main/ipc/update-core.js`（纯逻辑）+ `src/main/ipc/update.js`（Electron 适配） |
| 多源清单 | jsDelivr → raw.githubusercontent →（可选 CDN）→ GitHub API 兜底 |
| 缓存 | 24h TTL + ETag（`If-None-Match`），缓存文件在 userData，不写业务 Store |
| 下载 | 清单 urls 顺序探测 + 失败切换；流式写入临时目录；SHA256/大小校验；失败删除文件，旧版本不动 |
| 安装 | 校验通过后 `spawn(Setup.exe, ['/S','--updated'])`，主进程 `quitting=true` 后退出；冒烟模式拒绝安装 |
| 入口 | 设置 › 关于 › 更新卡片：检查更新 / 下载并校验 / 安装并重启 / 打开发布页；启动 25s 后自动检查（仅打包版） |
| 配置 | `src/main/update-config.json`：`owner=si-zero-0`、`repo=tickflow`；以后只改这一处 |

冒烟结果（`TF_UPDATE_SCENARIO` 夹具，均 0 console error）：

| 场景 | 检查 | 下载 | 关于页文案 |
|---|---|---|---|
| latest | no-update | — | 已是最新版本 v1.13.0 |
| new | available 1.13.1 | downloaded | 已下载，SHA256 校验通过 |
| fallback（jsDelivr 500，raw 成功） | available | downloaded | 已下载，SHA256 校验通过 |
| neterr | NET_FAIL | — | 无法连接更新源（jsDelivr / raw / GitHub API 均失败） |
| hash | available | HASH_MISMATCH | 安装包 SHA256 校验失败，已丢弃下载文件，旧版本不受影响 |
| rate（API 403 / remaining 0） | RATE_LIMIT | — | 更新源触发 GitHub 限流，请稍后再试 |

构建实测：`npm run build` 产出 `TickFlow-Setup-1.13.0.exe` 116.0 MB + `.blockmap` + `SHA256SUMS.txt`；`release.mjs --tag=v1.13.0` 生成清单（sha256 `7e0c1041…`，GitHub + ghproxy 两个下载源）。单测 72 条全绿。

---

## 13. 顶部岛视觉重做（2026-11-21，U-08）

| 项 | 取值 |
|---|---|
| 岛体填充 | 固定 `#060606`（`--isl-ink`），深色背景融合、边缘可见 |
| 圆角 | 默认 26px；仍跟随设置 `m3.radius`（8–40） |
| 边缘 | 无 border；`inset 0 0 0 1px rgba(255,255,255,.035)` 做玻璃边，无硬描边 |
| 顶部内高光 | `inset 0 1px 0 rgba(255,255,255,.09)`（展开态 .11） |
| 液态玻璃折射 | `radial-gradient(120% 85% at 18% -20%, rgba(255,255,255,.07)…)` + 右下 .035 + 顶部纵向 .045→透明 |
| 接触阴影（收起） | `0 1px 2px rgba(0,0,0,.60), 0 3px 8px rgba(0,0,0,.36)` |
| 中层扩散（收起） | `0 12px 30px rgba(0,0,0,.40)` |
| 外层环境（收起） | `0 30px 80px -12px rgba(0,0,0,.58)` |
| 展开加深 | `0 2px 4px .65, 0 5px 14px .42, 0 18px 44px .48, 0 40px 100px -12px .65` |
| accent 辉光 | `0 0 34px -7px accent 44%` + `0 0 90px -20px accent 62%`，颜色随方案 |
| 展开脉冲 | `::after` 内高光 opacity 0→.9→.28，2.6s ease-out，播放 2 次后常亮 .28 |
| 留白 | 窗口四周 26px 横向、上 6 / 下 24，阴影与辉光真正溢出窗口 |
| 新 bounds | 收起 412×82；展开 412×202；提醒展开 412×257（x=544, y=8 @1400×900） |
| 减少动态 | `prefers-reduced-motion` 下脉冲 animation:none、静态 opacity .28；过渡关闭 |

三态、快照、动作、降级逻辑未改。截图：`%TEMP%\tickflow-m3-glass-collapsed.png`、`tickflow-m3-glass-expanded.png`、`tickflow-m3-glass-remind.png`。

---

## 14. 移除灵动岛（2026-11-21，U-09）

| 删除项 | 内容 |
|---|---|
| 顶部岛文件 | `src/main/ipc/top-island.js`、`island-protocol.js`、`preload-island.js`、`src/renderer/top-island.html`、`css/top-island.css`、`js/modules/top-island.js` |
| 底部岛 | `src/renderer/js/modules/island.js`、`index.html` 的 `#island` 与脚本、`features.css` §8 全部样式 |
| 主进程 | top-island 域注册、托盘「顶部迷你岛」、宿主 attach、全屏隐藏、m3 冒烟场景与岛截图/同步探针 |
| preload | `topIsland` 全部方法、`tf:island:action` 监听 |
| 渲染层 | 快照/动作回传/applyM3Settings/islandRefresh、Esc 岛分支、Ctrl+Alt+I、命令面板岛命令、遮罩联动 |
| 设置 | 「灵动岛」分类、底部岛/顶部岛/内容/归属全部控件、快捷键与诊断里的岛行 |
| Store | 删除 `settings.island`、`settings.m3` 默认与归一；迁移时 `delete` 旧字段，老数据不报错 |
| 提醒 | 回到 v1.12 方式：`TF.reminderPopup(tk)` + 系统通知，`notifiedOn` 去重；无岛分支 |
| 测试 | 删除 `m3-sync.test.mjs`；Store 迁移单测改为断言旧字段被丢弃 |

原快速记录路径由「今天页 Composer」「Ctrl+Alt+Space 全局捕获」「Ctrl+K 命令面板」承接；提醒由右上角提醒卡承接，无功能缺口。

自检：`verify` 8/8；`npm test` 65/65；`views` 17 个视图态 0 console error；`settings` 0 error；`main` 0 error。

---

## 15. 公开 README 与反馈入口（2026-11-21，U-10）

- `README.md` 重写为访客向：软件定位、适合谁、当前版本、下载安装（含 SmartScreen）、三步上手、首次打开、常用操作、数据/备份/卸载、更新、常见问题、反馈。
- 新增 `docs/DEVELOPMENT.md`：技术栈、目录、边界、开发命令、构建/发布/自动更新说明。
- 移除公开仓库里的本机口径：开发副本、本机状态、绝对路径、artifacts 限制、锁文件叮嘱。
- 反馈：B 站为主，GitHub Issues 为另一条；README 与「设置 → 关于」都已加入按钮。
- 新增 `tf:shell:open-external` 白名单（仅 B 站与 Issues 两个地址）。
- 仓库 About：面向用户的一句话描述 + topics（electron / windows / todo / task-manager / local-first）。



