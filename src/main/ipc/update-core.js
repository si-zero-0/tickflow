/* 更新器纯逻辑：不 require electron，单测可直接跑。
 * 负责配置归一、版本比较、清单校验、多源地址、缓存新鲜度、错误分类。
 */
'use strict';

const crypto = require('node:crypto');

const DEFAULT_CONFIG = {
  owner: 'OWNER_PLACEHOLDER',
  repo: 'REPO_PLACEHOLDER',
  branch: 'main',
  manifestPath: 'update/latest.json',
  minSupported: '1.12.0',
  checkIntervalHours: 24,
  requestTimeoutMs: 8000,
  ghProxy: 'https://gh-proxy.com/',
  cdnBase: ''
};

function trimSlash(s) { return String(s || '').replace(/\/+$/, ''); }

function normalizeConfig(raw) {
  const c = Object.assign({}, DEFAULT_CONFIG, raw || {});
  c.owner = String(c.owner || '').trim();
  c.repo = String(c.repo || '').trim();
  c.branch = String(c.branch || 'main').trim();
  c.manifestPath = String(c.manifestPath || 'update/latest.json').replace(/^\/+/, '');
  c.minSupported = String(c.minSupported || '1.12.0');
  c.checkIntervalHours = Math.max(1, Math.min(168, Number(c.checkIntervalHours) || 24));
  c.requestTimeoutMs = Math.max(2000, Math.min(30000, Number(c.requestTimeoutMs) || 8000));
  c.ghProxy = trimSlash(c.ghProxy);
  c.cdnBase = trimSlash(c.cdnBase);
  return c;
}

function isPlaceholder(config) {
  return !config || /^OWNER/i.test(config.owner || '') || /^REPO/i.test(config.repo || '');
}

function repoUrl(config) {
  return 'https://github.com/' + config.owner + '/' + config.repo;
}

function releasePageUrl(config, version) {
  return repoUrl(config) + (version ? '/releases/tag/v' + version : '/releases');
}

function manifestSources(config) {
  const mp = trimSlash(config.manifestPath);
  const out = [
    {
      kind: 'jsdelivr',
      url: 'https://cdn.jsdelivr.net/gh/' + config.owner + '/' + config.repo + '@' + config.branch + '/' + mp
    },
    {
      kind: 'raw',
      url: 'https://raw.githubusercontent.com/' + config.owner + '/' + config.repo + '/' + config.branch + '/' + mp
    }
  ];
  if (config.cdnBase) out.push({ kind: 'cdn', url: config.cdnBase + '/' + mp });
  return out;
}

function apiUrl(config) {
  return 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/releases/latest';
}

function assetUrls(config, version, name, extraUrls) {
  const gh = repoUrl(config) + '/releases/download/v' + version + '/' + name;
  const urls = [gh];
  if (config.ghProxy) urls.push(config.ghProxy + '/' + gh);
  if (config.cdnBase) urls.push(config.cdnBase + '/' + name);
  for (const u of extraUrls || []) if (u && urls.indexOf(u) < 0) urls.push(u);
  return urls;
}

/* ---------- 版本 ---------- */
function parseVersion(v) {
  const s = String(v || '').trim().replace(/^v/i, '');
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return {
    n: [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)],
    pre: m[4] || ''
  };
}

function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa.n[i] !== pb.n[i]) return pa.n[i] > pb.n[i] ? 1 : -1;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return pa.pre > pb.pre ? 1 : -1;
}

function isNewer(remote, local) { return compareVersions(remote, local) > 0; }

/* ---------- 清单 ---------- */
function isSafeName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) && !/\.\./.test(name);
}

function isHttpUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch (e) { return false; }
}

function validateManifest(m, config) {
  if (!m || typeof m !== 'object') return { ok: false, error: '清单不是对象' };
  if (!parseVersion(m.version)) return { ok: false, error: '清单 version 非法' };
  if (!Array.isArray(m.files) || !m.files.length) return { ok: false, error: '清单 files 为空' };
  const file = m.files.find((f) => f && f.kind === 'nsis') || m.files[0];
  if (!isSafeName(file.name)) return { ok: false, error: '安装包文件名不安全' };
  if (!/^[0-9a-f]{64}$/i.test(String(file.sha256 || ''))) return { ok: false, error: '安装包缺少合法 sha256' };
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: '安装包 size 非法' };
  if (!Array.isArray(file.urls) || !file.urls.length) return { ok: false, error: '安装包没有下载地址' };
  for (const u of file.urls) if (!isHttpUrl(u)) return { ok: false, error: '下载地址非 http(s)' };
  return { ok: true, manifest: m, file, urls: assetUrls(config, m.version, file.name, file.urls) };
}

function parseSums(text, name) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?([^ *]+)/i);
    if (m && m[2] === name) return m[1].toLowerCase();
  }
  return '';
}

/* GitHub API releases/latest → 需要二次抓取的清单地址，或直接构造安装包条目 */
function manifestFromRelease(release, config) {
  if (!release || !release.tag_name) return { ok: false, error: 'Release 无 tag_name' };
  const version = String(release.tag_name).replace(/^v/i, '');
  if (!parseVersion(version)) return { ok: false, error: 'Release tag 非法' };
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const meta = assets.find((a) => a && a.name === 'latest.json');
  if (meta && isHttpUrl(meta.browser_download_url)) {
    return { ok: true, mode: 'manifest', url: meta.browser_download_url, version };
  }
  const exe = assets.find((a) => a && /^TickFlow-Setup-[0-9A-Za-z._-]+\.exe$/i.test(a.name));
  if (!exe || !isHttpUrl(exe.browser_download_url)) return { ok: false, error: 'Release 无安装包资产' };
  const sums = assets.find((a) => a && /^SHA256SUMS/i.test(a.name));
  return {
    ok: true,
    mode: 'asset',
    version,
    file: {
      kind: 'nsis',
      name: exe.name,
      size: Number(exe.size) || 0,
      sha256: '',
      urls: [exe.browser_download_url]
    },
    sumsUrl: sums && isHttpUrl(sums.browser_download_url) ? sums.browser_download_url : ''
  };
}

function decide(manifest, currentVersion, config) {
  if (config && config.minSupported && isNewer(config.minSupported, currentVersion)) {
    return { status: 'blocked', message: '当前版本过旧，请手动安装最新版' };
  }
  if (isNewer(manifest.version, currentVersion)) {
    return { status: 'available', version: manifest.version, notes: String(manifest.notes || ''), publishedAt: String(manifest.publishedAt || '') };
  }
  return { status: 'up-to-date', version: manifest.version };
}

/* ---------- 网络/缓存 ---------- */
function classifyHttp(status, headers) {
  const h = headers || {};
  const remaining = Number(h['x-ratelimit-remaining']);
  if (status === 429 || (status === 403 && (Number.isFinite(remaining) ? remaining <= 0 : true))) return 'rate-limit';
  if (status === 404) return 'not-found';
  if (status >= 500) return 'server';
  return status >= 200 && status < 300 ? 'ok' : 'http';
}

function isCacheFresh(lastCheck, now, hours) {
  const last = Number(lastCheck) || 0;
  return last > 0 && (now - last) < Math.max(1, hours || 24) * 3600 * 1000;
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashMatches(expected, actual) {
  return String(expected || '').toLowerCase() === String(actual || '').toLowerCase();
}

module.exports = {
  DEFAULT_CONFIG,
  normalizeConfig,
  isPlaceholder,
  repoUrl,
  releasePageUrl,
  manifestSources,
  apiUrl,
  assetUrls,
  parseVersion,
  compareVersions,
  isNewer,
  validateManifest,
  parseSums,
  manifestFromRelease,
  decide,
  classifyHttp,
  isCacheFresh,
  sha256Hex,
  hashMatches,
  isSafeName,
  isHttpUrl
};
