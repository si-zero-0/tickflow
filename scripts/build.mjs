#!/usr/bin/env node
/* 唯一打包入口。用法：
 *   node scripts/build.mjs --stage-only   只同步 stage（开发期快速校验，秒级）
 *   node scripts/build.mjs                完整打包 → build/dist + build/release
 *   node scripts/build.mjs --skip-packager  复用已有 build/dist，只重出安装包
 *
 * 三条硬规则：stage 每次强制重建；build/dist 与 build/release 只留最新一份；不产出 portable。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = path.join(ROOT, 'src', 'main');
const RENDERER = path.join(ROOT, 'src', 'renderer');
const STAGE = path.join(MAIN, 'stage');
const DIST = path.join(ROOT, 'build', 'dist');
const RELEASE = path.join(ROOT, 'build', 'release');

const args = process.argv.slice(2);
const stageOnly = args.includes('--stage-only');
const skipPackager = args.includes('--skip-packager');

const pkg = JSON.parse(fs.readFileSync(path.join(MAIN, 'package.json'), 'utf8'));
const version = pkg.version;

function step(msg) { console.log('\n▸ ' + msg); }

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function run(cmd, cmdArgs, cwd) {
  const res = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) {
    console.error(`\n✗ 失败：${cmd} ${cmdArgs.join(' ')}（exit ${res.status}）`);
    process.exit(res.status || 1);
  }
}

/* ---------- 1. 重建 stage ---------- */
step(`同步源码到 stage（版本 ${version}）`);
rmrf(STAGE);
fs.mkdirSync(path.join(STAGE, 'www'), { recursive: true });

fs.copyFileSync(path.join(RENDERER, 'index.html'), path.join(STAGE, 'www', 'index.html'));
for (const dir of ['css', 'js', 'assets', 'data']) {
  const src = path.join(RENDERER, dir);
  if (fs.existsSync(src)) copyDir(src, path.join(STAGE, 'www', dir));
}
/* M3：顶部岛是独立 html（不经过主窗 index.html），需单独复制 */
const islandHtml = path.join(RENDERER, 'top-island.html');
if (fs.existsSync(islandHtml)) fs.copyFileSync(islandHtml, path.join(STAGE, 'www', 'top-island.html'));

fs.copyFileSync(path.join(MAIN, 'main.js'), path.join(STAGE, 'main.js'));
fs.copyFileSync(path.join(MAIN, 'preload.js'), path.join(STAGE, 'preload.js'));
const islandPreload = path.join(MAIN, 'preload-island.js');
if (fs.existsSync(islandPreload)) fs.copyFileSync(islandPreload, path.join(STAGE, 'preload-island.js'));
fs.copyFileSync(path.join(MAIN, 'package.json'), path.join(STAGE, 'package.json'));
/* 更新源集中配置：owner/repo 只改 src/main/update-config.json，stage 一起带上 */
const updateConfig = path.join(MAIN, 'update-config.json');
if (fs.existsSync(updateConfig)) fs.copyFileSync(updateConfig, path.join(STAGE, 'update-config.json'));
copyDir(path.join(MAIN, 'ipc'), path.join(STAGE, 'ipc'));

/* 版本号注入：app.js 里的 TF.VERSION 一律以 package.json 为准，避免两处漂移 */
const appJsPath = path.join(STAGE, 'www', 'js', 'modules', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const VERSION_RE = /TF\.VERSION = '[^']*';/;
if (VERSION_RE.test(appJs)) {
  const stamped = appJs.replace(VERSION_RE, `TF.VERSION = '${version}';`);
  if (stamped !== appJs) fs.writeFileSync(appJsPath, stamped, 'utf8');
  console.log(`  TF.VERSION → ${version}`);
} else {
  console.warn('  ! app.js 未找到 TF.VERSION 赋值，跳过版本注入');
}

const stagedFiles = [];
(function walk(p) {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) walk(full);
    else stagedFiles.push(path.relative(STAGE, full));
  }
})(STAGE);
console.log(`  ${stagedFiles.length} 个文件已就位（www 副本每次重拷，避免打进旧代码）`);

if (stageOnly) {
  console.log('\n✓ stage 完成（未打包）。检查后跑 node scripts/build.mjs');
  process.exit(0);
}

/* ---------- 2. packager ---------- */
if (!skipPackager) {
  step('electron-packager → build/dist');
  rmrf(DIST);
  run(process.execPath, [
    path.join(MAIN, 'node_modules', '@electron', 'packager', 'bin', 'electron-packager.js'),
    STAGE, 'TickFlow',
    '--platform=win32', '--arch=x64',
    '--icon=' + path.join(MAIN, 'build', 'icon.ico'),
    '--out=' + DIST,
    '--asar',
    '--app-version=' + version,
    '--overwrite'
  ], MAIN);
}

/* ---------- 3. builder ---------- */
step('electron-builder → build/release');
rmrf(RELEASE);
run(process.execPath, [
  path.join(MAIN, 'node_modules', 'electron-builder', 'cli.js'),
  '--prepackaged', path.join(DIST, 'TickFlow-win32-x64'),
  '--win', 'nsis',
  '--config.directories.output=' + RELEASE
], MAIN);

/* ---------- 4. 汇总 + SHA256 ---------- */
step('产物');
const hashes = [];
for (const f of fs.readdirSync(RELEASE)) {
  const full = path.join(RELEASE, f);
  if (!fs.statSync(full).isFile()) continue;
  const size = fs.statSync(full).size;
  console.log(`  ${f}  ${(size / 1048576).toFixed(1)} MB`);
  if (/\.exe$/i.test(f)) {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256');
    await new Promise((resolve, reject) => {
      fs.createReadStream(full)
        .on('data', (c) => hash.update(c))
        .on('error', reject)
        .on('end', resolve);
    });
    hashes.push(`${hash.digest('hex')}  ${f}`);
  }
}
if (hashes.length) {
  fs.writeFileSync(path.join(RELEASE, 'SHA256SUMS.txt'), hashes.join('\n') + '\n', 'utf8');
  console.log('  SHA256SUMS.txt（' + hashes.length + ' 个安装包）');
}
console.log(`
下一步（发布清单，本地或 CI 均可）：
  node scripts/release.mjs --tag=v${version}
下一步（冒烟）：
  "${path.join(RELEASE, `TickFlow-Setup-${version}.exe`)}" /S
  "%LOCALAPPDATA%\\Programs\\TickFlow\\TickFlow.exe" --smoke
  检查 %TEMP%\\tickflow-smoke.json 的 consoleErrors 为空数组
`);
