# TickFlow 打包安装器与自动更新方案（可评审稿）

> 日期：2026-11-21 · 版本基线：1.13.0
> 范围：只做方案，不改代码。所有涉及代码的项都标了「我可以直接做」。
> 约束来源：`AGENTS.md` 第 4/5 条（零构建、不新增运行时依赖）、`docs/handoff/05-ARCHITECTURE.md`、`README.md` 打包说明。

---

## 0. 项目现状（方案的前提）

| 项 | 现状 | 对方案的影响 |
|---|---|---|
| 打包链 | `scripts/build.mjs`：stage → `electron-packager` → `electron-builder --prepackaged` | 已有 NSIS 能力，不需要从零写打包器 |
| 依赖 | `src/main/package.json` 已有 devDeps：`electron-builder`、`electron-packager` | 选型成本低；它们不进入运行时 |
| 产物 | `build/release/刻度-TickFlow-Setup-<ver>.exe`（中文文件名） | **更新下载 URL 会含中文，镜像/代理容易转码失败**，建议改 ASCII |
| 安装形态 | NSIS、non-oneClick、允许改安装目录、`perMachine:false` | 默认每用户安装，无 UAC |
| 用户数据 | Electron 默认 `%APPDATA%\TickFlow`，与安装目录分离 | 升级/卸载可天然保留数据 |
| 应用内更新 | 无 updater、无 `publish` 配置、无 `latest.yml`、无 SHA256 | 需要新增检查器与发布清单 |
| 仓库 | 当前工作区不是 GitHub 仓库（`git remote` 为空） | 仓库、tag、Release 是用户必须先建的外部条件 |
| 运行时依赖约束 | 渲染层/主进程只用 Electron 内置 + 现有代码 | `electron-updater` 属于**运行时依赖**，需要破例；自写检查器不需要 |

> 关键判断：**打包工具（electron-builder）是 devDependency，不违反「不新增运行时依赖」；自动更新器若用 electron-updater 则是运行时依赖，需要显式破例。**

---

## 1. 打包选型对比与推荐

| 方案 | 对这个项目的成本 | 产物形态 | 差分更新 | 是否破坏零运行时依赖 | 结论 |
|---|---|---|---|---|---|
| **electron-builder（现成）** | 最低：配置已存在，只需补 ASCII 产物名、`publish`/清单、签名配置 | NSIS 单文件 Setup.exe；可选 portable/zip | NSIS + `.blockmap` 可做，但**只有 electron-updater 能消费** | 本身不破坏（devDep）；配 electron-updater 才破坏 | **推荐** |
| electron-forge | 高：要新增 `@electron-forge/cli`、maker、publisher 一整套；Squirrel.Windows 产物与现有 NSIS 流程不一致；Windows 上还要维护 `rcedit`/签名链 | Squirrel 安装器或 MSIX | Squirrel 有增量，但生态与现有脚本不匹配 | 不破坏运行时，但 dev 依赖面变大 | 不推荐（重复造轮子） |
| 原生 NSIS + 手写脚本 | 最高：自己写 `.nsi`、快捷方式、卸载、静默升级、签名、版本资源；还要在 CI/本机装 makensis | 完全自定义 | 不做差分就得整包 | 不破坏（makensis 是构建工具） | 不推荐（electron-builder 已在封装 NSIS） |

**推荐：继续用 electron-builder，不换 forge、不手写 NSIS。** 现有 `appId=com.guiji0.tickflow`、`productName=TickFlow`、`icon.ico` 已具备；主要缺口是「更新清单 + 检查器 + 发布脚本」，不是打包器。

需要顺手修正的两个现实问题：

1. `artifactName` 改成 ASCII：`TickFlow-Setup-${version}.exe`。中文名在 GitHub Release 直链、ghproxy、对象存储 URL 编码上都容易出问题。
2. 构建后生成 `SHA256SUMS.txt` 与 `latest.json`，否则无法做完整性校验与更新。

---

## 2. 安装器形态建议

| 决策点 | 建议 | 说明 |
|---|---|---|
| NSIS 单文件 vs 便携 zip | **NSIS 单文件为主**，便携 zip 只在有人明确需要时额外出 | 安装器可写快捷方式、卸载、静默升级；便携 zip 无法可靠自更新 |
| 安装目录 | `%LOCALAPPDATA%\Programs\TickFlow`（per-user，默认） | 不需要管理员权限；允许用户改目录 |
| 用户数据 | 保留 Electron 默认 `%APPDATA%\TickFlow`，**不放进安装目录** | 升级、卸载、换安装目录都不动数据 |
| 卸载是否删数据 | **默认保留数据**；卸载器只删程序目录 | 任务、愿望、配置都在 localStorage；误删代价高 |
| 开始菜单 | 创建（`TickFlow`） | 默认开启 |
| 桌面快捷方式 | 创建 | 默认开启，允许用户取消 |
| 开机自启 | **默认关闭，设置里可选** | 用 `app.setLoginItemSettings({ openAtLogin })`；不要安装时强开 |
| 升级方式 | 下载新版 Setup.exe → 静默 `/S` 安装 → 退出旧进程 | 安装器必须能在旧进程退出后替换 `TickFlow.exe`；实现时先 `quitting=true` 再 `app.quit()`，由安装器等待/接管 |

> 差分更新只对「同一个安装器体系」有意义。自写检查器走整包下载；如果以后改用 electron-updater，再启用 `.blockmap` 差分。

---

## 3. 自动更新机制对比与推荐

| 维度 | electron-updater（GitHub provider） | 自写检查器（Electron `net` + JSON 清单） |
|---|---|---|
| 新增依赖 | **运行时依赖**（要进 asar/安装包） | 0；`net`、`crypto`、`fs`、`child_process` 都是内置 |
| 差分 | 支持 NSIS `.blockmap`，省流量 | 不支持，整包下载 |
| 签名校验 | 支持 Windows 代码签名校验（需配置 publisherName；无证书时价值有限） | 自己做 SHA256（可选 Ed25519 清单签名），不依赖证书 |
| GitHub 适配 | 官方 provider，读 Releases/latest.yml | 自己读 `latest.json`，可放 Release 资产 / raw / jsDelivr |
| 国内多源 | 可改 `setFeedURL`，但主要是单一 feed；镜像要额外代理 | **原生支持多 URL 顺序探测与失败降级**，最适合大陆网络 |
| 安装接管 | `quitAndInstall()` 已处理大部分边界 | 自己控制：下载 → 校验 → `/S` 安装 → 退出，需实测 NSIS 替换时序 |
| 维护成本 | 低（官方库） | 中（一个主进程模块 + 清单生成脚本 + 单测） |
| 规则冲突 | 违反第 8 条，需要用户批准破例 | 符合零运行时依赖 |

**推荐：自写检查器（方案 B）。** 理由：

1. 项目明确「不新增运行时依赖」，而更新只需 HTTP + 文件校验 + 调安装器，Electron 内置足够。
2. 大陆可达性要求「多下载源顺序探测/失败降级」，自写器天然可控；electron-updater 的多源需要绕 feed，反而更复杂。
3. 没有代码签名时，electron-updater 的签名校验优势发挥不出来；SHA256 + 可选清单签名已能挡住传输损坏/简单篡改。
4. 代价：整包下载（预计数十 MB 量级，以实际构建为准）、需要自己处理安装器接管；可通过「只在用户确认后下载」和后续可选的差分方案缓解。

如果用户更看重「官方维护 + 差分 + 自动安装」，则选 electron-updater，但需要明确批准新增一个运行时依赖，并在 `publish` 中配置 GitHub provider。

### 推荐的自写更新协议（实现细节）

- 主进程新增 `src/main/ipc/update.js` + `preload.js` 白名单：`update.check()`、`update.download()`、`update.install()`、`update.onStatus()`。
- 清单 `latest.json`（随仓库或 Release 资产发布）：

```json
{
  "version": "1.13.1",
  "minSupported": "1.12.0",
  "publishedAt": "2026-11-24T10:00:00Z",
  "notes": "修复…",
  "files": [{
    "kind": "nsis",
    "name": "TickFlow-Setup-1.13.1.exe",
    "size": 0,
    "sha256": "…",
    "urls": [
      "https://github.com/si-zero-0/tickflow/releases/download/v1.13.1/TickFlow-Setup-1.13.1.exe",
      "https://gh-proxy.com/https://github.com/si-zero-0/tickflow/releases/download/v1.13.1/TickFlow-Setup-1.13.1.exe",
      "https://cdn.example.com/tickflow/TickFlow-Setup-1.13.1.exe"
    ]
  }]
}
```

- 检查：`app.getVersion()` 与清单 `version` 做 semver 比较，只允许「远端更高」；`minSupported` 用于提示跨度太大需手动安装。
- 清单获取顺序：jsDelivr（`cdn.jsdelivr.net/gh/si-zero-0/tickflow@main/update/latest.json`，国内快、非 API）→ raw.githubusercontent → GitHub API `releases/latest`（兜底，带 ETag 缓存）。
- 下载顺序：清单 `urls` 顺序 HEAD/Range 探测（2–3s 超时），失败换下一个；全部失败给「打开发布页」按钮。
- 校验：下载到 `%TEMP%\tickflow-update\`，校验大小与 SHA256，不匹配删除重试。
- 安装：用户确认后 `quitting=true`，`app.quit()`，再启动 `Setup.exe /S`（或 electron-builder 支持的更新参数）；启动器退出后安装器替换文件。
- 检查频率：启动后延迟 30–60s 检查一次；之后每 24h（带随机抖动）；「关于」页提供手动检查。只把结果缓存到内存/Store 的非敏感字段，不写新业务数据。
- 降级/安全：HTTPS-only；拒绝低于当前版本的清单；URL 主机白名单；可选 Ed25519 清单签名（公钥内置在主进程）。

---

## 4. 国内可达性方案

**原则：一套包、多个来源、同一 SHA256；不维护「国内版 / 国际版」两份产物。**

| 层级 | 方案 | 说明 |
|---|---|---|
| 清单 | 仓库内 `update/latest.json` + jsDelivr CDN | `cdn.jsdelivr.net/gh/si-zero-0/tickflow@main/update/latest.json`；国内可达、无 API 限流、可缓存 |
| 清单兜底 | `raw.githubusercontent.com`、GitHub API | raw 也常被干扰；API 仅作最后兜底 |
| 安装包主源 | GitHub Releases 资产直链 | 下载资产本身不走 API 配额 |
| 安装包镜像 | ghproxy 类前缀（gh-proxy.com 等） | 同一 URL 加前缀；需在发布后实测可用性，不写死单一镜像 |
| 安装包加速（可选） | 阿里云 OSS / 腾讯云 COS / Cloudflare R2 直链 | 只存同一个 exe；成本低；适合大陆长期分发 |
| 不做的事 | jsDelivr 传 exe | jsDelivr 有单文件体积上限，不能当安装包 CDN |

**GitHub API 限流规避：**

1. 日常检查 **不调 api.github.com**，优先 jsDelivr/raw 的静态清单；API 仅作兜底。
2. 清单一载缓存：ETag/If-None-Match + 24h TTL；启动后延迟检查，避免每次开窗请求。
3. 下载用 Release 资产直链或镜像，不用 API 的 `assets` 接口。
4. 若仓库转私有，才需要 token；**不要把 token 放进客户端**，发布凭据只留在本机/CI Secret。
5. 可选：发布时把 `latest.json` 同时作为 Release 资产，CDN 拉不到时可直接从 Release 下载。

---

## 5. 发布流程

**版本约定**：语义化版本 `1.13.1`；Git tag `v1.13.1`；`package.json`、`src/main/package.json`、`TF.VERSION`、`latest.json` 四处一致（`verify.mjs` 已检查前三处，需把清单纳入检查）。

**本地发布（最小流程）**：

```text
1) 改版本 + CHANGELOG
2) npm run verify && npm test
3) node scripts/build.mjs
4) 生成 SHA256SUMS.txt 与 update/latest.json（新增脚本）
5) gh release create v1.13.1 build/release/TickFlow-Setup-1.13.1.exe \
     build/release/SHA256SUMS.txt --notes-file CHANGELOG.md
6) 提交 update/latest.json（或作为 Release 资产上传）
```

**CI（可选，仓库建好后）**：GitHub Actions `windows-latest`，tag 触发，跑 verify/test/build，`softprops/action-gh-release` 上传产物 + 清单；签名证书/Trusted Signing 凭据放 Secrets。

**产物清单**：

- `TickFlow-Setup-<ver>.exe`
- `SHA256SUMS.txt`
- `update/latest.json`
- （可选）`.blockmap`：只有改用 electron-updater 才需要

**回滚**：

- 保留上一版 Setup.exe 与清单；把 `latest.json` 指回上一版，或把旧 Release 重新标记 latest。
- 客户端只升不降；需要回滚时发一个「版本号更高、内容为回滚」的修复版，或让用户手动装旧包。
- 数据结构必须向后兼容（本项目目前无 schema 版本号，升级前先加迁移测试）。

---

## 6. 代码签名与 SmartScreen

| 项 | 现实情况 | 建议 |
|---|---|---|
| 不签名 | 安装时出现「未知发布者 / Windows 已保护你的电脑」，需「更多信息 → 仍要运行」；下载信誉积累慢；企业环境可能直接拦截 | 内测/小范围可先不签；公开分发前尽量签 |
| OV 代码签名证书 | 约 200–400 美元/年，需企业/个人身份审核；私钥常在硬件令牌或云 HSM，CI 需接入 | 推荐作为公开分发的最低配置 |
| EV 证书 | 约 300–600 美元/年 + 硬件令牌，SmartScreen 信誉更快但仍非即时 | 预算允许再上 |
| Azure Trusted Signing | 约 10 美元/月起，需组织验证；与 CI 集成简单 | 若已有 Azure 组织，优先评估 |
| 无证书时的更新校验 | 只能靠 HTTPS + SHA256（可选清单签名）；无法证明发布者身份 | 自写检查器按此设计；electron-updater 的 publisherName 校验在无证书时无意义 |

**可以先生不签**：安装器与更新流程先跑通，再补证书；证书只影响信任提示与签名校验，不影响功能。但对外宣传前建议完成签名。

---

## 7. 你需要亲自做的事

### 必须由你决定 / 提供

| # | 事项 | 说明 |
|---|---|---|
| 1 | GitHub 仓库 | 所有者、仓库名、公开/私有；当前工作区没有 remote，需要你建库并推送 |
| 2 | 发布凭据 | 本机 `gh auth login` 或 CI Secret（`GITHUB_TOKEN`，仅发布用，**不进客户端**） |
| 3 | 是否买证书 | 先不签 / OV / EV / Azure Trusted Signing；涉及付款与身份材料 |
| 4 | 品牌资源 | 最终 `icon.ico`（建议含 16–256 多尺寸）、显示名、安装器文件名偏好 |
| 5 | 发布节奏 | 手动发布还是 tag 触发 CI；是否设 beta 通道 |
| 6 | 安装选项 | 开机自启默认值、桌面快捷方式默认值、卸载是否提供「同时删除数据」 |
| 7 | 镜像 | 是否现在就上对象存储（OSS/COS/R2）；不上则先用 GitHub + ghproxy + jsDelivr |

### 我可以直接做（无需你提供账号）

| # | 事项 |
|---|---|
| 1 | 把安装器产物名改 ASCII，修 `build.mjs` 的发布后处理（SHA256、`latest.json`） |
| 2 | 新增主进程 `ipc/update.js` + `preload.js` 白名单 + 自写检查/下载/安装逻辑（零新运行时依赖） |
| 3 | 「关于」页加「检查更新」入口与状态提示；启动后延迟检查 + 24h 缓存 |
| 4 | 多源顺序探测、SHA256 校验、临时目录清理、失败提示 |
| 5 | 更新单测（版本比较、清单校验、URL 白名单、降级拒绝）与 smoke 场景 |
| 6 | 若你建好仓库：编写 GitHub Actions 发布工作流与 `gh release` 脚本 |
| 7 | 开机自启开关（若你确认默认关闭）与 NSIS 配置微调 |

---

## 8. 推荐的最小可行路线（MVP）

**目标：1.13.1 起可自动检查/下载/安装更新，零新增运行时依赖，不买证书也能用。**

1. **你**：建公开 GitHub 仓库（如 `si-zero-0/tickflow`）并推送；决定证书暂缓、镜像暂缓。
2. **我**：改 ASCII 产物名；新增 `scripts/release.mjs`（生成 SHA256 + `latest.json`）；新增 `update.js` 检查器（jsDelivr 清单 → raw → GitHub API；下载 GitHub 直链 → ghproxy → 可选对象存储；SHA256 校验；`/S` 安装后退出）；preload/IPC 白名单；「关于」页入口；单测 + smoke。
3. **你**：发第一个 Release（`v1.13.1`），把 `latest.json` 提交到 `update/` 或作为 Release 资产。
4. **我**：从 1.13.0 实测升级到 1.13.1（含断网/镜像失败/哈希不符/已是最新四条路径），记录到 `IMPLEMENTATION-NOTES.md`。
5. **后续**：有预算再买 OV/Azure 签名；大陆反馈慢再上对象存储；需要省流量再评估 electron-updater 差分（届时需你批准运行时依赖）。

**预计外部成本**：GitHub 公共仓库 0；对象存储可选（每月几元到几十元）；证书 0（暂缓）或 200–600 美元/年。

---

## 9. 验收清单（方案落地时逐条打勾）

- [ ] `verify` / `test` / `stage` 全绿，版本四处一致
- [ ] 安装到 `%LOCALAPPDATA%\Programs\TickFlow`，数据在 `%APPDATA%\TickFlow`
- [ ] 卸载保留数据；重装后任务/愿望/外观仍在
- [ ] 开始菜单 + 桌面快捷方式；开机自启默认关闭且可切换
- [ ] 1.13.0 → 1.13.1 静默升级成功，旧进程退出、数据不丢
- [ ] 清单三源探测：jsDelivr / raw / GitHub API，任一失败可降级
- [ ] 安装包三源探测：GitHub / ghproxy / 可选对象存储，SHA256 全部一致
- [ ] 断网、限流（403/429）、哈希不符、已是最新：均有明确提示且不崩溃
- [ ] API 限流场景下不阻断启动与主功能
- [ ] 签名后 SmartScreen 发布者名称正确（若已购证书）
