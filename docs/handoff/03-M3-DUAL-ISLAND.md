# M3 双岛 · 功能与实现规范

> 目标：底部主岛保留 v1.12 体验；新增顶部迷你岛；两套 UI 共享一份状态。
> 参考：`reference/m3-dual-island-map.html`（196 节点功能树）、`03-M3-DUAL-ISLAND.md` 本文件为**实现口径**。
> 原则：**主窗口是唯一 Store owner，顶部岛只是投影**。

---

## 1. 范围

### P0（v1.13.0 必须）

- 顶部岛窗口创建/销毁、位置、透明、置顶、不进任务栏、不抢焦点
- 三态：收起 / 展开 / 提醒
- 收起态内容：当前任务、今日计数、倒计时、提醒数、状态点
- 展开态：当前任务卡、今日待办 3 条、6 个操作
- 提醒态：完成 / 10 分钟后 / 知道了；队列逐条
- 双岛同步：任务/提醒/专注/主题/设置；P95 <100ms
- 提醒归属与去重；同一任务只弹一次
- 设置：开关/位置/宽度/透明度/圆角/内容开关/提醒归属
- 关闭顶部岛后，底部岛行为与 v1.12 完全一致

### P1（v1.13.x）

- 专注态（番茄剩余/进度环/暂停继续）
- 极简细线 / 浏览器贴顶自动极简
- 多显示器选择 / 边缘吸附 / 全屏隐藏
- 全局快捷键开合顶部岛 / 开始专注
- 托盘菜单：显示顶部岛 / 仅底部 / 双岛
- 顶部岛右键菜单
- 悬停意图 / 弹簧过冲（参考岛仔 0.20s / 0.12s）

### 不做

- 12 个业务页（音乐/邮箱/AI 额度/日程/系统/天气/进程）
- 系统通知镜像/通知中心/音量亮度 HUD/媒体歌词
- 桌面宠物（v1.14 独立需求）

## 2. 窗口架构

### 2.1 方案选择

| 方案 | 做法 | 结论 |
|---|---|---|
| A. 小窗口贴合岛体 | BrowserWindow 尺寸=岛体；展开时 resize | **推荐 P0**：不需要点击穿透命中区，简单稳定 |
| B. 大透明画布 + 点击穿透 | 640×270 透明窗口，动态 `setIgnoreMouseEvents` | 接近岛仔，但命中区/焦点复杂，P1 再考虑 |

P0 用 A：窗口宽高随状态变化（收起 360×40，展开 420×260，提醒 420×180），圆角/透明由 CSS 负责。这样“点击穿透”天然成立：窗口外没有东西。

### 2.2 BrowserWindow 参数

```js
new BrowserWindow({
  width: 360, height: 40,
  x, y,
  frame: false,
  transparent: true,
  resizable: false,
  movable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  hasShadow: false,
  focusable: false,          // P0 顶部岛没有输入框
  show: false,
  backgroundColor: '#00000000',
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, 'preload.js'),
    backgroundThrottling: false
  }
});
win.setAlwaysOnTop(true, 'screen-saver');
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
win.showInactive();
```

- 位置：`screen.getPrimaryDisplay().workArea`；`x = area.x + (area.width - w) / 2`，`y = area.y + offsetY`（默认 8）。
- 多显示器：P1，`settings.m3.monitor = 'primary' | 'cursor' | displayId`。
- 尺寸变化：`win.setBounds({x,y,width,height}, false)`；不要用 `setSize` 单独改，避免位置跳。
- 关闭：禁用时 `win.destroy()`；应用退出时销毁；主窗口关闭到托盘时**不销毁**。

### 2.3 入口文件

| 文件 | 作用 |
|---|---|
| `src/renderer/top-island.html` | 顶部岛 DOM；加载 `css/theme.css`、`css/top-island.css`、`js/modules/top-island.js` |
| `src/renderer/css/top-island.css` | 顶部岛专用样式（复用 theme tokens） |
| `src/renderer/js/modules/top-island.js` | 渲染 + 动作 + 接收快照；不直接读写 Store |
| `src/main/ipc/top-island.js` | 创建/销毁/定位/推送/动作转发 |
| `src/main/preload.js` | 暴露 `tfBridge.topIsland` |
| `src/main/main.js` | 初始化 IPC、窗口生命周期、托盘 |

## 3. 状态机

```
hidden ──enable──> collapsed ──click/hover──> expanded
                      │  ▲                      │
                      │  └────── leave/Esc ─────┘
                      │
                      └──reminder──> remind ──8s/知道了──> collapsed
                                      │
                                      └──完成/推迟──> 下一条 or collapsed
```

- `collapsed`：360×40；状态点 + 当前任务（1 行）+ 右侧信息位。
- `expanded`：420×260；当前任务卡 + 今日待办 3 条 + 6 操作 + “打开全部待办”。
- `remind`：420×180；红边 + 任务标题 + 完成/10 分钟/知道了 + 队列。
- `focus`（P1）：420×160；剩余时间 + 进度环 + 暂停/继续/结束。
- `minimal`（P1）：44×4.5；只有一条细线；悬停 0.4s 展开。

> 状态切换必须在一个 render 内完成，避免先显示旧内容再跳。

## 4. 内容

### 4.1 收起态

| 区域 | 内容 | 数据 |
|---|---|---|
| 左状态点 | 8px 圆点 | R1/R2 `--warning`；R3/R4 `--accent`；全完成 `--success`；提醒 `--danger` |
| 中标题 | 当前任务标题 1 行省略 | `pickCurrentTask` |
| 右信息 | R1 `mm:ss`；R2 `逾期 N 分`；R3/R4/R5 `今日 N 项`；提醒 `N 条到点` | 每秒/每分钟 |

### 4.2 展开态

- 当前任务卡：标题、清单、优先级、日期/时间；点击打开主窗抽屉。
- 今日待办 3 条：复选框 + 标题；勾选后局部移除 + “已完成 · 剩余 N 项”。
- 6 个操作：完成、推迟 10 分钟、明天、开始专注、打开详情、新建任务。
- 底部：“打开全部待办 →” → 主窗 today。
- 空态：今日无任务 → “今天还没有任务” + “新建任务”；全完成 → 绿色点 + “今天全部完成”。

### 4.3 提醒态

- 标题“到点了” + 任务标题 + 时间。
- 完成 / 10 分钟后 / 知道了。
- 队列：本端最多显示 1 条；“还有 N 条提醒” 可逐条查看。
- 8s 自动收起：**只收起，不清队列**；胶囊显示“N 条到点”；点胶囊回提醒态。
- 完成/推迟：只移除当前条；还有下一条继续提醒；没有才收起。
- `notifiedOn` 只由主窗口 30s 轮询写入；顶部岛不写（snooze 清空除外）。

## 5. 同步协议

### 5.1 角色

- **主窗口**：Store 唯一 owner；负责所有业务写入、提醒轮询、持久化。
- **顶部岛**：只读投影；用户操作以 action 形式回传；本地乐观更新仅用于按钮禁用/加载。
- **主进程**：纯转发 + 窗口管理；不缓存业务数据。

### 5.2 消息

```ts
// main -> top
type IslandSnapshot = {
  v: 1;
  seq: number;              // 单调递增
  ts: number;
  state: 'collapsed' | 'expanded' | 'remind' | 'focus' | 'minimal';
  current: { id, title, list, priority, due, dueTime, rule, remainSec, overdueMin } | null;
  today: { count: number; done: number; items: Array<{id,title,done,priority}> };
  reminder: { id, title, time, queue: number } | null;
  focus: { running, remainSec, totalSec } | null;
  theme: { mode, scheme, accent, fontSize };
  settings: { autoExpand, reminderOwner, content };
  window: { width, height, visible };
};

// top -> main
type IslandAction =
  | { type:'complete'; taskId:string; actionId:string }
  | { type:'snooze'; taskId:string; minutes:10; actionId:string }
  | { type:'tomorrow'; taskId:string; actionId:string }
  | { type:'focus'; taskId:string; actionId:string }
  | { type:'open'; taskId?:string; actionId:string }
  | { type:'new'; actionId:string }
  | { type:'ack'; taskId:string; actionId:string }
  | { type:'expand'|'collapse'; actionId:string };
```

- 通道：`ipcRenderer.invoke('top-island:action', action)` / `ipcRenderer.on('top-island:state', snapshot)`.
- 主进程校验：`sender` 必须是顶部岛窗口；action type 白名单；taskId 字符串长度限制；频率限制 20/s。
- 主窗口处理 action：调用 `App.handleTopIslandAction(action)`；写 Store；触发 `pushSnapshot()`；返回 `{ok, error?}`。
- 幂等：`actionId` 去重（主窗口保留最近 100 个，2 分钟）；重复返回 ok。
- 顺序：`seq` 小于当前丢弃；快照全量，不做增量，降低复杂度。
- 节流：普通变更 50ms 合并；倒计时 1s 一次；提醒/状态切换立即。
- 断连：顶部岛启动时 `invoke('top-island:hello')` 取最新快照；主窗口未就绪时返回 `null`，顶部岛显示“等待主窗口”。

### 5.3 同步范围

| 数据 | 方向 | 说明 |
|---|---|---|
| 任务 CRUD/完成/改期 | 主 → 顶 | 快照 |
| 提醒队列/当前条 | 主 → 顶 | 快照 |
| 专注状态/剩余 | 主 → 顶 | 1s |
| 主题/方案/字号 | 主 → 顶 | 变更即推 |
| 顶部岛设置 | 主 → 顶 | 变更即推 |
| 顶部岛展开/收起 | 顶 → 主 | 仅窗口状态，不回写 Store |
| 完成/推迟/明天/专注/打开/新建 | 顶 → 主 | action |

### 5.4 提醒归属

```
topIsland.enabled=false        -> owner = bottom
topIsland.enabled=true         -> owner = settings.m3.reminderOwner (default top)
owner=top                      -> 顶部弹提醒；底部只显示计数/红点
owner=bottom                   -> 底部弹提醒；顶部只显示红点
owner=follow-focus             -> 当前聚焦窗口优先；都没聚焦时 top
```

- 同一 taskId 只入一个队列；主窗口轮询是唯一 `notifiedOn` 写入者。
- 5 条同分钟：主窗口收集 due[] → 按归属交给一端；另一端只更新计数。
- 点“知道了”只确认当前条；不丢后续；8s 收起保留队列。

## 6. 设置

```js
m3: {
  enabled: false,              // 默认关闭
  position: 'top-center',
  monitor: 'primary',
  offsetX: 0,
  offsetY: 8,
  width: 360,
  opacity: 1,                  // 0.6..1
  radius: 14,                  // 8..22
  content: { task:true, count:true, countdown:true, reminders:true, focus:true },
  reminderOwner: 'top',        // top|bottom|follow-focus
  autoExpand: true,
  hideOnFullscreen: true,      // P1
  minimal: false               // P1
}
```

- 设置页“灵动岛”分类：底部岛（沿用）+ 顶部迷你岛（开关/位置/宽度/透明度/圆角/内容/归属）。
- 修改即时生效：开关创建/销毁；宽度/位置 `setBounds`；透明度/圆角 CSS 变量；内容开关重渲染。
- 默认关闭；关闭时不创建窗口，不占内存。

## 7. 主窗口协作

- 顶部岛“打开详情”：`win.show(); win.focus(); App.view={type:'today'}; App.openTask(id)`.
- 顶部岛“新建”：`win.show(); win.focus(); App.view={type:'today'}; focus qa-input`.
- 主窗口最小化：顶部岛继续；主窗口 Store 仍在。
- 主窗口关闭：默认拦截为“隐藏到托盘”，不退出；托盘“退出”才真正退出。
- 托盘菜单：显示主窗口 / 显示顶部岛 / 仅底部 / 退出。
- 主窗口恢复：重新推送快照。

## 8. 边界与降级

| 场景 | 行为 |
|---|---|
| 顶部岛渲染崩溃 | 主进程重建 1 次；再失败则 `m3.enabled=false` + 主窗 toast |
| 顶部岛创建失败 | 记日志；底部岛继续；设置里显示“顶部岛不可用” |
| 主窗口未加载 | 顶部岛显示“等待主窗口”；动作禁用 |
| 主窗口被销毁 | 顶部岛显示“主窗口已关闭”；点击唤起（重建）主窗 |
| 睡眠/唤醒 | 重新对时；不补弹过期提醒；快照重推 |
| 显示器拔插 | 回主屏；`setBounds` 夹取到工作区 |
| 高 DPI | 用 DIP 坐标；`screen` API 自动处理缩放 |
| 全屏应用 | P1：`hideOnFullscreen`；P0 只保证自身全屏 |
| 关闭顶部岛 | 销毁窗口；底部岛行为与 v1.12 完全一致 |

## 9. 验收

- [ ] 开关顶部岛：创建/销毁；无残留窗口/进程
- [ ] 收起/展开/提醒三态尺寸、内容、操作正确
- [ ] 5 条同分钟提醒：不丢、不重、逐条确认；8s 收起队列保留
- [ ] 主窗完成/改期/主题切换，顶部岛 100ms 内一致
- [ ] 顶部岛完成/推迟，主窗列表/统计/侧栏同帧更新
- [ ] `notifiedOn` 只由主窗轮询写入；顶部岛不误写
- [ ] 关闭顶部岛后，v1.12 回归全绿
- [ ] 1060×700：胶囊完整、不遮顶栏、不压最后一行
- [ ] 0 console error；无重复 IPC 监听

## 10. 实现顺序（与 06 任务表一致）

1. 主进程 IPC hub + preload API + 空窗口
2. 顶部岛 HTML/CSS/JS + 三态静态数据
3. 快照推送 + action 回传 + 幂等
4. 提醒归属 + 去重 + 队列
5. 设置 + 迁移 + 开关
6. 主窗定位/托盘/最小化/关闭
7. 边界/降级/QA
