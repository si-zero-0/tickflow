# v1.12.0 现状基线 · TickFlow

> 目的：让实现者知道“已经有什么、在哪里、不能弄坏什么”。
> 版本：1.12.0；`verify` 8/8；`npm test` 45/45；`stage` 26 文件。

---

## 1. 产品能力

### 1.1 任务

- 视图：收件箱、今天、未来 7 天、全部、已完成、时间轴、日历、四象限、习惯、进程、统计。
- 任务字段：标题、描述、清单、日期/时间、优先级、标签、子任务、重复、专注计数。
- 操作：添加、编辑、完成、删除、改期、复制、拖拽排序/四象限。
- 快速添加：自然语言（8 日期 + 3 时间 + 优先级 + 标签 + 清单）、实时预览、连续录入不失焦。
- 行菜单：今天/明天/本周/完成/删除/打开详情。
- 抽屉：编辑、Ctrl+Enter 完成、复制。

### 1.2 愿望

- 独立集合 `wishes`；卡片网格、统计、筛选、三种排序。
- 懒创建、字段即时保存、删除二次确认、标记实现/取消、愿望转任务。

### 1.3 专注/统计/其他

- 番茄钟、统计页、习惯、四象限、时间轴、日历、进程页。
- 命令面板（Ctrl+K）、快速捕获（Ctrl+Alt+Space，主进程全局键）。
- 导入/导出 JSON/MD/CSV、快照、多本地配置。

### 1.4 底部灵动岛（v1.12）

- 底部居中，收起 560×40 / 展开 560×342 / 提醒态。
- R1–R5 当前任务；今日待办 5 条；6 操作：完成/推迟 10 分钟/明天/开始专注/打开详情/新建任务。
- 提醒队列 ≤20；同一 taskId 去重；8s 收起不清队列；知道了逐条；`notifiedOn` 只由主窗 30s 轮询写。
- 设置：启用、到点自动展开；关闭时回退旧提醒卡。
- 快捷键：`Ctrl+Alt+I` 开合（窗口内）。
- 1060×700 适配；reduced motion。

## 2. 主题（v1.12）

- 6 主题：graphite / night / tundra / dawn / mist / paper。
- 6 强调色：blue / cyan / green / purple / orange / rose。
- `css/theme.css` 唯一颜色权威；`theme.js` 写 `data-theme/data-mode/data-accent`。
- `data-mode` 由主题推导：graphite/night/tundra→dark；dawn/mist/paper→light。
- 设置里有主题卡 + 强调圆点 + 实时预览。
- 已知问题：
  - I-16：`.tl-now span` 白字压 `--dan`，dark 档 2.93:1；待修。
  - I-17：`app.css` 仍有旧颜色 token、旧 `.btn.pri` 提亮渐变、品牌蓝阴影；均被后加载文件覆盖，属死代码；v1.13 清理。
  - I-15：`.brand-mark` 固定蓝渐变，属品牌识别，刻意保留。

## 3. 文件地图

```
src/
├─ main/
│  ├─ main.js               # BrowserWindow/Tray/globalShortcut/tf:// 协议
│  ├─ preload.js            # contextBridge: tfBridge
│  ├─ ipc/{app,plugins,shell}.js
│  ├─ services/             # 预留
│  └─ build/icon.ico
└─ renderer/
   ├─ index.html            # 5 CSS + 12 scripts
   ├─ DESIGN.md             # 视觉契约
   ├─ css/{app,extra,refresh,theme,features}.css
   └─ js/
      ├─ core/{store,registry}.js
      └─ modules/{views,roadmap,timeline,tools,palette,wish,island,app}.js
```

### 关键文件

| 文件 | 作用 |
|---|---|
| `index.html` | 入口；CSS/脚本顺序；`#sidebar/#topbar/#content/#drawer/#modal-host/#island` |
| `app.js` | 主壳、路由、render、设置弹窗、行菜单、抽屉、快捷键、提醒轮询 |
| `island.js` | 底部岛状态机、渲染、队列、动作 |
| `theme.js` | 主题/强调色应用、切换、浮层 |
| `store.js` | 数据、迁移、保存、快照、导入导出 |
| `views.js` | 各视图 HTML、任务行、快速添加、筛选 |
| `wish.js` | 愿望网格/编辑/统计 |
| `palette.js` | 命令面板 |
| `tools.js` | 其他工具/弹窗 |
| `main.js` | 窗口、托盘、快捷键、IPC 注册 |
| `preload.js` | `tfBridge` 白名单 |
| `scripts/build.mjs` | stage/release |
| `scripts/verify.mjs` | 引用/语法/顺序/版本/产物检查 |

## 4. 数据

- localStorage：
  - `tickflow.profiles.v1`：配置列表/当前配置。
  - `tickflow.db.<id>`：`{ tasks, lists, wishes, settings, snaps, ... }`。
- `Store` 是唯一入口；`Store.data` 内存态；`save()` 280ms 合并。
- 每日快照；`snapshot(true)` 强制。
- 迁移：`Store.migrate()`；`db.version` 仍为 1（v1.12 已知限制）。

## 5. 主进程

- 单窗口 1400×900，min 1060×700；`contextIsolation:true`、`nodeIntegration:false`。
- 托盘：打开/快速捕获/退出。
- 全局快捷键：`Control+Alt+Space` 快速捕获。
- `tf://` 协议服务本地文件。
- IPC：app/plugins/shell；无顶部岛。
- 关闭窗口即退出（v1.12），无“关闭到托盘”。

## 6. 测试

- `tests/core.test.mjs`：30 条（Store/parse/任务/愿望/岛）。
- `tests/theme.test.mjs`：7 条（6 主题对比度 + 映射）。
- `tests/registry.test.mjs`：8 条。
- `tests/harness.mjs`：DOM/Store 测试脚手架。
- 合计 45；`npm test` 全绿。

## 7. 命令

```powershell
npm run verify
npm test
npm run stage
npm run build
cd src/main && npm i && npm start
```

## 8. 不能弄坏

- 12 个视图的 `App.view` 类型与渲染入口。
- `Store` 的 key、字段、迁移、快照。
- 快速添加解析（8 日期/3 时间/优先级/标签/清单）与连续添加焦点。
- 愿望全生命周期。
- 底部岛三态、队列、`notifiedOn` 生命周期。
- 导入/导出/快照/多配置。
- 命令面板/快速捕获/抽屉/行菜单/键盘。
- `verify`/`test`/`stage` 三条命令。

## 9. 已知限制

| ID | 内容 | v1.13 处理 |
|---|---|---|
| I-16 | 时间轴“此刻”胶囊 dark 2.93:1 | 改用 `--accent-ink` 或加深底 |
| I-17 | `app.css` 旧颜色 token/旧 `.btn.pri`/品牌蓝阴影 | 删除死代码或改 token |
| I-15 | 品牌徽标固定蓝渐变 | 保留（品牌识别） |
| — | `db.version` 仍为 1 | 可顺手加 schemaVersion，非必须 |
| — | 结构快照仅 deep copy | 保持 |
