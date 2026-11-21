# TickFlow 开发说明

面向想改代码或自己构建安装包的人。README 只保留访客需要的内容。

## 技术栈

- Electron 主进程 + 原生 HTML / CSS / JS 渲染层。
- 无前端框架、无构建器、无后端。
- 数据存在渲染层 localStorage，主进程只负责窗口、托盘、快捷键、协议、更新。
- 不新增运行时依赖；系统能力统一走 `preload.js` 白名单。

## 目录

```text
src/main/        Electron 主进程、preload、ipc、打包配置
src/renderer/    渲染层：index.html、css/、js/core/、js/modules/、assets/
plugins/         插件示例（_ 开头不加载）
scripts/         build.mjs（构建/打包）、verify.mjs（静态自检）、release.mjs（发布清单）
tests/           Node 单测
docs/            开发与交接文档
```

## 边界

- 渲染层不 `require`；系统能力走 `window.tfBridge`。
- 模块之间通过 `TF.bus`、`TF.ext`、`TF.Store` 通信。
- 只有主窗口持有 `TF.Store`；不再有独立岛窗口。
- 颜色只用 token；动效只动 `transform / opacity / color / border-color / box-shadow`。

## 本地开发

```powershell
npm --prefix src/main i      # 首次安装 Electron 依赖
npm --prefix src/main start  # 开发启动（需要已有 stage/www）
npm run stage                # 同步 src/main/stage
cd src/main
npx electron stage           # 启动 stage 版本
```

只改渲染层时，同步 stage 后刷新窗口即可。

## 自检

```powershell
npm run verify   # 引用、语法、脚本顺序、版本一致性
npm test         # node --test
```

## 构建安装包

```powershell
npm run build
```

产物：

- `build/release/TickFlow-Setup-<version>.exe`（NSIS，每用户安装，无需管理员权限）
- `build/release/SHA256SUMS.txt`
- `build/release/TickFlow-Setup-<version>.exe.blockmap`

安装目录默认 `%LOCALAPPDATA%\Programs\TickFlow`，用户数据在 `%APPDATA%\TickFlow`，卸载保留数据。

## 发布

1. 同步修改 `package.json`、`src/main/package.json`、`TF.VERSION` 三处版本号。
2. 运行 `npm run verify && npm test && npm run build`。
3. 生成清单：

```powershell
node scripts/release.mjs --tag=v1.13.1
```

会生成 `update/latest.json` 和 `SHA256SUMS.txt`，并校验 tag 与版本一致。

4. 提交 `update/latest.json` 到 `main`，推送 tag，创建 GitHub Release，上传 exe、SHA256SUMS、latest.json。
5. `.github/workflows/release.yml` 在推送 `v*` tag 时会自动构建并创建 Release；手动发布时先停用它，避免重复创建。

## 自动更新

- 更新配置集中在 `src/main/update-config.json`：`owner`、`repo`、清单路径、镜像前缀。
- 清单源顺序：jsDelivr → raw.githubusercontent → GitHub API 兜底。
- 安装包下载顺序：GitHub Release 直链 → ghproxy 前缀 → 可选对象存储。
- 下载后校验 SHA256；失败删除文件，旧版本不受影响。
- 检查结果缓存 24 小时；启动后延迟检查，不阻塞主流程。
- 入口：设置 → 关于 → 更新。

## 数据与隐私

没有账号、云端同步和统计上报。只有检查更新与下载安装包会访问网络，地址由 `update-config.json` 决定。
