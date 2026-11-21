# 插件契约（v1 · 2026-11-17）

> 状态：契约定稿，**宿主只实现了扫描**。真正的注入执行排在 `50-backlog.md` 架构演进 P1，见本文 §4 阶段表。
> 现在写插件不算白写：manifest 与扩展点 API 已冻结，宿主补上执行器即可加载。

## 1 目录与安装位置

| 位置 | 用途 | 何时生效 |
|---|---|---|
| `%APPDATA%\TickFlow\plugins\<id>\` | 用户自装 | 用户手动放进去 |
| `<安装目录>\resources\plugins\<id>\` | 随包内置 | 首次启动 |
| `<仓库>\plugins\<dir>\`（开发期） | 本地调试 | `npm start` 时 |

目录名以 `_` 或 `.` 开头 = 跳过（`_example` 是契约示例，不加载）。

## 2 manifest.json

```json
{
  "id": "com.example.hello",
  "name": "示例插件 · Hello",
  "version": "0.1.0",
  "apiVersion": 1,
  "minAppVersion": "1.11.0",
  "author": "某人",
  "description": "一句话说明",
  "enabled": false,
  "permissions": ["commands"],
  "extensions": ["commands"],
  "entry": { "renderer": "renderer.js", "main": "main.js" }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✔ | 反向域名，全局唯一；数据 key 前缀用它 |
| `name` / `version` | ✔ | 展示名 / semver |
| `apiVersion` | ✔ | 插件 API 主版本，宿主不兼容就拒载（当前 `1`） |
| `extensions` | ✔ | 声明要用的扩展点，未声明的调用会被宿主拒绝 |
| `permissions` | — | 敏感能力：`fs` / `network` / `clipboard` / `notifications` |
| `minAppVersion` | — | 低于此版本不加载 |
| `enabled` | — | `false` 时不加载，方便先放进去再启用 |
| `entry.renderer` | — | 渲染层脚本，相对插件目录 |
| `entry.main` | — | 主进程脚本，导出 `register(ctx)` |

## 3 四个扩展点

| 扩展点 | 形态 | 已接线 |
|---|---|---|
| `commands` | `{k:'cmd', t:'标题', h:'快捷键', i:'图标', run()}` → 进命令面板 | **✔ 已接线**（`palette.js` 读 `TF.ext.list('commands')`） |
| `views` | `{id, title, icon, render(host)}` → 侧栏多一个视图 | ✘ 待接（palette 的 `VIEWS` 仍是常量数组） |
| `renderers` | `{id, match(task|node), render(el, item)}` → 替换任务行/节点渲染 | ✘ 待接（目前 `views.js` 直出） |
| `themes` | `{id, name, tokens:{--bg, --fg, ...}}` → 主题列表多一项 | ✘ 待接（`refresh.css` 的 token 是静态的） |

注册方式（渲染层）：

```js
TF.define('plugin:com.example.hello', {
  deps: [], // 核心模块 id 将在 P0 迁移时登记（core:store / core:bus），当前留空
  init() { TF.ext.contribute('commands', { k:'cmd', t:'…', i:'bolt', run(){ /* … */ } }); }
});
```

## 4 加载的四个阶段

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 扫描 | 主进程读三个 root 的 manifest，校验必填与 `apiVersion` | ✔ 已实现（`src/main/ipc/plugins.js`，`tfBridge.plugins()`） |
| 2 校验 | 权限与 `extensions` 白名单比对，非法项标红不下发 | ✘ |
| 3 注入 | 主进程把已启用插件清单给渲染层，按序 `<script>` 注入，出错隔离 | ✘ |
| 4 主进程侧 | `require(entry.main).register(ctx)`，只允许注册自己的频道 | ✘ |

## 5 硬约束

1. **不碰核心状态**：数据只能通过 `TF.Store` 公开方法读写，插件自有数据一律 `plugin:<id>:*` 前缀。
2. **不改全局 DOM 结构**：只能往扩展点挂，禁止 `document.body.innerHTML +=`。
3. **同步初始化 ≤ 16ms**：`init` 里做重活会让首屏掉帧，重活放 `setTimeout` 或按需触发。
4. **无网络默认**：`permissions` 不含 `network` 时，`fetch` 会被宿主 patch 掉。
5. **卸载可逆**：`unmount` 必须撤掉自己加的 DOM 与监听，否则宿主重载插件会叠加。
