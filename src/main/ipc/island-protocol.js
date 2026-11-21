/* 顶部岛协议：纯函数校验层（无 electron 依赖，便于单测）。
 * 原则：主窗快照与设置全部视为不可信输入，过白名单 + 截断 + 钳制后才转发。
 */
const COLLAPSED_H = 52;
const MAX_H = 420;

const clamp = (v, lo, hi, fb) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const isColor = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '')) || /^rgba?\(\s*\d/.test(String(v || ''));

const DEFAULT_CONFIG = {
  enabled: false,
  position: 'top-center',
  monitor: 'primary',
  offsetX: 0,
  offsetY: 8,
  width: 360,
  opacity: 1,
  radius: 26,
  content: {},
  hideOnFullscreen: true,
  minimal: false
};

function sanitizeConfig(raw) {
  if (!isObj(raw)) return Object.assign({}, DEFAULT_CONFIG);
  return {
    enabled: raw.enabled === true,
    position: 'top-center',
    monitor: raw.monitor === 'cursor' ? 'cursor' : 'primary',
    offsetX: clamp(raw.offsetX, -2000, 2000, 0),
    offsetY: clamp(raw.offsetY, 0, 800, 8),
    width: clamp(raw.width, 280, 640, 360),
    opacity: clamp((Number(raw.opacity) || 1) * 100, 60, 100, 100) / 100,
    radius: clamp(raw.radius, 8, 40, 26),
    content: isObj(raw.content) ? raw.content : {},
    hideOnFullscreen: raw.hideOnFullscreen !== false,
    minimal: raw.minimal === true
  };
}

function sanitizeSnapshot(raw) {
  if (!isObj(raw)) return null;
  const t = isObj(raw.theme) ? raw.theme : {};
  const m = isObj(raw.m3) ? raw.m3 : {};
  const task = isObj(raw.task) ? raw.task : null;
  const c = isObj(raw.counts) ? raw.counts : {};
  const f = isObj(raw.focus) ? raw.focus : {};
  const v = isObj(raw.view) ? raw.view : {};
  const reminders = Array.isArray(raw.reminders) ? raw.reminders.slice(0, 4) : [];
  return {
    version: str(raw.version, 16),
    ts: clamp(raw.ts, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    theme: {
      mode: t.mode === 'light' ? 'light' : 'dark',
      scheme: str(t.scheme, 24),
      bg: isColor(t.bg) ? String(t.bg) : '#0A1220',
      panel: isColor(t.panel) ? String(t.panel) : '#0F1A2B',
      border: isColor(t.border) ? String(t.border) : '#1E2F47',
      text: isColor(t.text) ? String(t.text) : '#E6EDF7',
      text2: isColor(t.text2) ? String(t.text2) : '#9AAEC8',
      text3: isColor(t.text3) ? String(t.text3) : '#7A8DA8',
      accent: isColor(t.accent) ? String(t.accent) : '#5AA7FF',
      accentInk: isColor(t.accentInk) ? String(t.accentInk) : '#07101E'
    },
    m3: {
      width: clamp(m.width, 280, 640, 360),
      opacity: clamp((Number(m.opacity) || 1) * 100, 60, 100, 100) / 100,
      radius: clamp(m.radius, 8, 40, 26),
      minimal: m.minimal === true,
      content: isObj(m.content) ? {
        task: m.content.task !== false,
        count: m.content.count !== false,
        countdown: m.content.countdown !== false,
        reminders: m.content.reminders !== false,
        focus: m.content.focus !== false
      } : {}
    },
    view: { type: str(v.type, 24), label: str(v.label, 40) },
    task: task ? {
      id: str(task.id, 40),
      title: str(task.title, 200),
      due: str(task.due, 10),
      dueTime: str(task.dueTime, 5),
      pri: clamp(task.pri, 0, 3, 0),
      start: str(task.start, 10),
      startTime: str(task.startTime, 5),
      pomo: isObj(task.pomo) ? { remain: clamp(task.pomo.remain, 0, 86400, 0) } : null
    } : null,
    counts: {
      open: clamp(c.open, 0, 100000, 0),
      doneToday: clamp(c.doneToday, 0, 100000, 0),
      today: clamp(c.today, 0, 100000, 0)
    },
    focus: {
      running: f.running === true,
      remain: clamp(f.remain, 0, 86400, 0),
      rule: str(f.rule, 4),
      remainSec: clamp(f.remainSec, 0, 86400, 0)
    },
    reminders: reminders.filter(isObj).map(r => ({
      id: str(r.id, 40), title: str(r.title, 200), due: str(r.due, 10), dueTime: str(r.dueTime, 5)
    }))
  };
}

/* 岛动作白名单：只放行 7 种，其余丢弃（防止主窗执行任意命令） */
const ACTIONS = ['toggle-task', 'open-task', 'open-main', 'toggle-focus', 'start-focus', 'open-settings', 'dismiss-reminder'];
function sanitizeAction(raw) {
  if (!isObj(raw) || ACTIONS.indexOf(raw.type) < 0) return null;
  return { type: raw.type, id: str(raw.id, 40) };
}

module.exports = {
  COLLAPSED_H,
  MAX_H,
  DEFAULT_CONFIG,
  ACTIONS,
  clamp,
  isObj,
  str,
  sanitizeConfig,
  sanitizeSnapshot,
  sanitizeAction
};
