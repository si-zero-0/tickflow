# 刻度 TickFlow · 开发副本

Windows 本地任务 + 进程管理工具。纯前端（无框架、无构建步骤）+ Electron 壳，本机数据存储，无账号无联网。

- 本机状态：**已卸载**（2026-11-17，暂不使用）；分发物与运行时存档都在本目录 `artifacts/`
- 本文档是**开发工作副本**，源码事实源在这里；机器上 TickFlow 相关物**只允许**出现在本目录。

## 目录

```
src/main/        Electron 主进程 + preload + ipc + 构建配置 + node_modules
src/renderer/    前端：index.html + css/ + js/core/ + js/modules/ + assets/
plugins/         插件（_ 开头不加载）
scripts/         build.mjs（唯一打包入口）、verify.mjs（静态自检）
tests/           注册表单测（node --test）
docs/            PLUGIN-API.md 插件契约、DECISIONS.md 决策记录
artifacts/       分发物 dist/ + 运行时存档 userdata-20261117/（见其 README）
build/           产物：dist（未打包）、release（Setup.exe），只留最新一份
```

## 首次恢复（clone 下来或换机后）

```bash
cd src/main
npm i                     # electron / @electron/packager / electron-builder
npm i --package-lock-only # 生成锁文件，务必提交；否则版本会漂
npm start                 # 起 Electron 壳（带托盘、全局快捷键）
```

只想看前端：直接双击 `src/renderer/index.html`（缺托盘与快捷键，其余一致）。

## 常用

| 命令 | 作用 |
|---|---|
| `npm --prefix src/main start` | 开发启动 |
| `node scripts/build.mjs --stage-only` | 只同步 stage，秒级自检 |
| `node scripts/build.mjs` | 出包 → `build/release/刻度-TickFlow-Setup-<ver>.exe` |
| `node scripts/verify.mjs` | 引用 / 语法 / 脚本顺序 / manifest / 产物污染 / 版本漂移 |

**不要跑 `npm run build` 那个旧别名以外的方式**——`src/main/package.json` 的 `build` 已指向 `scripts/build.mjs`；历史文档里的 `electron-builder --win portable` 是废弃路径（33 秒启动）。

## 改代码前先读

1. `ARCHITECTURE.md` — 五层边界、四条不可跨越的线、演进顺序
2. `docs/PLUGIN-API.md` — 插件 manifest 与四个扩展点（`commands` 已接线）
3. `src/renderer/DESIGN.md` — 颜色 / 字号 / 层次 / 动效 / 反模式
4. `docs/DECISIONS.md` — 为什么零构建、为什么只出 NSIS

## 冒烟

```bash
build/release/刻度-TickFlow-Setup-1.11.0.exe /S
%LOCALAPPDATA%\Programs\TickFlow\TickFlow.exe --smoke
type %TEMP%\tickflow-smoke.json     # consoleErrors 必须是 []
```

冒烟前 `unset ELECTRON_RUN_AS_NODE`，否则 exe 会当 node 跑并报 `bad option: --smoke`。
