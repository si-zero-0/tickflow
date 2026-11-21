# 给 Trae 的一次性任务提示词

> 用法：用 Trae 打开本文件夹作为项目根目录，把下面整段粘贴到对话框。不要只发一句“按文档做”，把约束一起发过去。

---

你正在接手 **TickFlow v1.13.0** 的实现。项目根目录就是当前打开的文件夹。

## 先读

按顺序读完再动代码：

1. `START-HERE.md`
2. `docs/handoff/01-PRD-v1.13.md`
3. `docs/handoff/02-UI-KUN-SPEC.md`
4. `docs/handoff/03-M3-DUAL-ISLAND.md`
5. `docs/handoff/04-DESIGN-TOKENS.md` + `docs/handoff/schemes.json`
6. `docs/handoff/05-ARCHITECTURE.md`
7. `docs/handoff/06-TASK-BREAKDOWN.md`
8. `docs/handoff/07-TEST-PLAN.md`
9. `docs/handoff/09-CURRENT-BASELINE.md`
10. `docs/handoff/10-PROCESS.md`

## 任务

把 TickFlow 从 v1.12.0 升级到 v1.13.0，分三阶段：

### Phase 1：Kun 风格 UI 重构（P0）

- 主壳：左侧分组侧栏（品牌/工作台/视图/工具/底部配置）+ 顶部栏 + 右侧图标栏 + 底部状态栏
- 设置：左侧 8 个分类 + 右侧卡片；分类：常规、外观、通知、快捷键、灵动岛、愿望、数据、关于
- 外观：浅色/深色/跟随系统；9 套配色（Kun 默认、晴空蓝白、羊皮纸、薄荷、樱粉、暮紫、琥珀、墨石、自定义）
- 字号 70–120%（默认 82%）、内容宽度 640–1200px（默认 896）、强调色、侧栏跟随高光、主页点击涟漪
- 组件全部换成 Kun 视觉语言：按钮、输入、卡片、任务行、愿望卡、抽屉、弹窗、命令面板、Toast、底部岛
- 保留所有现有功能与 12 个视图；不改数据语义

### Phase 2：M3 双岛（P1）

- 底部主岛保留 v1.12 三态/队列/6 操作
- 新增顶部迷你岛：独立透明置顶 BrowserWindow，收起/展开/提醒/专注/极简/隐藏
- 主窗口持有唯一 Store；顶部岛是投影；IPC 快照 + 动作回传；提醒归属与去重
- 设置新增顶部岛开关、位置、尺寸、透明度、圆角、内容开关、提醒归属
- 默认关闭顶部岛；顶部岛失败时底部主岛行为不变

### Phase 3：QA 与发布

- 按 `07-TEST-PLAN.md` 跑单测、浏览器 QA、Electron 双窗 QA、12 视图回归
- 版本号 1.13.0；`verify` 8/8、`npm test` 全绿、`npm run stage` 产物完整
- 更新 `docs/handoff/IMPLEMENTATION-NOTES.md`

## 硬约束

- 在现有代码上增量修改，不重写、不换框架。
- 不复制 Kun 的 AI 功能（模型供应商/MCP/子代理/终端/手机/代码工作区）。只借视觉与设置 IA。
- 不引入账号、后端、云同步；localStorage 仍是唯一业务数据源。
- 渲染层不 `require`；系统能力走 `preload.js` 的 `tfBridge` 白名单。
- 主进程不碰业务数据；M3 的主窗口是 Store 唯一持有者，顶部岛只收快照。
- 组件里禁止裸 hex；颜色只进 `theme.css` / `schemes.json`。
- 不新增运行时依赖；M3 只用 Electron 原生 API。
- 不改 `reference/`、`docs/iteration-112/`；新文档写 `docs/handoff/`。
- 每阶段结束跑 `npm run verify && npm test && npm run stage`；Phase 2 加 `cd src/main && npx electron stage` 人工冒烟。
- 不删用户数据；迁移失败回滚快照；旧配置字段保留兼容。
- 遇到歧义先按 PRD 的 Assumptions 做，把偏差写进 `IMPLEMENTATION-NOTES.md`，不要停下来问。

## 工作方式

1. 先跑基线三条命令，把输出记下来。
2. 按 `06-TASK-BREAKDOWN.md` 的 ID 顺序做；不要跳阶段。
3. 每完成一个任务：改代码 → 跑 verify/test → 截关键图 → 在 `IMPLEMENTATION-NOTES.md` 记一行。
4. Phase 1 全绿后再开 Phase 2；Phase 2 全绿后再做 Phase 3。
5. 每阶段结束给我一份汇报：任务 ID、文件、验证命令、截图、已知问题。

## 完成标准

- `verify` 8/8、`npm test` 全绿、`stage` 完整、`TF.VERSION = 1.13.0`
- 9 套配色 × 浅/深/系统，正文/元信息 ≥4.5
- 字号/宽度实时生效并持久化
- 12 视图 0 console error
- M3 顶部岛可开关、三态、同步 P95 <100ms、提醒不重复
- 1060/1400/4K 无穿帮
- `IMPLEMENTATION-NOTES.md` 记录全部偏差

现在开始：先读文档，再跑基线，然后从 Phase 1 的 T1.1 开始。
