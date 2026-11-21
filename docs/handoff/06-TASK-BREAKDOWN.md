# 任务拆解 · TickFlow v1.13.0

> 按 ID 顺序做；每个任务完成后跑 `npm run verify && npm test`。
> Phase 1 全绿后再开 Phase 2；Phase 2 全绿后再做 Phase 3。
> 每个任务在 `docs/handoff/IMPLEMENTATION-NOTES.md` 记一行：ID / 文件 / 验证 / 偏差。

---

## Phase 0 · 基线（先做，不改代码）

### T0.1 记录基线
- 跑 `npm run verify`、`npm test`、`npm run stage`、`cd src/main && npm i && npm start`。
- 记录：版本、8/8、45/45、26 文件、启动耗时、截图。
- 验收：基线数据写进 `IMPLEMENTATION-NOTES.md`。
- 依赖：无。

### T0.2 读代码地图
- 读 `index.html`、`app.js` 的 render/sidebar/topbar/settings、`theme.js`、`store.js`、`island.js`、`preload.js`、`main.js`。
- 产出：在 `IMPLEMENTATION-NOTES.md` 写一页“现有入口/函数/class 清单”，避免改错。
- 验收：能指出 `TF.applyTheme`、`App.render`、`settingsModal`、`sidebarHTML`、`topbarHTML`、`islandRender` 的位置。

---

## Phase 1 · Kun 风格 UI（P0）

### T1.1 Token 与外观运行时
- 文件：`css/theme.css`、`js/modules/appearance.js`、`data/schemes.json`
- 内容：9 方案 token 注入；`data-mode/scheme/font/width`；首屏兜底；`applyAppearance/previewAppearance/getAppearance`。
- 依赖：T0.2
- 验收：切 9 方案 × 浅/深，`--bg/--panel/--text/--accent` 计算值正确；无闪白；不重建 DOM。
- 证据：6 张截图 + `getComputedStyle` 断言。

### T1.2 Store 迁移与设置模型
- 文件：`js/core/store.js`、`js/modules/appearance.js`
- 内容：`appearance`/`m3` 默认值、范围钳制、1.12→1.13 迁移、旧 theme/accent 映射、迁移前快照。
- 依赖：T1.1
- 验收：构造 v1.12 数据导入，迁移后任务/愿望/主题不丢；旧 theme `graphite`→`kun-default`、`mist`→`sky`；`accent` 保留 override。
- 证据：单测 + 手动导入。

### T1.3 主壳布局
- 文件：`index.html`、`css/app.css`、`js/modules/app.js`
- 内容：`#app-shell`、`#sidebar`、`#topbar`、`#content`、`#right-rail`、`#statusbar`；48/232/44/28 尺寸；内容最大 896。
- 依赖：T1.1
- 验收：1400/1060 布局正确；无横向溢出；侧栏滚动独立；内容区滚动。
- 证据：2 张截图 + DOM 尺寸断言。

### T1.4 侧栏重绘
- 文件：`js/modules/app.js`、`css/app.css`、`css/features.css`
- 内容：品牌区、快速添加、分组（工作台/视图/工具/底部）、彩色图标块、选中 pill、计数徽章、配置浮层。
- 依赖：T1.3
- 验收：12 个导航项全部可达；选中唯一；计数同步；1060 下可收成 64px 图标栏。
- 证据：点击每个 nav 截图/断言 `App.view`。

### T1.5 顶栏 + 右栏 + 状态栏
- 文件：`js/modules/app.js`、`index.html`、`css/app.css`
- 内容：面包屑、搜索、视图操作、配置徽章；右栏 6 个图标；状态栏专注/计数/版本。
- 依赖：T1.3
- 验收：搜索 Ctrl+K 聚焦；右栏按钮有 tooltip；1060 下右栏隐藏；状态栏不换行。
- 证据：键盘/点击断言 + 截图。

### T1.6 设置壳与 8 分类
- 文件：`js/modules/settings.js`、`js/modules/app.js`、`index.html`、`css/app.css`
- 内容：全屏设置页；左 248 分类（常规/外观/通知/快捷键/灵动岛/愿望/数据/关于）；右卡片；搜索；滚动位置保持。
- 依赖：T1.3
- 验收：8 类切换正确；搜索跳转；不重建外层；Esc 返回；1060 下可用。
- 证据：8 类截图 + 滚动位置断言。

### T1.7 外观页：主题 + 配色方案
- 文件：`js/modules/settings.js`、`js/modules/appearance.js`、`css/features.css`
- 内容：3 主题卡（浅/深/系统）+ 9 配色卡（含自定义入口）；浅/深双预览；蓝边+勾；当前方案文案。
- 依赖：T1.1/T1.6
- 验收：点卡即时生效；选中态正确；刷新后保持；9 卡不溢出（4 列，1060 两列）。
- 证据：9 方案截图 + `data-scheme` 断言。

### T1.8 外观页：字号 / 宽度 / 强调色 / 特效
- 文件：`js/modules/settings.js`、`js/modules/appearance.js`、`css/features.css`
- 内容：字号 70–120（默认 82）、内容宽度 640–1200（默认 896）、滑杆+步进器、强调色 hex+色带、侧栏高光/涟漪开关。
- 依赖：T1.7
- 验收：实时生效；刷新保持；范围钳制；非法值回默认；reduced motion 下特效关闭。
- 证据：滑杆 70/82/100/120 截图 + `getComputedStyle`。

### T1.9 组件重绘
- 文件：`css/app.css`、`css/features.css`、`js/modules/{app,views,wish}.js`
- 内容：按钮/输入/卡片/任务行/愿望卡/抽屉/弹窗/命令面板/Toast/底部岛；统一 token、圆角、焦点环、hover。
- 依赖：T1.3
- 验收：12 视图无穿帮；主按钮/选中/开关/滑杆一致；无裸 hex。
- 证据：12 视图截图 + `grep` 裸 hex。

### T1.10 快速添加 Composer
- 文件：`js/modules/views.js`、`css/features.css`、`js/modules/app.js`
- 内容：大 composer 卡、预览行、chip、清单/优先级/日期、发送按钮；保留解析/连续添加/焦点不丢。
- 依赖：T1.9
- 验收：8 日期/3 时间/优先级/标签/清单；连续 5 条焦点不丢；侧栏计数同步。
- 证据：5 条连打断言 + 截图。

### T1.11 交互特效
- 文件：`js/modules/appearance.js`、`index.html`、`css/features.css`
- 内容：侧栏/顶栏鼠标跟随高光；主页点击涟漪；开关；reduced motion。
- 依赖：T1.3/T1.8
- 验收：高光跟随指针 120ms；涟漪 480ms、最多 3 个、不拦截点击；关闭后无效果。
- 证据：截图/录屏 + `prefers-reduced-motion` 断言。

### T1.12 响应式与可访问性
- 文件：`css/app.css`、`css/features.css`、`js/modules/app.js`
- 内容：1060/1400/4K；侧栏 64；右栏隐藏；设置左栏 220/横向 chips；焦点环；aria。
- 依赖：T1.3–T1.11
- 验收：1060 无穿帮；Tab 走遍；焦点可见；对比度达标。
- 证据：1060/1400/4K 截图 + 键盘走查。

---

## Phase 2 · M3 双岛（P1）

### T2.1 主进程 IPC + preload
- 文件：`src/main/ipc/top-island.js`、`src/main/preload.js`、`src/main/main.js`
- 内容：`top-island:create/destroy/push/action/hello/resize/state`；sender 校验、type 白名单、频率限制。
- 依赖：T1.12
- 验收：空窗口可创建/销毁；IPC 往返通；非法 action 被拒。
- 证据：日志/单测 + 窗口截图。

### T2.2 顶部岛窗口
- 文件：`src/renderer/top-island.html`、`css/top-island.css`、`js/modules/top-island.js`、`ipc/top-island.js`
- 内容：frameless/transparent/alwaysOnTop/skipTaskbar/focusable:false；顶部居中；收起 360×40；showInactive。
- 依赖：T2.1
- 验收：位置正确；不抢焦点；不进任务栏；点击按钮有响应。
- 证据：Electron 截图 + `BrowserWindow` 属性断言。

### T2.3 三态 UI
- 文件：`top-island.js`、`top-island.css`
- 内容：collapsed/expanded/remind；当前任务、今日 3 条、6 操作、提醒三动作；空态/全完成。
- 依赖：T2.2
- 验收：三态切换无闪烁；内容正确；按钮动作回调到主窗。
- 证据：三态截图 + 点击断言。

### T2.4 快照推送
- 文件：`app.js`、`top-island.js`、`ipc/top-island.js`
- 内容：`pushIslandSnapshot()` 50ms 合并；倒计时 1s；启动 hello；seq 丢弃旧包。
- 依赖：T2.3
- 验收：主窗任务变更/主题切换，顶部岛 100ms 内一致；无重复监听。
- 证据：延迟采样 + 日志。

### T2.5 动作回传与幂等
- 文件：`app.js`、`ipc/top-island.js`、`top-island.js`
- 内容：complete/snooze/tomorrow/focus/open/new/ack；actionId 去重；按钮 300ms 禁用；ack 恢复。
- 依赖：T2.4
- 验收：完成/推迟/明天/专注/打开/新建全部生效；重复点击不重复执行。
- 证据：动作矩阵 + Store 断言。

### T2.6 提醒归属与去重
- 文件：`app.js`、`island.js`、`top-island.js`
- 内容：top/bottom/follow-focus；同一 taskId 只入一端；`notifiedOn` 只由主窗轮询写；8s 收起不清队列。
- 依赖：T2.5
- 验收：5 条同分钟提醒不丢不重；知道了逐条；关闭顶部岛后底部正常。
- 证据：5 条队列测试 + 截图。

### T2.7 M3 设置页
- 文件：`settings.js`、`appearance.js`、`store.js`、`ipc/top-island.js`
- 内容：开关/位置/宽度/透明度/圆角/内容/归属；修改即时生效；默认关闭。
- 依赖：T2.6
- 验收：开关创建/销毁；宽度/位置 `setBounds`；透明度/圆角 CSS 变量；刷新保持。
- 证据：设置页截图 + 窗口属性断言。

### T2.8 主窗协作与托盘
- 文件：`main.js`、`app.js`、`preload.js`
- 内容：最小化继续；关闭到托盘；托盘菜单；打开主窗定位任务；退出销毁。
- 依赖：T2.7
- 验收：最小化/关闭/托盘/退出行为正确；顶部岛不残留。
- 证据：Electron 手动/脚本断言 + 截图。

### T2.9 降级与边界
- 文件：`ipc/top-island.js`、`top-island.js`、`main.js`
- 内容：崩溃重建 1 次；失败禁用 + toast；显示器拔插夹取；睡眠唤醒；DPI；自身全屏。
- 依赖：T2.8
- 验收：关闭/崩溃/拔插/唤醒不拖垮主窗；底部岛不变。
- 证据：故障注入 + 日志。

---

## Phase 3 · QA 与发布

### T3.1 单测
- 文件：`tests/appearance.test.mjs`、`tests/m3-sync.test.mjs`、`tests/theme.test.mjs`
- 内容：9×2 对比度、迁移、范围钳制、快照 reducer、action 幂等、提醒归属。
- 依赖：T2.9
- 验收：新增 ≥12 条；全绿。

### T3.2 浏览器 QA
- 内容：9 方案 × 浅/深；字号 70/82/100/120；宽度 640/896/1200；12 视图；1060/1400/4K；reduced motion。
- 验收：0 console error；无穿帮；截图矩阵。

### T3.3 Electron QA
- 内容：双窗口、IPC、托盘、快捷键、最小化/关闭、顶部岛三态、提醒队列。
- 验收：行为正确；无残留窗口；内存增量 <80MB。

### T3.4 回归
- 内容：任务 CRUD、愿望、专注、统计、习惯、四象限、时间轴、日历、命令面板、快速捕获、导入导出、快照。
- 验收：与 v1.12 行为一致；关闭顶部岛全绿。

### T3.5 发布
- 内容：版本 1.13.0；`verify`/`test`/`stage`；`build.mjs` 出包；更新 README/CHANGELOG。
- 验收：安装包可启动；版本一致。

### T3.6 文档
- 内容：更新 `IMPLEMENTATION-NOTES.md`、`README.md`、`ARCHITECTURE.md`；记录偏差/已知问题。
- 验收：下一个接手者能按文档继续。
