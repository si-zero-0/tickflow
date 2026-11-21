# AGENTS.md · TickFlow v1.13.1

本文件是给 AI 编码代理（Trae 等）的项目规则。与 `START-HERE.md`、`TRAE-PROMPT.md` 一起读。

## 1. 项目是什么

TickFlow（刻度）是本地优先的 Windows 桌面任务/进程管理工具：Electron 主进程 + 原生 HTML/CSS/JS 渲染层，无框架、无构建器、无后端。数据存 localStorage，主进程只管窗口/托盘/快捷键/协议。

当前版本 1.13.1：Kun 风格 UI + GitHub 自动更新（基线 v1.12.0；灵动岛已移除）。

## 2. 先读什么

1. `START-HERE.md`
2. `docs/handoff/01-PRD-v1.13.md`
3. `docs/handoff/02-UI-KUN-SPEC.md`

5. `docs/handoff/04-DESIGN-TOKENS.md` + `schemes.json`
6. `docs/handoff/05-ARCHITECTURE.md`
7. `docs/handoff/06-TASK-BREAKDOWN.md`
8. `docs/handoff/07-TEST-PLAN.md`
9. `docs/handoff/09-CURRENT-BASELINE.md`

## 3. 架构边界（不可跨越）

```
插件层  plugins/<id>/
渲染层  src/renderer/js/modules/
核心层  src/renderer/js/core/store.js · registry.js
安全桥  src/main/preload.js → window.tfBridge
主进程  src/main/main.js + ipc/{app,plugins,shell,update}.js
```

1. 渲染层不许 `require`；系统能力走 `tfBridge`，新增能力 = `ipc/<域>.js` 注册 + `preload.js` 白名单。
2. 主进程不碰业务数据；localStorage 是唯一事实源。
3. 模块之间不直接调用；走 `TF.bus` / `TF.ext` / `TF.Store`。
4. 插件不改核心；数据 key 带 `plugin:<id>:` 前缀。
5. `contextIsolation: true`、`nodeIntegration: false` 不变；IPC 参数必须校验。

## 4. 代码约定

- 渲染层模块是 IIFE，挂 `TF.*` / `App.*`；顺序加载见 `index.html`。
- 数据入口只用 `TF.Store`；不要直接 `localStorage.setItem` 业务 key。
- 颜色只用 token：`var(--...)`；禁止组件内裸 `#hex` / `rgb()`。
- 动效只动 `transform/opacity/color/border-color/box-shadow`；禁止 `transition: all`、`ease-in`、`scale(0)`。
- 中文 UI 文案，短句，不用感叹号堆砌。
- 新增文件必须在 `index.html` 或 `build.mjs` 的清单里登记；`verify.mjs` 会检查引用/顺序。
- 不新增运行时依赖；系统能力只用 Electron 原生 API。

## 5. 禁止事项

- 不重写项目、不换框架、不引入 React/Vue/Tailwind。
- 不复制 Kun 的 AI 业务（模型供应商、MCP、子代理、终端、手机、代码工作区）。
- 不引入账号、后端、云同步、支付。
- 不改 `reference/` 与 `docs/iteration-112/` 历史文档。
- 不删 `artifacts/`、`build/`、用户数据。
- 不跳过测试；不把 `TODO` 留在 P0 路径。
- 不在组件里写死颜色、圆角、字号、时长。

## 6. 命令

```powershell
npm run verify          # 静态自检：引用/语法/顺序/版本
npm test                # node --test
npm run stage           # 重建 src/main/stage
cd src/main && npm i    # 首次装 Electron 依赖
cd src/main && npx electron stage
```

> `stage` 里才有 `www`；直接 `npm start` 可能找不到 `www`，用 `npx electron stage`。

每阶段结束必须三条全绿；Phase 2 加 Electron 人工冒烟。

## 7. 完成定义

- `verify` 8/8、`npm test` 全绿、`stage` 完整、`TF.VERSION = 1.13.1`
- 9 套配色 × 浅/深/系统，正文/元信息 ≥4.5
- 字号/宽度实时生效并持久化
- 12 视图 0 console error
- 1060/1400/4K 无穿帮
- `docs/handoff/IMPLEMENTATION-NOTES.md` 记录所有偏差与假设

## 8. 汇报格式

```
Phase X
- TX.Y ✅ 文件：... 验证：...
测试：verify 8/8 · test N/N · stage N files
已知问题：...
截图：...
```

不要只说“完成了”。
