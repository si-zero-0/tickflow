import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../src/main/ipc/update-core.js');

const cfg = core.normalizeConfig({ owner: 'acme', repo: 'tickflow', branch: 'main' });
const sha = 'a'.repeat(64);

function manifest(version, over) {
  return Object.assign({
    version,
    minSupported: '1.12.0',
    notes: 'test',
    files: [{
      kind: 'nsis',
      name: 'TickFlow-Setup-' + version + '.exe',
      size: 12,
      sha256: sha,
      urls: ['https://github.com/acme/tickflow/releases/download/v' + version + '/TickFlow-Setup-' + version + '.exe']
    }]
  }, over || {});
}

test('版本比较：相等 / 更新 / 更旧 / 前缀 v', () => {
  assert.equal(core.compareVersions('1.13.0', '1.13.0'), 0);
  assert.equal(core.compareVersions('1.13.1', '1.13.0'), 1);
  assert.equal(core.compareVersions('1.12.9', '1.13.0'), -1);
  assert.equal(core.compareVersions('v1.14.0', '1.13.0'), 1);
  assert.equal(core.isNewer('1.13.1', '1.13.0'), true);
});

test('清单校验：合法通过，坏 sha / 危险文件名 / 空地址被拒绝', () => {
  const ok = core.validateManifest(manifest('1.13.1'), cfg);
  assert.equal(ok.ok, true);
  assert.match(ok.urls[0], /github\.com\/acme\/tickflow/);
  assert.equal(core.validateManifest(manifest('1.13.1', { files: [{ kind: 'nsis', name: 'x.exe', size: 1, sha256: 'xyz', urls: ['https://a'] }] }), cfg).ok, false);
  assert.equal(core.validateManifest(manifest('1.13.1', { files: [{ kind: 'nsis', name: '../x.exe', size: 1, sha256: sha, urls: ['https://a'] }] }), cfg).ok, false);
  assert.equal(core.validateManifest(manifest('1.13.1', { files: [{ kind: 'nsis', name: 'x.exe', size: 1, sha256: sha, urls: [] }] }), cfg).ok, false);
});

test('决策：已是最新 / 有新版 / 低于最低支持', () => {
  assert.equal(core.decide(manifest('1.13.0'), '1.13.0', cfg).status, 'up-to-date');
  const av = core.decide(manifest('1.13.1'), '1.13.0', cfg);
  assert.equal(av.status, 'available');
  assert.equal(av.version, '1.13.1');
  const blocked = core.decide(manifest('1.14.0'), '1.11.0', cfg);
  assert.equal(blocked.status, 'blocked');
});

test('清单多源顺序：jsDelivr → raw →（可选）CDN；GitHub API 单独兜底', () => {
  const s = core.manifestSources(cfg);
  assert.deepEqual(s.map((x) => x.kind), ['jsdelivr', 'raw']);
  assert.match(s[0].url, /cdn\.jsdelivr\.net\/gh\/acme\/tickflow@main\/update\/latest\.json$/);
  assert.match(s[1].url, /raw\.githubusercontent\.com\/acme\/tickflow\/main\/update\/latest\.json$/);
  const withCdn = core.normalizeConfig({ owner: 'acme', repo: 'tickflow', cdnBase: 'https://cdn.example.com/tickflow/' });
  assert.deepEqual(core.manifestSources(withCdn).map((x) => x.kind), ['jsdelivr', 'raw', 'cdn']);
  assert.equal(core.apiUrl(cfg), 'https://api.github.com/repos/acme/tickflow/releases/latest');
});

test('HTTP 分类：限流 / 404 / 5xx', () => {
  assert.equal(core.classifyHttp(200, {}), 'ok');
  assert.equal(core.classifyHttp(403, { 'x-ratelimit-remaining': '0' }), 'rate-limit');
  assert.equal(core.classifyHttp(429, {}), 'rate-limit');
  assert.equal(core.classifyHttp(404, {}), 'not-found');
  assert.equal(core.classifyHttp(503, {}), 'server');
});

test('24h 缓存：未过期命中，过期失效', () => {
  const now = 1000000000000;
  assert.equal(core.isCacheFresh(now - 3600 * 1000, now, 24), true);
  assert.equal(core.isCacheFresh(now - 30 * 3600 * 1000, now, 24), false);
  assert.equal(core.isCacheFresh(0, now, 24), false);
});

test('GitHub API 兜底：优先 latest.json 资产，否则 exe + SHA256SUMS', () => {
  const rel = {
    tag_name: 'v1.13.1',
    assets: [
      { name: 'latest.json', browser_download_url: 'https://x/latest.json' },
      { name: 'TickFlow-Setup-1.13.1.exe', size: 12, browser_download_url: 'https://x/a.exe' },
      { name: 'SHA256SUMS.txt', browser_download_url: 'https://x/sums.txt' }
    ]
  };
  const m1 = core.manifestFromRelease(rel, cfg);
  assert.equal(m1.ok, true);
  assert.equal(m1.mode, 'manifest');
  assert.equal(m1.url, 'https://x/latest.json');
  const m2 = core.manifestFromRelease(Object.assign({}, rel, { assets: rel.assets.slice(1) }), cfg);
  assert.equal(m2.mode, 'asset');
  assert.equal(m2.file.name, 'TickFlow-Setup-1.13.1.exe');
  assert.equal(m2.sumsUrl, 'https://x/sums.txt');
  const m3 = core.manifestFromRelease({ tag_name: 'v1.13.1', assets: [] }, cfg);
  assert.equal(m3.ok, false);
});

test('SHA256SUMS 解析与哈希比对', () => {
  const text = sha + '  TickFlow-Setup-1.13.1.exe\n';
  assert.equal(core.parseSums(text, 'TickFlow-Setup-1.13.1.exe'), sha);
  assert.equal(core.parseSums(text, 'other.exe'), '');
  assert.equal(core.hashMatches(sha, sha.toUpperCase()), true);
  assert.equal(core.hashMatches(sha, 'b'.repeat(64)), false);
  assert.equal(core.sha256Hex('MOCK-OK'), crypto.createHash('sha256').update('MOCK-OK').digest('hex'));
});

test('占位仓库识别：OWNER/REPO 未配置', () => {
  assert.equal(core.isPlaceholder(core.normalizeConfig({})), true);
  assert.equal(core.isPlaceholder(cfg), false);
});
