# TickFlow v1.13.0 · Trae 交付包 · START HERE

> 交付日期：2026-11-20
> 当前代码基线：**v1.12.0**（可运行、45 条单测全绿）
> 目标版本：**v1.13.0**（Kun 风格 UI 重构 + M3 双岛 + 回归）
> 本文件夹是**自包含项目**：源码、测试、脚本、现有文档、四张参考图、全部新需求都在里面。

---

## 1. 你首先要做什么

你是 Trae，请在这个文件夹里完成 TickFlow v1.13.0。按顺序读：

1. `TRAE-PROMPT.md` —— 一次性任务提示词（可直接复制到对话框）
2. `docs/handoff/01-PRD-v1.13.md` —— 完整产品需求（P0/P1/P2、验收）
3. `docs/handoff/02-UI-KUN-SPEC.md` —— Kun 风格 UI 规范（布局、颜色、组件、设置、外观页）
4. `docs/handoff/03-M3-DUAL-ISLAND.md` —— 双岛功能规范（顶部迷你岛 + 底部主岛 + 同步）
5. `docs/handoff/04-DESIGN-TOKENS.md` —— Token 与配色方案（含 `schemes.json`）
6. `docs/handoff/05-ARCHITECTURE.md` —— 目标架构、文件改动、数据流
7. `docs/handoff/06-TASK-BREAKDOWN.md` —— 有序任务清单（按这个做）
8. `docs/handoff/07-TEST-PLAN.md` —— 测试与验收矩阵
9. `docs/handoff/08-RISKS.md` —— 风险与回滚
10. `docs/handoff/09-CURRENT-BASELINE.md` —— v1.12 现状、已有能力、已知问题
11. `docs/handoff/10-PROCESS.md` —— 阶段门、角色、变更控制、评审清单

参考材料：

- `reference/images/01-settings-sidebar.png` —— 设置侧栏参考
- `reference/images/02-main-shell.png` —— 主界面参考
- `reference/images/03-appearance-controls.png` —— 外观：字号/宽度/交互特效
- `reference/images/04-appearance-schemes.png` —— 外观：主题/配色方案
- `reference/m3-dual-island-map.html` —— M3 双岛 196 节点可编辑功能树
- `docs/iteration-112/` —— v1.12 的 PRD、设计、实施说明、QA、白盒复核

---

## 2. 这次要交付什么

### Phase 1（P0）：Kun 风格 UI 重构

- 主壳：左侧分组侧栏 + 顶部栏 + 右侧图标栏 + 底部状态栏
- 设置：左侧分类侧栏 + 右侧卡片内容（常规/外观/通知/快捷键/灵动岛/愿望/数据/关于）
- 外观：浅色/深色/跟随系统 + 9 套配色方案（8 预设 + 自定义）
- 字号（默认 82%）、内容宽度（默认 896px）、强调色、侧栏跟随高光、主页点击涟漪
- 组件：按钮/输入/卡片/任务行/愿望卡/抽屉/弹窗/命令面板/Toast/灵动岛全部换成新视觉语言
- 保留现有功能：任务、愿望、专注、统计、习惯、四象限、时间轴、日历、命令面板、快速捕获、导入导出、快照

### Phase 2（P1）：M3 双岛

- 底部主岛：保留 v1.12 的三态、队列、6 操作
- 顶部迷你岛：独立透明置顶窗口，收起/展开/提醒/专注/极简/隐藏
- 双岛同步：主窗口持有唯一 Store，顶部岛是投影；IPC 快照 + 动作；提醒归属与去重
- 设置：顶部岛开关、位置、尺寸、透明度、圆角、内容开关、提醒归属
- 降级：顶部岛失败不影响底部主岛；默认关闭顶部岛

### Phase 3（P1）：QA 与发布

- 单测、浏览器 QA、Electron 双窗 QA、12 视图回归、视觉截图
- `verify` 8/8、`npm test` 45+、三套配色对比度、0 console error
- 版本号 1.13.0，更新文档

---

## 3. 硬约束（先读，避免白干）

1. **不要重写项目**。在现有 `src/renderer` + `src/main` 上增量修改。
2. **不要复制 Kun 的 AI 业务**。参考图只借视觉/布局/设置 IA；模型供应商、MCP、子代理、终端、手机、代码工作区都不做。
3. **保持本地优先**。不引入账号、后端、云同步；localStorage 仍是唯一业务数据源。
4. **渲染层不许 `require`**；系统能力走 `preload.js` 的 `tfBridge`，新增能力必须白名单。
5. **主进程不碰业务数据**；M3 的主窗口是 Store 的唯一持有者，顶部岛只接收快照、回传动作。
6. **颜色只走 token**。禁止在组件里写裸 hex；所有颜色进 `theme.css` / `schemes.json`。
7. **不要新增运行时依赖**。M3 只用 Electron 原生 API（BrowserWindow / screen / IPC / Tray / globalShortcut）。
8. **不改** `reference/`、`docs/iteration-112/` 里的历史文档；新文档写 `docs/handoff/`。
9. **每阶段结束必须跑**：`npm run verify`、`npm test`、`npm run stage`；Phase 2 再加 `cd src/main && npm i && npm start` 人工冒烟。
10. **不删用户数据**。迁移失败要回滚快照；旧配置字段保留兼容。

---

## 4. 快速开始

```powershell
cd <本项目根目录>
npm run verify
npm test
npm run stage
cd src/main
npm i
# 开发启动：stage 里才有 www，直接 electron stage
npx electron stage
```

> 如果 `src/main/package.json` 的 `npm start` 报找不到 `www`，用上面的 `npx electron stage`；`stage` 由 `npm run stage` 生成。

---

## 5. 完成定义（Definition of Done）

- [ ] `npm run verify` 8/8，0 警告
- [ ] `npm test` 全绿（至少 45 条；新增主题/同步/迁移用例）
- [ ] `npm run stage` 产物完整，`TF.VERSION` = 1.13.0
- [ ] 9 套配色 × 浅/深/系统，正文/元信息对比度 ≥4.5
- [ ] 字号 70–120%、内容宽度 640–1200 实时生效并持久化
- [ ] 设置页 8 个分类可用，搜索可跳转，卡片不重建、不丢滚动
- [ ] 12 个视图无白屏、0 console error
- [ ] M3 双岛：顶部岛可开关、三态、同步延迟 P95 <100ms、提醒不重复
- [ ] 顶部岛失败/关闭时，底部主岛行为与 v1.12 完全一致
- [ ] 1060×700 / 1400×900 / 4K 无穿帮
- [ ] `docs/handoff/IMPLEMENTATION-NOTES.md` 记录所有偏差与假设

---

## 6. 交付时怎么汇报

按 `docs/handoff/06-TASK-BREAKDOWN.md` 的任务 ID 汇报：

```
Phase 1
- T1.1 ✅ 文件：... 验证：...
- T1.2 ✅ ...
Phase 2
- T2.1 ✅ ...
测试：verify 8/8 · test 58/58 · stage 30 files
已知问题：...
截图：...
```

不要只说“完成了”；每个任务给出文件路径、验证命令、关键截图/断言。

---

## 7. 怎么发给 Trae

- **方式 A（推荐）**：用 Trae 直接打开本文件夹作为项目根目录，然后粘贴 `TRAE-PROMPT.md` 的内容。
- **方式 B**：把同目录的 `TickFlow-Trae-Handoff-20261120.zip` 上传/解压后用 Trae 打开。
- 不要只发 `TRAE-PROMPT.md` 一个文件；源码、文档、参考图都在这个文件夹里。
- 如果 Trae 只能读单个文件，让它先读 `START-HERE.md`，它会按里面的路径继续读。

