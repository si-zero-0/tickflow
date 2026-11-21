# 刻度 TickFlow · 架构

> v1.11.0 的可运行版本 + 面向"可安装、可扩展"的分层骨架。目标不是重写，而是**先划边界，再逐块替换**。

## 1 五层边界

```
┌─────────────────────────────────────────────────────────────┐
│ 插件层  plugins\<id>\  （manifest + renderer.js + main.js）   │  只准用公开面
├─────────────────────────────────────────────────────────────┤
│ 渲染层  src\renderer\js\modules\  views roadmap timeline      │  功能视图
│                                  tools palette app            │
├─────────────────────────────────────────────────────────────┤
│ 核心层  src\renderer\js\core\  store.js（数据）               │  唯一状态源
│                                registry.js（注册表/总线/扩展点）│
├─────────────────────────────────────────────────────────────┤
│ 安全桥  src\main\preload.js  →  window.tfBridge              │  白名单，单向
├─────────────────────────────────────────────────────────────┤
│ 主进程  src\main\main.js  +  ipc\{app,plugins,shell}.js      │  窗口/托盘/协议/IPC
└─────────────────────────────────────────────────────────────┘
```

四条不可跨越的线：

1. **渲染层不许 `require`**，一切系统能力走 `tfBridge`；新增能力 = `ipc/<域>.js` 注册 + `preload.js` 加一行。
2. **主进程不许碰业务数据**，localStorage 是唯一事实源；主进程只提供能力，不缓存任务。
3. **模块之间不许直接互相调用**，走 `TF.bus` 事件 或 `TF.ext` 扩展点；`TF.Store` 是唯一合法的数据入口。
4. **插件不许改核心**：只能 `TF.ext.contribute(...)`；数据 key 必须带 `plugin:<id>:` 前缀。

## 2 目录职责

| 路径 | 放什么 | 不放什么 |
|---|---|---|
| `src/main/main.js` | 窗口、托盘、全局快捷键、`tf://` 协议、生命周期 | 业务逻辑、DOM 操作 |
| `src/main/ipc/` | 每个域一个文件，`ipcMain.handle` 白名单 | 任意路径读写、`eval` |
| `src/main/preload.js` | `contextBridge` 暴露面，冻结对象 | 业务判断 |
| `src/main/services/` | 待拆的能力：协议、托盘、快捷键、自动更新 | 现在还是空位，见 `services/README.md` |
| `src/renderer/js/core/` | store（数据 + 迁移）、registry（define/mount/bus/ext） | 视图渲染 |
| `src/renderer/js/modules/` | 六个功能模块，各自独立 IIFE | 直接读写 localStorage（走 Store） |
| `src/renderer/css/` | app → extra → refresh 三层覆盖，token 在 refresh | 内联样式硬编码颜色 |
| `plugins/` | 插件源码，`_` 开头不加载 | 核心代码 |
| `scripts/` | build / verify 两个入口 | 运行时依赖 |
| `build/` | dist、release 产物，**只留最新一份** | 源码、备份 |
| `docs/` | 契约与决策记录 | 教程长文 |

## 3 模块生命周期

```
define(id, {deps, init, mount, unmount})
  → mount(id)：递归解析 deps（循环依赖直接抛错）→ init() → mount()
  → 单个模块失败被隔离（state='failed'），不拖垮其它模块
  → start()：挂载全部已定义模块；app.js 在首屏渲染后调用一次
```

现有六个模块是**受管的遗留模块**：仍在 `index.html` 里按顺序加载、自己立即执行，没有走 `define`。迁移顺序（每次只动一个，跑 `verify` + `--smoke` 再进下一个）：

`store → views → timeline → tools → palette → roadmap → app`

`app.js` 迁移最后做——它是启动器，改成 `define('core:app', {deps:[...]})` 之后 `index.html` 才能只剩 `core/*` 两个脚本。

## 4 数据与版本

| 项 | 现状 | 目标 |
|---|---|---|
| 存储 | localStorage，多配置分 key：`tickflow.profiles.v1` + `tickflow.db.<id>` | 加 `schemaVersion`，迁移函数链式执行，失败回滚快照 |
| 快照 | 每日快照（store 内） | 保留，迁移前强制打一份 |
| 插件数据 | — | `plugin:<id>:*`，宿主提供 `tfBridge.storage` 而不是让插件直写 localStorage |
| 版本号 | `package.json` 1.11.0，`TF.VERSION` 1.4.0（漂移） | 构建时注入 `__APP_VERSION__`，`TF.VERSION` 读它 |

## 5 构建与验证

```
node scripts/build.mjs --stage-only    # 只重建 stage，秒级，改完前端可先跑这个
node scripts/build.mjs                 # 完整出包 → build/dist + build/release
node scripts/verify.mjs                # 静态自检：引用/语法/顺序/manifest/产物污染/版本漂移
```

打包仍是 `@electron/packager` → `electron-builder --prepackaged` 两步，**不用 portable**（33 秒启动）。详见 `10` 系列文档与 `docs/DECISIONS.md`。

## 6 演进顺序（与 50-backlog 架构演进表一致）

1. **P0** 六个模块逐个 `define` 化 → `index.html` 只剩 core
2. **P0** 数据加 `schemaVersion` + 迁移链 + 迁移前快照
3. **P1** 插件宿主打通阶段 2–4（校验 / 注入 / 主进程侧），先只放行 `commands`
4. **P1** `views` / `renderers` / `themes` 三个扩展点接线
5. **P1** ES Module 化（`tf://` 已支持），保留 `file://` 双击兜底
6. **P2** `services/` 拆分、自动更新、插件权限校验、`node:test`
