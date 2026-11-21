# src/main/services —— 待拆的能力层（占位）

现在这些能力还写在 `main.js` 里，共 155 行，能跑但耦合。拆分目标：每个能力一个文件、一个 `setup()/dispose()` 对，`main.js` 只剩编排。

| 计划文件 | 从 main.js 搬什么 | 对外接口 |
|---|---|---|
| `protocol.js` | `registerSchemesAsPrivileged` + `protocol.handle('tf')` + MIME 表 | `setup({ root })` |
| `tray.js` | `buildTray()`、托盘菜单、`displayBalloon` | `setup({ icon, onOpen, onCapture, onQuit })` |
| `shortcuts.js` | `globalShortcut.register('Control+Alt+Space')` | `setup({ onCapture })` / `dispose()` |
| `window.js` | `createWindow()`、`ready-to-show`、close→托盘 拦截 | `create() / show() / focus() / dispose()` |
| `updater.js` | 目前没有；`%LOCALAPPDATA%\tickflow-updater` 只是 NSIS 残留 | `check()` / 状态事件 |

拆分时守两条：**能力不读业务数据**；**每个能力必须能 `dispose()`**（插件热卸载、窗口重建都依赖它）。
