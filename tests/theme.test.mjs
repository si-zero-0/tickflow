import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRenderer } from './harness.mjs';

/* 只加载 store.js（提供 TF.ymd 等工具与 TF.Store）+ theme.js（被测对象） */
const TF = loadRenderer(['js/core/store.js', 'js/modules/theme.js']);

const THEME_IDS = ['graphite', 'night', 'tundra', 'dawn', 'mist', 'paper'];
const MODES = { graphite: 'dark', night: 'dark', tundra: 'dark', dawn: 'light', mist: 'light', paper: 'light' };
/* DESIGN §5.2.2 全表：12 个中性色 + ac + 3 个阴影 */
const TOKEN_KEYS = ['bg', 'bg2', 'panel', 'panel2', 'elev', 'line', 'line2', 'cbx', 'edge', 'tx', 'tx2', 'tx3', 'ac', 'sh1', 'sh2', 'sh3'];
const ACCENT_IDS = ['blue', 'cyan', 'green', 'purple', 'orange', 'rose'];

/* ---------- WCAG 2.1：sRGB 线性化 + 相对亮度 + 对比度（与 DESIGN §5.2.2 同一公式） ---------- */
function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const s = String(hex).replace('#', '');
  const r = channel(parseInt(s.slice(0, 2), 16));
  const g = channel(parseInt(s.slice(2, 4), 16));
  const b = channel(parseInt(s.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

test('主题表结构：6 套、id 与顺序固定、mode 正确', () => {
  assert.equal(TF.THEMES.length, 6);
  assert.equal(Array.from(TF.THEMES, (t) => t.id).join(','), THEME_IDS.join(','));
  TF.THEMES.forEach((t) => {
    assert.equal(t.mode, MODES[t.id], `${t.id} 的 mode 应为 ${MODES[t.id]}`);
    assert.ok(t.name && typeof t.name === 'string', `${t.id} 缺中文名`);
    assert.match(t.bg, /^#[0-9A-F]{6}$/i);
    assert.match(t.panel, /^#[0-9A-F]{6}$/i);
    assert.match(t.ac, /^#[0-9A-F]{6}$/i);
    assert.ok(t.tokens && typeof t.tokens === 'object', `${t.id} 缺 tokens`);
  });
});

test('每套主题的 tokens 齐全（预览卡不依赖 getComputedStyle）', () => {
  TF.THEMES.forEach((t) => {
    TOKEN_KEYS.forEach((k) => {
      const v = t.tokens[k];
      assert.equal(typeof v, 'string', `${t.id}.tokens.${k} 缺失`);
      assert.ok(v.trim().length > 0, `${t.id}.tokens.${k} 为空`);
    });
    // 预览卡三块取色必须与 theme 顶层一致
    assert.equal(t.tokens.bg, t.bg);
    assert.equal(t.tokens.panel, t.panel);
    assert.equal(t.tokens.ac, t.ac);
  });
});

test('强调色表结构：6 条、id 固定、四个档位都是 hex、hue 在 0~360', () => {
  assert.equal(TF.ACCENTS.length, 6);
  assert.equal(Array.from(TF.ACCENTS, (a) => a.id).join(','), ACCENT_IDS.join(','));
  TF.ACCENTS.forEach((a) => {
    ['dark', 'light', 'dark2', 'light2'].forEach((k) => {
      assert.match(a[k], /^#[0-9A-F]{6}$/i, `${a.id}.${k} 不是合法 hex`);
    });
    assert.equal(typeof a.hue, 'number');
    assert.ok(a.hue >= 0 && a.hue <= 360, `${a.id}.hue 越界`);
  });
});

test('对比度门槛：正文与元信息对 --bg / --panel 双底均 ≥ 4.5', () => {
  TF.THEMES.forEach((t) => {
    ['tx', 'tx2', 'tx3'].forEach((k) => {
      const worst = Math.min(contrast(t.tokens[k], t.tokens.bg), contrast(t.tokens[k], t.tokens.panel));
      assert.ok(worst >= 4.5, `${t.id}.${k} 对比度 ${worst.toFixed(2)} < 4.5`);
    });
  });
});

test('hexToAccent：旧 hex 映射到枚举，非法输入兜底 blue', () => {
  assert.equal(TF.hexToAccent('#5B8CFF'), 'blue');
  assert.equal(TF.hexToAccent('#5b8cff'), 'blue');   // 大小写变体
  assert.equal(TF.hexToAccent('#ff00aa'), 'rose');
  assert.equal(TF.hexToAccent('#25C2D4'), 'cyan');
  assert.equal(TF.hexToAccent('rose'), 'rose');      // 已是枚举直通
  assert.equal(TF.hexToAccent(''), 'blue');
  assert.equal(TF.hexToAccent(null), 'blue');
  assert.equal(TF.hexToAccent('随便什么'), 'blue');
  assert.equal(TF.hexToAccent('#12'), 'blue');
});

test('themeLabel：Store 未 load 时回退 graphite · 蓝', () => {
  assert.equal(TF.themeLabel(), '石墨 · 蓝');
});

test('applyTheme 在无 documentElement 的环境下不抛错（纯 dataset 写入）', () => {
  assert.doesNotThrow(() => TF.applyTheme());
  assert.doesNotThrow(() => TF.applyTheme({ anim: true }));
});
