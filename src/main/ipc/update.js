/* 域：应用更新（零运行时依赖）。
 * 清单优先 jsDelivr → raw → GitHub API 兜底；下载多源探测；SHA256 校验后静默安装。
 * 配置集中在 src/main/update-config.json（owner/repo 只改这一处）。
 */
'use strict';

const { app, ipcMain, BrowserWindow, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const core = require('./update-core');

const CONFIG_PATH = path.join(__dirname, '..', 'update-config.json');
const SCENARIO = String(process.env.TF_UPDATE_SCENARIO || '');
const SMOKE = process.argv.includes('--smoke');
const CACHE_FILE = 'tickflow-update-cache.json';
const USER_AGENT = 'TickFlow-Updater/1.0';

let config = core.normalizeConfig({});
let cache = {};
let lastResult = null;
let lastManifest = null;
let lastFileInfo = null;
let timer = null;
let hooks = {};
let state = {
  phase: 'idle',
  version: '',
  notes: '',
  message: '',
  code: '',
  progress: 0,
  current: '',
  releaseUrl: ''
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = core.normalizeConfig(raw);
  } catch (e) {
    config = core.normalizeConfig({});
  }
  return config;
}

function cachePath() {
  try { return path.join(app.getPath('userData'), CACHE_FILE); } catch (e) { return ''; }
}

function loadCache() {
  if (SCENARIO || SMOKE) { cache = {}; return cache; }
  try {
    const p = cachePath();
    cache = p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  } catch (e) { cache = {}; }
  return cache;
}

function saveCache() {
  if (SCENARIO || SMOKE) return;
  try {
    const p = cachePath();
    if (!p) return;
    fs.writeFileSync(p, JSON.stringify(cache), 'utf8');
  } catch (e) { /* 缓存失败不影响主流程 */ }
}

function broadcast(patch) {
  state = Object.assign({}, state, patch, { current: app.getVersion() });
  const snap = Object.assign({}, state);
  for (const w of BrowserWindow.getAllWindows()) {
    if (w && !w.isDestroyed()) {
      try { w.webContents.send('tf:update:status', snap); } catch (e) { }
    }
  }
  return snap;
}

function fail(code, message, extra) {
  const r = Object.assign({ ok: false, code, status: code, message }, extra || {});
  lastResult = r;
  broadcast({ phase: 'error', code, message, version: '', notes: '' });
  return r;
}

function timeoutSignal() {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(config.requestTimeoutMs) : undefined;
}

function headersObject(h) {
  const out = {};
  try {
    for (const [k, v] of h.entries()) out[k.toLowerCase()] = v;
  } catch (e) { }
  return out;
}

async function realFetchJson(url, etag) {
  const res = await net.fetch(url, {
    headers: Object.assign({ 'accept': 'application/json', 'user-agent': USER_AGENT },
      etag ? { 'if-none-match': etag } : {}),
    signal: timeoutSignal()
  });
  const headers = headersObject(res.headers);
  let json = null;
  try { json = await res.json(); } catch (e) { }
  return { status: res.status, headers, etag: res.headers.get('etag') || '', json };
}

async function realFetchText(url) {
  const res = await net.fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: timeoutSignal() });
  return { status: res.status, headers: headersObject(res.headers), text: await res.text().catch(() => '') };
}

/* ---------- 冒烟/单测用夹具（不触网） ---------- */
function mockManifest(version, sha) {
  return {
    version,
    minSupported: config.minSupported,
    publishedAt: '2026-11-21T00:00:00Z',
    notes: 'mock release',
    files: [{
      kind: 'nsis',
      name: 'TickFlow-Setup-' + version + '.exe',
      size: 7,
      sha256: sha,
      urls: ['https://example.invalid/TickFlow-Setup-' + version + '.exe']
    }]
  };
}

function nextVersion() {
  const v = String(app.getVersion()).split('.').map(Number);
  v[2] = (v[2] || 0) + 1;
  return v.join('.');
}

function mockFetchJson(url) {
  const cur = app.getVersion();
  if (SCENARIO === 'neterr') throw new Error('mock offline');
  if (SCENARIO === 'rate') {
    if (/api\.github\.com/.test(url)) return { status: 403, headers: { 'x-ratelimit-remaining': '0' }, json: null };
    return { status: 404, headers: {}, json: null };
  }
  if (SCENARIO === 'fallback' && /cdn\.jsdelivr/.test(url)) {
    return { status: 500, headers: {}, json: null };
  }
  const version = SCENARIO === 'latest' ? cur : nextVersion();
  const sha = SCENARIO === 'hash' ? '0'.repeat(64) : core.sha256Hex('MOCK-OK');
  return { status: 200, headers: {}, etag: 'W/"mock"', json: mockManifest(version, sha) };
}

async function fetchJson(url, etag) {
  return SCENARIO ? mockFetchJson(url, etag) : realFetchJson(url, etag);
}

async function fetchText(url) {
  if (SCENARIO) return { status: 200, text: core.sha256Hex('MOCK-OK') + '  ' + core.assetUrls(config, config.minSupported, '')[0] };
  return realFetchText(url);
}

/* ---------- 检查 ---------- */
async function fetchFromSources() {
  const attempts = [];
  const sources = core.manifestSources(config);
  for (const s of sources) {
    try {
      const cachedEtag = cache.etag && cache.etag[s.kind];
      const res = await fetchJson(s.url, cachedEtag);
      if (res.status === 304 && cache.manifest) {
        attempts.push({ source: s.kind, status: 'not-modified' });
        return { manifest: cache.manifest, source: s.kind, etag: cachedEtag, attempts };
      }
      if (core.classifyHttp(res.status, res.headers) !== 'ok') {
        attempts.push({ source: s.kind, status: core.classifyHttp(res.status, res.headers) });
        continue;
      }
      const v = core.validateManifest(res.json, config);
      if (!v.ok) { attempts.push({ source: s.kind, status: 'invalid', error: v.error }); continue; }
      attempts.push({ source: s.kind, status: 'ok' });
      return { manifest: v.manifest, source: s.kind, etag: res.etag || '', attempts };
    } catch (e) {
      attempts.push({ source: s.kind, status: 'network', error: String(e && e.message || e) });
    }
  }

  /* GitHub API 兜底 */
  try {
    const res = await fetchJson(core.apiUrl(config));
    if (core.classifyHttp(res.status, res.headers) === 'ok') {
      const mapped = core.manifestFromRelease(res.json, config);
      if (!mapped.ok) { attempts.push({ source: 'api', status: 'invalid', error: mapped.error }); }
      else if (mapped.mode === 'manifest') {
        const meta = await fetchJson(mapped.url);
        if (core.classifyHttp(meta.status, meta.headers) === 'ok') {
          const v = core.validateManifest(meta.json, config);
          if (v.ok) {
            attempts.push({ source: 'api', status: 'ok' });
            return { manifest: v.manifest, source: 'api', etag: '', attempts };
          }
          attempts.push({ source: 'api', status: 'invalid', error: v.error });
        } else {
          attempts.push({ source: 'api', status: core.classifyHttp(meta.status, meta.headers) });
        }
      } else {
        const file = mapped.file;
        if (mapped.sumsUrl) {
          const sums = await fetchText(mapped.sumsUrl);
          file.sha256 = core.parseSums(sums.text, file.name);
        }
        const v = core.validateManifest({ version: mapped.version, files: [file] }, config);
        if (v.ok) {
          attempts.push({ source: 'api', status: 'ok' });
          return { manifest: v.manifest, source: 'api', etag: '', attempts };
        }
        attempts.push({ source: 'api', status: 'invalid', error: v.error });
      }
    } else {
      attempts.push({ source: 'api', status: core.classifyHttp(res.status, res.headers) });
    }
  } catch (e) {
    attempts.push({ source: 'api', status: 'network', error: String(e && e.message || e) });
  }
  return { manifest: null, attempts };
}

async function check(opts) {
  const force = !!(opts && opts.force);
  loadConfig();
  if (core.isPlaceholder(config) && !SCENARIO) {
    return fail('UNCONFIGURED', '尚未配置更新仓库：请填写 src/main/update-config.json 的 owner / repo');
  }
  loadCache();
  const now = Date.now();
  if (!force && lastResult && lastResult.status === 'no-update') {
    return lastResult;
  }
  if (!force && cache.result && core.isCacheFresh(cache.lastCheck, now, config.checkIntervalHours)) {
    lastResult = cache.result;
    broadcast({ phase: lastResult.status === 'available' ? 'available' : 'idle',
      version: lastResult.version || '', notes: lastResult.notes || '',
      message: lastResult.status === 'available' ? '发现新版本 v' + lastResult.version : '已是最新版本'
    });
    return Object.assign({}, lastResult, { cached: true });
  }

  broadcast({ phase: 'checking', message: '正在检查更新…', code: '', progress: 0 });
  const got = await fetchFromSources();
  if (!got.manifest) {
    const rate = got.attempts.some((a) => a.status === 'rate-limit');
    if (rate) return fail('RATE_LIMIT', '更新源触发 GitHub 限流，请稍后再试', { attempts: got.attempts });
    return fail('NET_FAIL', '无法连接更新源（jsDelivr / raw / GitHub API 均失败）', { attempts: got.attempts });
  }

  const decided = core.decide(got.manifest, app.getVersion(), config);
  if (decided.status === 'blocked') {
    return fail('BLOCKED', decided.message, { manifest: got.manifest });
  }
  lastManifest = got.manifest;
  lastFileInfo = null;

  const result = {
    ok: true,
    status: decided.status === 'available' ? 'available' : 'no-update',
    version: got.manifest.version,
    notes: got.manifest.notes || '',
    source: got.source,
    releaseUrl: core.releasePageUrl(config, got.manifest.version),
    attempts: got.attempts
  };
  lastResult = result;
  cache = { lastCheck: now, etag: cache.etag || {}, manifest: got.manifest, result };
  if (got.etag) cache.etag[got.source] = got.etag;
  saveCache();
  broadcast({
    phase: result.status === 'available' ? 'available' : 'idle',
    version: result.version,
    notes: result.notes,
    releaseUrl: result.releaseUrl,
    message: result.status === 'available' ? '发现新版本 v' + result.version : '已是最新版本 v' + app.getVersion(),
    code: '', progress: 0
  });
  return result;
}

/* ---------- 下载 ---------- */
async function downloadTo(url, target, onProgress) {
  const res = await net.fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: timeoutSignal() });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { code: core.classifyHttp(res.status, headersObject(res.headers)) });
  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  const { createHash } = require('crypto');
  const h = createHash('sha256');
  const rs = Readable.fromWeb(res.body);
  await pipeline(rs, async function* (src) {
    for await (const chunk of src) {
      got += chunk.length;
      h.update(chunk);
      if (onProgress) onProgress(total ? got / total : 0, got, total);
      yield chunk;
    }
  }, fs.createWriteStream(target.path));
  return { bytes: got, sha256: h.digest('hex'), size: total };
}

async function download() {
  loadConfig();
  if (lastResult && lastResult.status !== 'available') return fail('NO_UPDATE', '当前没有可下载的新版本');
  if (!lastManifest) return fail('NO_MANIFEST', '请先检查更新');
  const v = core.validateManifest(lastManifest, config);
  if (!v.ok) return fail('MANIFEST_INVALID', v.error);
  const file = v.file;
  const dir = path.join(app.getPath('temp'), 'tickflow-update');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
  const target = { path: path.join(dir, file.name) };
  broadcast({ phase: 'downloading', message: '正在下载 v' + lastManifest.version, progress: 0, code: '' });

  let lastError = '';
  for (let i = 0; i < v.urls.length; i++) {
    const url = v.urls[i];
    try {
      let sha = '';
      let bytes = 0;
      if (SCENARIO) {
        fs.writeFileSync(target.path, 'MOCK-OK');
        bytes = 7; sha = core.sha256Hex('MOCK-OK');
        broadcast({ phase: 'downloading', message: '正在下载（模拟）', progress: 1 });
      } else {
        const r = await downloadTo(url, target, (p, got, total) => {
          broadcast({ phase: 'downloading', progress: Math.max(0, Math.min(1, p)),
            message: '正在下载 v' + lastManifest.version + (total ? ' · ' + Math.round(got / 1048576) + '/' + Math.round(total / 1048576) + ' MB' : '') });
        });
        bytes = r.bytes; sha = r.sha256;
      }
      const sizeOk = !file.size || Math.abs(bytes - file.size) <= 1;
      if (sizeOk && core.hashMatches(file.sha256, sha)) {
        lastFileInfo = { path: target.path, sha256: sha, size: bytes, name: file.name };
        const ok = { ok: true, status: 'downloaded', path: target.path, sha256: sha, size: bytes, version: lastManifest.version };
        lastResult = Object.assign({}, lastResult || {}, ok);
        broadcast({ phase: 'downloaded', progress: 1, message: '下载完成，已校验 SHA256',
          version: lastManifest.version, code: '' });
        return ok;
      }
      lastError = 'HASH_MISMATCH';
      try { fs.unlinkSync(target.path); } catch (e) { }
    } catch (e) {
      lastError = e && e.code === 'rate-limit' ? 'RATE_LIMIT' : (e && e.code) || 'DOWNLOAD_FAIL';
    }
  }
  if (lastFileInfo) lastFileInfo = null;
  if (lastError === 'HASH_MISMATCH') return fail('HASH_MISMATCH', '安装包 SHA256 校验失败，已丢弃下载文件，旧版本不受影响');
  if (lastError === 'RATE_LIMIT') return fail('RATE_LIMIT', '下载源触发限流，请稍后再试');
  return fail('DOWNLOAD_FAIL', '所有下载源均失败，请稍后重试或打开发布页手动下载');
}

/* ---------- 安装 ---------- */
async function install() {
  if (SMOKE) return fail('SMOKE', '冒烟模式禁止安装');
  if (!lastFileInfo) return fail('NO_FILE', '请先下载并校验更新');
  if (process.platform !== 'win32') return fail('UNSUPPORTED', '当前平台不支持自动安装');
  if (typeof hooks.beforeInstall === 'function') hooks.beforeInstall();
  broadcast({ phase: 'installing', message: '正在静默安装，应用即将退出…', progress: 1 });
  try {
    const child = spawn(lastFileInfo.path, ['/S', '--updated'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  } catch (e) {
    return fail('INSTALL_FAIL', '无法启动安装程序：' + String(e && e.message || e));
  }
  setTimeout(() => { try { app.quit(); } catch (e) { } }, 500);
  return { ok: true, status: 'installing', path: lastFileInfo.path };
}

function register() {
  ipcMain.handle('tf:update:check', (_e, arg) => check({ force: !!(arg && arg.force) }));
  ipcMain.handle('tf:update:download', () => download());
  ipcMain.handle('tf:update:install', () => install());
  ipcMain.handle('tf:update:state', () => Object.assign({}, state, { current: app.getVersion() }));
  ipcMain.handle('tf:update:open-release', () => {
    const url = state.releaseUrl || core.releasePageUrl(loadConfig());
    try { shell.openExternal(url); return { ok: true, url }; } catch (e) { return { ok: false, message: String(e) }; }
  });
}

function init(opts) {
  hooks = opts || {};
  loadConfig();
  loadCache();
  state = Object.assign({}, state, {
    current: app.getVersion(),
    configured: !core.isPlaceholder(config) || !!SCENARIO,
    releaseUrl: core.releasePageUrl(config)
  });
}

function startAutoCheck() {
  if (SMOKE) return;
  if (!app.isPackaged) return;
  if (core.isPlaceholder(config)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { check({ force: false }).catch(() => { }); }, 25000);
}

module.exports = { name: 'update', register, init, startAutoCheck, check, download, install };
