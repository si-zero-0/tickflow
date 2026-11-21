import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRenderer, rendererPath } from './harness.mjs';

const TF = loadRenderer(['js/core/store.js', 'js/modules/appearance.js']);
const schemes = JSON.parse(fs.readFileSync(path.join(rendererPath, 'data', 'schemes.json'), 'utf8'));

/* 让 appearance 有 Store 可读写（首次 load 会 seed 示例数据） */
TF.Store.load();
/* 单测直接注入 schemes.json，不依赖 fetch */
TF.registerSchemes(schemes);

/* WCAG 2.1 对比度（与 tests/theme.test.mjs 同一公式） */
function channel(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const s = String(hex).replace('#', '');
  return 0.2126 * channel(parseInt(s.slice(0, 2), 16)) + 0.7152 * channel(parseInt(s.slice(2, 4), 16)) + 0.0722 * channel(parseInt(s.slice(4, 6), 16));
}
function contrast(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('schemes.json：9 套方案 × 浅/深两档，token 齐全', () => {
  const ids = ['kun-default', 'sky', 'parchment', 'mint', 'sakura', 'dusk', 'amber', 'ink', 'custom'];
  assert.deepEqual(Object.keys(schemes.schemes).sort(), ids.slice().sort());
  for (const id of ids) {
    for (const mode of ['dark', 'light']) {
      const t = schemes.schemes[id][mode];
      assert.ok(t, `${id}.${mode} 缺失`);
      for (const k of ['bg', 'panel', 'panel2', 'panel3', 'border', 'borderStrong', 'text', 'text2', 'text3', 'accent', 'accentInk']) {
        assert.match(String(t[k] || ''), /^#([0-9A-F]{3}|[0-9A-F]{6})$/i, `${id}.${mode}.${k} 不是 hex`);
      }
    }
  }
});

test('对比度门槛：9 套 × 2 档，正文/元信息对 bg 与 panel 均 ≥ 4.5', () => {
  for (const id of Object.keys(schemes.schemes)) {
    for (const mode of ['dark', 'light']) {
      const t = schemes.schemes[id][mode];
      for (const k of ['text', 'text2', 'text3']) {
        const worst = Math.min(contrast(t[k], t.bg), contrast(t[k], t.panel));
        assert.ok(worst >= 4.5, `${id}.${mode}.${k} 对比度 ${worst.toFixed(2)} < 4.5`);
      }
    }
  }
});

test('外观归一：非法 mode/scheme 回默认，字号与宽度按范围钳制', () => {
  const a = TF.applyAppearance({ mode: 'purple', scheme: 'nope', fontSize: 999, contentWidth: 100 });
  assert.equal(a.mode, 'dark');
  assert.equal(a.scheme, 'kun-default');
  assert.equal(a.fontSize, 120);
  assert.equal(a.contentWidth, 640);
  const b = TF.applyAppearance({ fontSize: 1, contentWidth: 4000 });
  assert.equal(b.fontSize, 70);
  assert.equal(b.contentWidth, 1200);
});

test('外观归一：accentOverride 只接受 hex，非法回落 null', () => {
  assert.equal(TF.applyAppearance({ accentOverride: '#12' }).accentOverride, null);
  assert.equal(TF.applyAppearance({ accentOverride: 'rgb(1,2,3)' }).accentOverride, null);
  assert.equal(TF.applyAppearance({ accentOverride: '#AABBCC' }).accentOverride, '#AABBCC');
  assert.equal(TF.applyAppearance({ accentOverride: null }).accentOverride, null);
});

test('custom 四色归一：非法色回默认，合法保留', () => {
  const a = TF.applyAppearance({ custom: { bg: 'oops', panel: '#112233', border: 'x', accent: '#00FF00' } });
  assert.equal(a.custom.bg, '#0A1220');
  assert.equal(a.custom.panel, '#112233');
  assert.equal(a.custom.border, '#1E2F47');
  assert.equal(a.custom.accent, '#00FF00');
});

test('appearanceTokens：跟随 Store 当前方案，切换后 token 变化', () => {
  TF.applyAppearance({ scheme: 'mint', mode: 'light' });
  const t = TF.appearanceTokens();
  const src = schemes.schemes.mint.light;
  assert.equal(t.bg.toUpperCase(), src.bg.toUpperCase());
  assert.equal(t.accent.toUpperCase(), src.accent.toUpperCase());
  assert.equal(t.text.toUpperCase(), src.text.toUpperCase());
});

test('accentOverride 覆盖方案强调色且派生 accentInk/soft', () => {
  TF.applyAppearance({ scheme: 'kun-default', mode: 'dark', accentOverride: '#FF66AA' });
  const t = TF.appearanceTokens();
  assert.equal(t.accent, '#FF66AA');
  assert.equal(t.accentInk, '#07101E');
  assert.match(t.accentSoft, /^rgba\(/);
});

test('custom 方案：明暗由背景亮度决定，默认值仍满足 4.5', () => {
  TF.applyAppearance({ scheme: 'custom', mode: 'light', custom: { bg: '#0A1220', panel: '#0F1A2B', border: '#1E2F47', accent: '#5AA7FF' } });
  const t = TF.appearanceTokens();
  assert.equal(t.text.toUpperCase(), schemes.schemes['kun-default'].dark.text.toUpperCase());
  for (const k of ['text', 'text2', 'text3']) {
    assert.ok(Math.min(contrast(t[k], t.bg), contrast(t[k], t.panel)) >= 4.5, `custom.${k} 对比度不足`);
  }
});

test('浅色切换：dark+sakura → light+sakura，方案保留且取浅色档 surface', () => {
  TF.applyAppearance({ scheme: 'sakura', mode: 'dark' });
  assert.equal(TF.appearanceTokens().bg.toUpperCase(), schemes.schemes.sakura.dark.bg.toUpperCase());
  TF.applyAppearance({ mode: 'light' });
  const a = TF.getAppearance();
  assert.equal(a.scheme, 'sakura');                       // 切明暗不得重置方案
  const t = TF.appearanceTokens();
  assert.equal(t.bg.toUpperCase(), schemes.schemes.sakura.light.bg.toUpperCase());
  assert.equal(t.text.toUpperCase(), schemes.schemes.sakura.light.text.toUpperCase());
});

test('schemePreview：返回两档真实 token，供设置页卡片取色', () => {
  const pv = TF.schemePreview('sakura');
  assert.equal(pv.dark.bg.toUpperCase(), schemes.schemes.sakura.dark.bg.toUpperCase());
  assert.equal(pv.light.bg.toUpperCase(), schemes.schemes.sakura.light.bg.toUpperCase());
});

test('v1.12 → v1.13 迁移：theme/accent 推导 appearance，旧字段保留', () => {
  const old = {
    version: 1,
    settings: { theme: 'night', accent: 'rose', density: 'compact', showDone: true, island: { enabled: true, autoExpand: true }, pomo: { work: 25, short: 5, long: 15, rounds: 4 }, lastBackup: null },
    tasks: [], lists: [], habits: [], processes: [], wishes: [], profiles: [], activeProfile: 'p0', snaps: []
  };
  const d = TF.Store.migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(d.settings.appearance.scheme, 'ink');
  assert.equal(d.settings.appearance.mode, 'dark');
  assert.equal(d.settings.appearance.accentOverride, '#FF5F7A');
  assert.equal(d.settings.theme, 'night');       // 旧字段保留一年，便于回滚
  assert.equal(d.settings.accent, 'rose');
  assert.equal(d.settings.island, undefined);    // 灵动岛移除后旧字段丢弃
  assert.equal(d.settings.m3, undefined);
});
