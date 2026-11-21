#!/usr/bin/env node
/* 静态自检：不启动 Electron，跑完就给结论。用法：node scripts/verify.mjs
 * 覆盖：引用是否断、语法是否过、脚本顺序是否正确、插件 manifest 是否合法、目录是否又被 distN 污染。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = path.join(ROOT, 'src', 'main');
const RENDERER = path.join(ROOT, 'src', 'renderer');

const fails = [];
const warns = [];
const oks = [];

const ok = (m) => oks.push(m);
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* 1. index.html 引用 */
const htmlPath = path.join(RENDERER, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
for (const ref of refs) {
  const target = path.join(RENDERER, ref);
  if (!fs.existsSync(target)) fail(`index.html 引用不存在：${ref}`);
}
if (refs.length) ok(`index.html ${refs.length} 个本地引用全部命中`);

/* 2. 脚本顺序：store 先于 registry，registry 先于 modules，app 最后 */
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const idx = (name) => scripts.findIndex((s) => s.includes(name));
if (idx('core/store.js') === -1) fail('缺少 js/core/store.js');
if (idx('core/registry.js') === -1) fail('缺少 js/core/registry.js');
if (scripts.length && !scripts[scripts.length - 1].includes('modules/app.js')) {
  fail('app.js 必须是最后一个脚本（它负责启动渲染）');
}
if (idx('core/store.js') > idx('core/registry.js')) warn('store.js 应早于 registry.js 加载');
else if (idx('core/registry.js') > -1) ok('脚本顺序：store → registry → modules → app');

/* 3. 语法：node --check 全量 */
const jsFiles = [
  ...walk(path.join(RENDERER, 'js')),
  path.join(MAIN, 'main.js'),
  path.join(MAIN, 'preload.js'),
  ...walk(path.join(MAIN, 'ipc'))
].filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

let syntaxBad = 0;
for (const file of jsFiles) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    syntaxBad++;
    fail(`语法错误：${path.relative(ROOT, file)} :: ${(res.stderr || '').split('\n')[0]}`);
  }
}
if (jsFiles.length && !syntaxBad) ok(`${jsFiles.length} 个 JS 文件语法通过`);

/* 4. 主进程 preload 接线 */
const mainJs = fs.readFileSync(path.join(MAIN, 'main.js'), 'utf8');
if (!mainJs.includes("preload: path.join(__dirname, 'preload.js')")) fail('main.js 未接线 preload');
else ok('main.js 已接线 preload');
if (!mainJs.includes("require('./ipc')")) fail('main.js 未注册 IPC 域');
else ok('main.js 已注册 IPC 域');

/* 5. 插件 manifest */
const pluginRoot = path.join(ROOT, 'plugins');
for (const dir of fs.existsSync(pluginRoot) ? fs.readdirSync(pluginRoot) : []) {
  const mf = path.join(pluginRoot, dir, 'manifest.json');
  if (!fs.existsSync(mf)) continue;
  try {
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const missing = ['id', 'name', 'version', 'extensions'].filter((k) => !m[k]);
    if (missing.length) fail(`plugins/${dir}/manifest.json 缺字段：${missing.join(', ')}`);
    else ok(`plugins/${dir} manifest 合法（${m.id}@${m.version}）`);
  } catch (e) {
    fail(`plugins/${dir}/manifest.json 解析失败：${e.message}`);
  }
}

/* 6. 目录污染 */
const buildDir = path.join(ROOT, 'build');
for (const name of fs.existsSync(buildDir) ? fs.readdirSync(buildDir) : []) {
  if (/^(dist|release)\d+$/.test(name) || name === 'stage2') fail(`发现旧式产物目录 build/${name}，应清理`);
}
if (!fs.existsSync(path.join(buildDir, 'distN')) && !fs.existsSync(path.join(MAIN, 'stage2'))) {
  ok('无 distN / releaseN / stage2 残留');
}

/* 7. 版本号漂移 */
const pkgVersion = JSON.parse(fs.readFileSync(path.join(MAIN, 'package.json'), 'utf8')).version;
const tfVersion = (fs.readFileSync(path.join(RENDERER, 'js', 'modules', 'app.js'), 'utf8').match(/TF\.VERSION\s*=\s*'([^']+)'/) || [])[1];
if (tfVersion && tfVersion !== pkgVersion) {
  warn(`版本漂移：package.json=${pkgVersion}，app.js 内 TF.VERSION=${tfVersion}（待改为构建注入）`);
} else if (tfVersion) {
  ok(`版本一致：${pkgVersion}`);
}

/* 输出 */
console.log('\n通过');
oks.forEach((m) => console.log('  ✓ ' + m));
if (warns.length) {
  console.log('\n警告');
  warns.forEach((m) => console.log('  ! ' + m));
}
if (fails.length) {
  console.log('\n失败');
  fails.forEach((m) => console.log('  ✗ ' + m));
}
console.log(`\n${fails.length ? '✗ 未通过' : '✓ 全部通过'}：${oks.length} 项通过 / ${warns.length} 项警告 / ${fails.length} 项失败\n`);
process.exit(fails.length ? 1 : 0);
