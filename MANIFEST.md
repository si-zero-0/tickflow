# 交付包清单 · TickFlow v1.13.0 Trae Handoff

> 生成日期：2026-11-20
> 包大小：约 2 MB（不含 `node_modules`）
> 包内是**完整可运行项目**，不是只读文档包。

## 根目录

| 路径 | 作用 |
|---|---|
| `START-HERE.md` | **先读这个**：交付内容、阅读顺序、硬约束、完成定义 |
| `TRAE-PROMPT.md` | 可直接粘贴给 Trae 的一次性任务提示词 |
| `AGENTS.md` | 给 AI 代理的项目规则（架构边界、代码约定、禁止事项） |
| `.trae/rules/project.md` | Trae 项目规则快捷入口（与 AGENTS.md 一致） |
| `MANIFEST.md` | 本文件 |
| `package.json` | 工作区脚本（verify/test/stage/start） |
| `README.md` | TickFlow 原始 README |
| `ARCHITECTURE.md` | v1.11 五层架构说明（历史基线） |

## 源码与工程

| 路径 | 作用 |
|---|---|
| `src/renderer/` | 渲染层：HTML/CSS/JS、主题、视图、灵动岛、愿望、统计 |
| `src/main/` | 主进程：窗口、托盘、快捷键、协议、IPC、preload |
| `scripts/build.mjs` | 构建/打包/`--stage-only` |
| `scripts/verify.mjs` | 静态自检 |
| `tests/` | Node 单测（core/theme/registry） |
| `plugins/` | 插件示例 |
| `.gitignore` | 忽略规则 |

> 不包含：`node_modules`、`build/`、`artifacts/`、`src/main/stage/`、`jilespace-daozai-main/`（参考项目，体积大且与本任务无关）。
> 首次运行前在 `src/main` 下执行 `npm i`。

## 新需求文档（`docs/handoff/`）

| 文件 | 内容 |
|---|---|
| `01-PRD-v1.13.md` | 完整 PRD：目标、范围、P0/P1/P2、用户故事、验收 |
| `02-UI-KUN-SPEC.md` | Kun 风格 UI 规范：主壳、侧栏、顶栏、右栏、设置、外观、组件、交互 |
| `03-M3-DUAL-ISLAND.md` | M3 双岛：窗口、状态、同步协议、提醒归属、数据迁移、验收 |
| `04-DESIGN-TOKENS.md` | Token 体系、9 套配色、字号/宽度/圆角/动效 |
| `schemes.json` | 机器可读配色方案（9 套 × 浅/深） |
| `05-ARCHITECTURE.md` | 目标架构、文件清单、数据流、IPC、主题层改造 |
| `06-TASK-BREAKDOWN.md` | 有序任务（T1.x/T2.x/T3.x），含文件、依赖、验收 |
| `07-TEST-PLAN.md` | 单测、浏览器 QA、Electron QA、视觉矩阵、DoD |
| `08-RISKS.md` | 风险、取舍、回滚 |
| `09-CURRENT-BASELINE.md` | v1.12 现状、已有能力、已知问题、命令 |
| `10-PROCESS.md` | 阶段门、角色、变更控制、评审清单 |
| `IMPLEMENTATION-NOTES.md` | **由实现者填写**：偏差、假设、证据 |
| `README.md` | handoff 文档索引 |

## 参考材料

| 路径 | 内容 |
|---|---|
| `reference/images/00-current-v1.12.png` | v1.12 当前界面基线（改造前） |
| `reference/images/01-settings-sidebar.png` | 设置侧栏：分组、彩色图标、选中态 |
| `reference/images/02-main-shell.png` | 主界面：侧栏、英雄区、Composer、右栏、状态栏 |
| `reference/images/03-appearance-controls.png` | 外观：字号/宽度滑杆、强调色、交互特效 |
| `reference/images/04-appearance-schemes.png` | 外观：主题卡、9 套配色方案、选中态 |
| `reference/m3-dual-island-map.html` | M3 双岛 196 节点可编辑功能树（浏览器打开） |
| `reference/README.md` | 参考图说明与“只借风格、不复制业务”的边界 |

## 历史文档（`docs/iteration-112/`）

| 文件 | 内容 |
|---|---|
| `PRD-v1.12.md` | v1.12 产品需求（愿望、主题、任务流、灵动岛） |
| `DESIGN-v1.12.md` | v1.12 增量设计（含实施偏差裁定） |
| `IMPL-NOTES-v1.12.md` | v1.12 实施说明、偏差、已知限制 |
| `QA-REPORT-v1.12.md` | 两轮 QA：93 项 + 17 项 |
| `REVIEW-v1.12.md` | 白盒契约复核（9 条偏差） |
| `ISLAND-FEATURE-MENU.md` | 岛仔参考项目的 67 项功能菜单 |
| `m3-dual-island-map.html` | 同上（副本） |

## 版本与基线

- 当前：`package.json` / `src/main/package.json` = **1.13.0**
- 目标：**1.13.0**（已实现）
- 基线（v1.12）：`verify` 8/8、`npm test` 45/45、`stage` 26 文件、`TF.VERSION` 1.12.0
- 交付（v1.13）：`verify` 8/8、`npm test` 62/62、`stage` 35 文件、`TF.VERSION` 1.13.0
- 已知问题：v1.13 见 `docs/handoff/IMPLEMENTATION-NOTES.md` §5（K-01 首屏渲染耗时、K-02 沙箱 GPU 日志）；I-16/I-17 已在 v1.13 修复。
