import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadRenderer, rendererPath } from './harness.mjs';

const require = createRequire(import.meta.url);
const P = require(path.resolve(rendererPath, '..', 'main', 'ipc', 'island-protocol.js'));

/* ---------- 配置白名单 ---------- */
test('sanitizeConfig：默认关闭 + 数值钳制', () => {
  const c = P.sanitizeConfig({ enabled: true, width: 9999, opacity: 0.2, radius: 99, offsetY: -5, offsetX: -5000 });
  assert.equal(c.enabled, true);
  assert.equal(c.width, 640);
  assert.equal(c.opacity, 0.6);      // 20% → 下限 60%
  assert.equal(c.radius, 40);
  assert.equal(c.offsetY, 0);
  assert.equal(c.offsetX, -2000);
  assert.equal(c.position, 'top-center');
});

test('sanitizeConfig：非对象输入回默认（enabled=false）', () => {
  assert.equal(P.sanitizeConfig(null).enabled, false);
  assert.equal(P.sanitizeConfig('x').enabled, false);
  assert.equal(P.sanitizeConfig([]).enabled, false);
  /* 灵动岛形态：默认 26px 圆角（52px 高度下即胶囊）、8px 顶部留缝 */
  assert.equal(P.DEFAULT_CONFIG.radius, 26);
  assert.equal(P.DEFAULT_CONFIG.offsetY, 8);
});

/* ---------- 快照白名单 ---------- */
test('sanitizeSnapshot：未知字段丢弃，字符串截断', () => {
  const raw = {
    version: 'v1.13.0', ts: 1, evil: { cmd: 'rm -rf' },
    theme: { mode: 'light', bg: 'red', panel: '#0F1A2B', accent: '#5AA7FF', text: '#E6EDF7' },
    task: { id: 't1', title: 'A'.repeat(500) },
    counts: { open: 3, today: 2, doneToday: 1 },
    extra: 'drop'
  };
  const s = P.sanitizeSnapshot(raw);
  assert.equal(s.version, 'v1.13.0');
  assert.equal(s.evil, undefined);
  assert.equal(s.extra, undefined);
  assert.equal(s.theme.bg, '#0A1220');          // 非法色回兜底
  assert.equal(s.theme.panel, '#0F1A2B');
  assert.equal(s.task.title.length, 200);       // 截断
});

test('sanitizeSnapshot：数值越界钳制与布尔归一', () => {
  const s = P.sanitizeSnapshot({
    m3: { width: 100, opacity: 2, radius: 1, content: { task: false, count: 0, countdown: 'x', reminders: null, focus: true } },
    focus: { running: 'yes', remain: -1, remainSec: 999999 },
    counts: { open: -10, today: 1e9, doneToday: 'NaN' },
    reminders: Array.from({ length: 8 }, (_, i) => ({ id: 'r' + i, title: 'T' + i })),
    view: { type: 'x'.repeat(80), label: '今天' }
  });
  assert.equal(s.m3.width, 280);
  assert.equal(s.m3.opacity, 1);
  assert.equal(s.m3.radius, 8);
  assert.equal(s.m3.content.task, false);
  assert.equal(s.m3.content.count, true);       // 0 不是 false，按「非 false」处理
  assert.equal(s.focus.running, false);         // 只认严格 true
  assert.equal(s.focus.remain, 0);
  assert.equal(s.focus.remainSec, 86400);
  assert.equal(s.counts.open, 0);
  assert.equal(s.counts.today, 100000);
  assert.equal(s.counts.doneToday, 0);
  assert.equal(s.reminders.length, 4);          // 最多 4 条
  assert.equal(s.view.type.length, 24);
});

test('sanitizeSnapshot：非对象 / 缺省字段安全', () => {
  assert.equal(P.sanitizeSnapshot(null), null);
  const s = P.sanitizeSnapshot({});
  assert.equal(s.task, null);
  assert.equal(s.theme.mode, 'dark');
  assert.deepEqual(s.counts, { open: 0, doneToday: 0, today: 0 });
});

/* ---------- 动作白名单 ---------- */
test('sanitizeAction：只放行白名单动作，id 截断', () => {
  assert.equal(P.sanitizeAction({ type: 'run-shell' }), null);
  assert.equal(P.sanitizeAction({ type: 'toggle-task', id: 'x'.repeat(80) }).id.length, 40);
  assert.equal(P.sanitizeAction({ type: 'open-task' }).type, 'open-task');
  assert.equal(P.sanitizeAction('toggle-task'), null);
  assert.deepEqual(P.ACTIONS.length, 7);
});

/* ---------- Store 侧 M3 默认值 ---------- */
test('m3 默认：关闭、顶部居中、内容开关全开；越界值迁移时钳制', () => {
  const TF = loadRenderer(['js/core/store.js']);
  const d = TF.Store.migrate({
    settings: { m3: { enabled: true, width: 10, radius: 0, offsetY: 9999, opacity: 4, reminderOwner: 'nope' } },
    tasks: [], lists: [], habits: [], processes: [], wishes: [], profiles: []
  });
  assert.equal(d.settings.m3.enabled, true);
  assert.equal(d.settings.m3.width, 280);
  assert.equal(d.settings.m3.radius, 8);
  assert.equal(d.settings.m3.offsetY, 800);
  assert.equal(d.settings.m3.opacity, 1);
  assert.equal(d.settings.m3.reminderOwner, 'top');
  assert.equal(d.settings.m3.content.task, true);
});
