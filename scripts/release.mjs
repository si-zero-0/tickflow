#!/usr/bin/env node
/* 发布清单脚本（本地与 GitHub Actions 通用）：
 *   node scripts/release.mjs                 # 生成 build/release/SHA256SUMS.txt 与 update/latest.json
 *   node scripts/release.mjs --tag=v1.13.3   # 额外校验 tag 与版本一致
 *   node scripts/release.mjs --check         # 只做版本/tag/产物检查，不写文件
 *
 * 只读构建产物；不创建仓库、不推送、不发 Release。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = path.join(ROOT, 'src', 'main');
const RELEASE = path.join(ROOT, 'build', 'release');
const UPDATE_DIR = path.join(ROOT, 'update');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const tagArg = (args.find((a) => a.startsWith('--tag=')) || '').slice(6);
const envTag = String(process.env.GITHUB_REF_NAME || '');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}
function fail(msg) { console.error('\n✗ ' + msg); process.exit(1); }
function trimSlash(s) { return String(s || '').replace(/\/+$/, ''); }

/* ---------- 1. 版本一致性 ---------- */
const rootPkg = readJson(path.join(ROOT, 'package.json'));
const mainPkg = readJson(path.join(MAIN, 'package.json'));
const appJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'js', 'modules', 'app.js'), 'utf8');
const tfVer = (appJs.match(/TF\.VERSION = '([^']+)'/) || [])[1];
const version = rootPkg.version;

if (mainPkg.version !== version) fail(`版本漂移：根 package.json=${version}，src/main/package.json=${mainPkg.version}`);
if (tfVer !== version) fail(`版本漂移：TF.VERSION=${tfVer}，package.json=${version}`);

const tag = tagArg || envTag;
if (tag && tag !== 'v' + version) fail(`tag 与版本不一致：tag=${tag}，期望 v${version}`);
console.log(`✓ 版本一致：${version}${tag ? ' · tag ' + tag : '（未提供 tag，跳过 tag 校验）'}`);

/* ---------- 2. 配置与产物 ---------- */
const cfg = readJson(path.join(MAIN, 'update-config.json'));
const owner = String(cfg.owner || '');
const repo = String(cfg.repo || '');
if (/^OWNER/i.test(owner) || /^REPO/i.test(repo)) {
  console.log('! owner/repo 仍是占位：生成的 manifest URL 为占位地址；拿到仓库后只改 src/main/update-config.json');
}

const exeName = `TickFlow-Setup-${version}.exe`;
const exePath = path.join(RELEASE, exeName);
if (!fs.existsSync(exePath)) {
  if (checkOnly) {
    console.log(`! 未找到 ${path.relative(ROOT, exePath)}（--check 模式允许缺失）`);
  } else {
    fail(`未找到安装包 ${path.relative(ROOT, exePath)}，先跑 node scripts/build.mjs`);
  }
}

/* ---------- 3. SHA256 与清单 ---------- */
let sha = '0'.repeat(64);
let size = 0;
if (fs.existsSync(exePath)) {
  sha = await sha256File(exePath);
  size = fs.statSync(exePath).size;
  if (!checkOnly) {
    fs.writeFileSync(path.join(RELEASE, 'SHA256SUMS.txt'), `${sha}  ${exeName}\n`, 'utf8');
    console.log(`✓ SHA256SUMS.txt → ${sha.slice(0, 12)}…`);
  }
}

const gh = `https://github.com/${owner}/${repo}/releases/download/v${version}/${exeName}`;
const urls = [gh];
if (cfg.ghProxy) urls.push(trimSlash(cfg.ghProxy) + '/' + gh);
if (cfg.cdnBase) urls.push(trimSlash(cfg.cdnBase) + '/' + exeName);

const manifest = {
  version,
  minSupported: String(cfg.minSupported || '1.12.0'),
  publishedAt: new Date().toISOString(),
  notes: String(process.env.TF_RELEASE_NOTES || ''),
  files: [{
    kind: 'nsis',
    name: exeName,
    size,
    sha256: sha,
    urls
  }]
};

if (!checkOnly) {
  fs.mkdirSync(UPDATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPDATE_DIR, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✓ update/latest.json → v${version} · ${(size / 1048576).toFixed(1)} MB · ${urls.length} 个下载源`);
}

console.log(`
下一步（你确认后再做）：
  git tag v${version} && git push origin v${version}
  gh release create v${version} build/release/${exeName} build/release/SHA256SUMS.txt update/latest.json --generate-notes
`);
