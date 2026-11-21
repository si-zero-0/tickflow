# 目标架构与实现设计 · TickFlow v1.13.0

> 基线：v1.12.0 五层架构（主进程 / preload / 核心 / 渲染 / 插件）。
> 原则：增量改造，不重写；主窗口持有唯一 Store；顶部岛是投影。

---

## 1. 现状

```
插件层  plugins/<id>/
渲染层  src/renderer/js/modules/{views,roadmap,timeline,tools,palette,wish,island,app}.js
核心层  src/renderer/js/core/{store,registry}.js
安全桥  src/main/preload.js → window.tfBridge
主进程  src/main/main.js + ipc/{app,plugins,shell}.js
```

- 数据：localStorage，多配置 `tickflow.profiles.v1` + `tickflow.db.<id>`；`Store` 是唯一入口。
- 主题：`css/theme.css` 6 主题 × 6 强调；`theme.js` 写 `data-theme/data-mode/data-accent`。
- 岛屿：`js/modules/island.js` 渲染在主窗口底部；`#island` z=30。
- 构建：`scripts/build.mjs` 把 `src/renderer` + `src/main` 复制到 `src/main/stage`；`verify.mjs` 检查引用/顺序/版本。

## 2. 目标结构

```
src/
├─ main/
│  ├─ main.js                 # 窗口/托盘/快捷键/生命周期
│  ├─ preload.js              # tfBridge 白名单（新增 topIsland）
│  ├─ ipc/
│  │  ├─ app.js
│  │  ├─ plugins.js
│  │  ├─ shell.js
│  │  └─ top-island.js        # 新增：创建/销毁/定位/推送/动作
│  └─ services/               # 预留
└─ renderer/
   ├─ index.html              # 主窗：新壳 + 新设置容器
   ├─ top-island.html         # 新增：顶部岛
   ├─ css/
   │  ├─ theme.css            # 默认 token + 首屏兜底（9 方案的 dark 默认）
   │  ├─ app.css              # 主壳/组件/设置/外观
   │  ├─ refresh.css          # 尺寸/字号/时长/兼容
   │  ├─ extra.css            # 兼容层
   │  ├─ features.css         # 新组件（配色卡/滑杆/涟漪/顶部岛）
   │  └─ top-island.css       # 顶部岛专用
   ├─ js/
   │  ├─ core/{store,registry}.js
   │  └─ modules/
   │     ├─ appearance.js     # 新增：mode/scheme/font/width/highlight/ripple
   │     ├─ settings.js       # 新增：设置壳 + 8 分类（可从 app.js 拆）
   │     ├─ top-island.js     # 新增：顶部岛渲染/动作
   │     ├─ island.js         # 底部岛（保留，抽共享纯函数）
   │     ├─ app.js            # 主壳/导航/路由（瘦身）
   │     └─ ...               # views/wish/tools/palette/timeline/roadmap
   └─ data/
      └─ schemes.json         # 构建时复制或内联
```

## 3. 主题与外观层

### 3.1 运行时

```
settings.appearance
  → appearance.apply()
  → <html data-mode data-scheme data-font data-width>
  → root.style.setProperty('--bg', ...) × 17
  → CSS 组件消费 var(--...)
```

- `appearance.js` 暴露：
  - `TF.applyAppearance(patch)`：合并、写 Store、应用、广播。
  - `TF.getAppearance()`：返回当前快照。
  - `TF.previewAppearance(patch)`：只应用不落盘（设置页 hover 预览）。
- `theme.js` 保留兼容：`TF.applyTheme()` 内部调 `applyAppearance`，旧调用不破。
- 顶部岛加载同一 `schemes.json`，通过 IPC 接收 `theme` 快照，应用同样的 CSS 变量。

### 3.2 首屏

- `theme.css` 写死默认 dark + light 兜底，避免 JS 加载前闪白。
- `index.html` 的 `<html>` 默认 `data-mode="dark" data-scheme="kun-default"`。
- `appearance.js` 在主窗启动最早阶段执行（在 `app.js` 之前或 `app.init` 第一行）。

## 4. 设置层

### 4.1 数据模型

```js
settings.appearance = {
  mode: 'dark',              // light|dark|system
  scheme: 'kun-default',
  accentOverride: null,      // null | '#5AA7FF'
  fontSize: 82,              // 70..120
  contentWidth: 896,         // 640..1200
  highlight: true,
  ripple: true,
  custom: { bg:'#0A1220', panel:'#0F1A2B', border:'#1E2F47', accent:'#5AA7FF' }
};

settings.m3 = {
  enabled: false,
  position: 'top-center',
  monitor: 'primary',
  offsetX: 0, offsetY: 8,
  width: 360,
  opacity: 1,
  radius: 14,
  content: { task:true, count:true, countdown:true, reminders:true, focus:true },
  reminderOwner: 'top',
  autoExpand: true,
  hideOnFullscreen: true,
  minimal: false
};
```

- `Store.migrate()` 增加 `1.12 → 1.13`：
  - 旧 `theme/accent` → `appearance` 映射（见 04）。
  - 缺省值补齐；不删旧字段。
  - 迁移前 `snapshot(true)`；失败回滚。
- `Store` 里新增 `appearance`/`m3` 的归一化与范围钳制。

### 4.2 设置壳

- `settings.js` 渲染：
  - 左分类（8 类）+ 右内容卡片。
  - 搜索：过滤分类项并跳转。
  - 路由：`App.settingsTab = 'general'|'appearance'|...`。
- 设置页不再用 `TF.modal()` 单页；用全屏 `#settings-view`（或大 modal 但保留左栏）。
- 打开设置时保存滚动位置；切换分类不重建右栏外层，只替换内容。

## 5. M3 双岛

### 5.1 角色

| 角色 | 职责 |
|---|---|
| 主窗口 | Store 唯一 owner；业务写入；提醒轮询；持久化 |
| 顶部岛 | 只读投影；按钮发 action；不写 Store |
| 主进程 | 窗口生命周期；IPC 转发；不缓存业务数据 |

### 5.2 时序

```
主窗口 Store 变更
  → App.pushIslandSnapshot()（50ms 合并）
  → tfBridge.topIsland.push(snapshot)
  → ipcMain.on('top-island:push') → topWin.webContents.send('top-island:state', snapshot)
  → 顶部岛 render

顶部岛点击“完成”
  → tfBridge.topIsland.action({type:'complete', taskId, actionId})
  → ipcMain.handle('top-island:action') 校验 sender/type/频率
  → mainWin.webContents.send('top-island:action', action)
  → 主窗口 App.handleTopIslandAction(action)
  → Store.toggleTask() / snooze / open
  → pushIslandSnapshot() + ack
```

### 5.3 窗口

- `ipc/top-island.js`：
  - `create()`：`new BrowserWindow({...})`；加载 `top-island.html`；`showInactive()`；`setAlwaysOnTop(true,'screen-saver')`；`setSkipTaskbar(true)`。
  - `destroy()`：`win.destroy()`；置空。
  - `position()`：`screen.getPrimaryDisplay().workArea`；`setBounds`；夹取。
  - `push(snapshot)`：`win.webContents.send`；窗口未加载时排队最后一条。
  - `resize(w,h)`：`setBounds({x,y,width,height}, false)`。
- `main.js`：
  - `app.whenReady()` 后按 `settings.m3.enabled` 创建。
  - `window-all-closed` 不退出（托盘常驻）。
  - 主窗 `close` 事件：`preventDefault(); hide()`，除非 `quitting`。
  - 托盘菜单：显示主窗 / 顶部岛 / 仅底部 / 退出。
- `preload.js`：
  ```js
  topIsland: {
    push: (s) => ipcRenderer.send('top-island:push', s),
    action: (a) => ipcRenderer.invoke('top-island:action', a),
    onState: (fn) => { ipcRenderer.on('top-island:state', (_, s) => fn(s)); },
    hello: () => ipcRenderer.invoke('top-island:hello'),
    resize: (w,h) => ipcRenderer.send('top-island:resize', {w,h})
  }
  ```

### 5.4 顶部岛渲染

- 复用 `theme.css` + `top-island.css`；JS 独立 `top-island.js`，不加载 `app.js`。
- 共享纯函数：`pickCurrentTask`、`formatDue`、`remaining` 抽到 `core/derive.js` 或 `parse.js`，两端引用。
- 状态：本地只存 `snapshot` + `uiState`；不存业务数据。
- 动作按钮：点击后禁用 300ms，防重复；收到新快照恢复。

## 6. 主壳与组件

| 区域 | 实现 |
|---|---|
| 左侧栏 | `app.js` `sidebarHTML()` 重写为分组结构；新增 `.sb-group/.sb-item/.sb-icon` |
| 顶栏 | `topbarHTML()` 加面包屑/搜索/右栏切换 |
| 右栏 | `index.html` 新增 `#right-rail`；`app.js` 绑定 |
| 状态栏 | `index.html` 新增 `#statusbar`；专注/计数/版本 |
| 设置 | 新 `settings.js`；`app.js` 只保留入口 |
| 外观 | 新 `appearance.js`；设置页调用 |
| 组件 | `app.css`/`features.css` 重写 token 消费；不一次性删除旧样式，按组件替换 |
| 底部岛 | `island.js` 只改 class/结构，不动状态机 |

## 7. 文件改动清单

### 新增

- `src/renderer/top-island.html`
- `src/renderer/css/top-island.css`
- `src/renderer/js/modules/top-island.js`
- `src/renderer/js/modules/appearance.js`
- `src/renderer/js/modules/settings.js`
- `src/renderer/js/core/derive.js`（共享纯函数，可选）
- `src/renderer/data/schemes.json`（或构建时内联）
- `src/main/ipc/top-island.js`
- `tests/appearance.test.mjs`
- `tests/m3-sync.test.mjs`

### 修改

- `src/main/main.js`：顶部岛生命周期、托盘、关闭到托盘
- `src/main/preload.js`：`tfBridge.topIsland`
- `src/renderer/index.html`：新壳容器、5 CSS / 脚本顺序
- `src/renderer/css/{theme,app,refresh,features}.css`
- `src/renderer/js/modules/{app,theme,island}.js`
- `src/renderer/js/core/store.js`：迁移/归一化
- `scripts/build.mjs`：复制 `top-island.html`/`data/schemes.json`
- `scripts/verify.mjs`：检查新引用/顺序
- `package.json` / `src/main/package.json`：1.13.0

### 不改

- `src/main/ipc/{app,plugins,shell}.js`（除非需要新增窗口查询）
- 业务视图逻辑（views/roadmap/timeline/tools/palette/wish）
- 插件协议

## 8. 构建/验证

- `build.mjs`：
  - 复制 `src/renderer/**` 到 `stage/www`，包含 `top-island.html`、`data/schemes.json`。
  - 复制 `src/main/**`，排除 `stage`。
  - 26 → 预计 30+ 文件；`verify` 的清单同步更新。
- `verify.mjs`：
  - `index.html` 引用检查；
  - 脚本顺序：`store → registry → parse → appearance → ... → app`；
  - `top-island.html` 只引 `theme.css`/`top-island.css`/`top-island.js`；
  - 版本一致 1.13.0；
  - 无 `distN/releaseN` 残留。
- 单测：
  - `appearance.test.mjs`：9×2 对比度、迁移、范围钳制。
  - `m3-sync.test.mjs`：快照 reducer、action 幂等、提醒归属。
  - 现有 `core/theme/registry` 保持绿。

## 9. 安全

- 保持 `contextIsolation: true`、`nodeIntegration: false`。
- `top-island` 窗口只加载本地 `tf://` 资源；禁止远程导航；`will-navigate` 拦截。
- IPC 校验：
  - sender 必须是 top island；
  - action type 白名单；
  - `taskId` 字符串 ≤64；
  - 频率 ≤20/s；
  - 不接受任意路径/HTML。
- 顶部岛不直接读 localStorage；只收快照。

## 10. 性能

- 快照 50ms 合并；倒计时 1s；不可见窗口暂停 tick。
- 顶部岛不加载 `app.js`/视图模块；只加载 `theme.css` + `top-island.css` + `top-island.js`。
- 主窗口最小化时顶部岛仍运行；主窗口隐藏不销毁。
- 目标：双窗口内存增量 <80MB；同步 P95 <100ms；暖启动 <60ms。

## 11. 回滚

- 设置 `m3.enabled=false`：销毁顶部岛，底部岛恢复 v1.12 行为。
- 外观：旧 `theme/accent` 字段保留；提供“恢复 v1.12 外观”按钮（映射到 parchment/graphite）。
- 数据：迁移前快照；`Store.restoreSnapshot()` 可回滚。
- 代码：`docs/handoff/IMPLEMENTATION-NOTES.md` 记录每个 phase 的 commit/文件，便于回退。
