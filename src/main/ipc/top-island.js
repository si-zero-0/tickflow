/* M3 顶部迷你岛：主进程侧唯一窗口管理 + 快照转发 + 动作回传。
 * 边界（03-M3-DUAL-ISLAND）：
 *  - 只做窗口/坐标/透明度/尺寸与消息转发，不碰任何业务数据；
 *  - 主窗（host）是唯一事实源：快照由 host 推、动作回 host 执行；
 *  - 入参一律经 island-protocol 白名单校验后再转发，两边 webContents 互不可见。
 */
const { ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const P = require('./island-protocol');

const APP_DIR = path.join(__dirname, '..', 'www');
const ISLAND_PRELOAD = path.join(__dirname, '..', 'preload-island.js');
const ISLAND_HTML = 'tf://app/top-island.html';

let island = null;
let hostId = null;
let cfg = Object.assign({}, P.DEFAULT_CONFIG);
let hostFullscreen = false;
let lastSnapshot = null;
let pendingReminder = null;
let animTimer = null;

/* 刘海贴屏幕顶边：用 bounds（含任务栏区域），不用 workArea，
   否则任务栏在顶部时会留下一条缝；offsetY 为 0 时窗口上沿与屏幕顶边重合 */
function boundsFor(h) {
  const b = screen.getPrimaryDisplay().bounds;
  const w = cfg.width;
  return {
    x: Math.round(b.x + (b.width - w) / 2 + cfg.offsetX),
    y: Math.round(b.y + cfg.offsetY),
    width: w,
    height: Math.min(P.MAX_H, Math.max(P.COLLAPSED_H, h || P.COLLAPSED_H))
  };
}

function applyBounds(h) {
  if (!island) return;
  try {
    island.setBounds(boundsFor(h));
    island.setOpacity(cfg.opacity);
  } catch (e) { }
}

/* 三态形变：窗口高度用 easeOutBack 逐帧过渡，形成苹果灵动岛式的弹性变形；
   岛内元素保持顶部锚定、布局不重排，只有窗口尺寸在变 */
function stopAnim() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
}
function easeOutBack(p) {
  const c1 = 1.70158, c3 = c1 + 1, q = p - 1;
  return 1 + c3 * q * q * q + c1 * q * q;
}
function animateHeight(target) {
  if (!island) return;
  target = P.clamp(target, P.COLLAPSED_H, P.MAX_H, P.COLLAPSED_H);
  const from = island.getBounds().height;
  if (Math.abs(target - from) <= 1) { stopAnim(); applyBounds(target); return; }
  stopAnim();
  const t0 = Date.now(), dur = 280;
  animTimer = setInterval(() => {
    if (!island) { stopAnim(); return; }
    const p = Math.min(1, (Date.now() - t0) / dur);
    applyBounds(Math.round(from + (target - from) * easeOutBack(p)));
    if (p >= 1) { stopAnim(); applyBounds(target); }
  }, 16);
}

function notifyHost(type, reason) {
  const host = hostId != null ? BrowserWindow.fromId(hostId) : null;
  if (!host || host.isDestroyed()) return;
  try { host.webContents.send('tf:island:status', { type, reason }); } catch (e) { }
}

function destroyIsland(reason) {
  if (!island) return;
  const w = island;
  stopAnim();
  island = null;
  lastSnapshot = null;
  pendingReminder = null;
  try {
    w.removeAllListeners('closed');
    w.destroy();
  } catch (e) { }
  notifyHost('destroyed', reason || 'manual');
}

function createIsland() {
  if (island) return true;
  if (!fs.existsSync(APP_DIR)) return false;
  try {
    island = new BrowserWindow(Object.assign(boundsFor(P.COLLAPSED_H), {
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      title: '刻度 · 顶部岛',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
        preload: ISLAND_PRELOAD
      }
    }));
    island.setAlwaysOnTop(true, 'screen-saver');
    island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    island.once('ready-to-show', () => {
      if (!cfg.enabled || !island) return;
      island.showInactive();
      island.setOpacity(cfg.opacity);
      if (lastSnapshot) island.webContents.send('island:snapshot', lastSnapshot);
      if (pendingReminder) island.webContents.send('island:remind', pendingReminder);
    });
    island.webContents.on('did-finish-load', () => {
      if (!island) return;
      if (lastSnapshot) island.webContents.send('island:snapshot', lastSnapshot);
      if (hostFullscreen && cfg.hideOnFullscreen) island.hide();
    });
    island.on('closed', () => {
      island = null;
      notifyHost('closed', 'window-closed');
    });
    island.loadURL(ISLAND_HTML).catch(() => destroyIsland('load-failed'));
    return true;
  } catch (e) {
    island = null;
    console.error('[top-island] create failed', e);
    return false;
  }
}

function setEnabled(on) {
  cfg.enabled = !!on;
  if (!cfg.enabled) { destroyIsland('disabled'); return { ok: true, enabled: false }; }
  if (!createIsland()) return { ok: false, enabled: false, reason: 'create-failed' };
  applyBounds(P.COLLAPSED_H);
  if (!island) return { ok: false, enabled: false, reason: 'create-failed' };
  if (hostFullscreen && cfg.hideOnFullscreen) island.hide();
  else island.showInactive();
  return { ok: true, enabled: true };
}

const isHost = (sender) => hostId != null && sender && sender.id === hostId;
const isIsland = (sender) => island && sender && sender.id === island.webContents.id;

function register() {
  ipcMain.handle('tf:top-island:configure', (e, raw) => {
    if (!isHost(e.sender)) return { ok: false, reason: 'forbidden' };
    const prevEnabled = cfg.enabled;
    cfg = P.sanitizeConfig(raw);
    if (!cfg.enabled) { destroyIsland('disabled'); return { ok: true, enabled: false }; }
    if (!prevEnabled || !island) return setEnabled(true);
    applyBounds(P.COLLAPSED_H);
    if (island && (hostFullscreen && cfg.hideOnFullscreen)) island.hide();
    else if (island) island.showInactive();
    return { ok: true, enabled: true };
  });

  ipcMain.on('tf:top-island:snapshot', (e, raw) => {
    if (!isHost(e.sender)) return;
    const snap = P.sanitizeSnapshot(raw);
    if (!snap) return;
    lastSnapshot = snap;
    if (snap.m3.width !== cfg.width) { cfg.width = snap.m3.width; applyBounds(P.COLLAPSED_H); }
    cfg.opacity = snap.m3.opacity;
    cfg.radius = snap.m3.radius;
    if (island) {
      try { island.setOpacity(cfg.opacity); } catch (err) { }
      island.webContents.send('island:snapshot', snap);
    }
  });

  ipcMain.on('tf:top-island:remind', (e, task) => {
    if (!isHost(e.sender)) return;
    const t = P.isObj(task) ? {
      id: P.str(task.id, 40), title: P.str(task.title, 200),
      due: P.str(task.due, 10), dueTime: P.str(task.dueTime, 5)
    } : null;
    if (!t || !t.id) return;
    pendingReminder = t;
    if (island) island.webContents.send('island:remind', t);
  });

  ipcMain.on('tf:top-island:dismiss', (e, id) => {
    if (!isHost(e.sender)) return;
    if (island) island.webContents.send('island:dismiss', P.str(id, 40));
  });

  /* 岛 → 主进程 → 主窗：动作只在主窗执行（按 id 幂等） */
  ipcMain.on('island:act', (e, raw) => {
    if (!isIsland(e.sender)) return;
    const action = P.sanitizeAction(raw);
    if (!action) return;
    const host = hostId != null ? BrowserWindow.fromId(hostId) : null;
    if (host && !host.isDestroyed()) {
      if (host.isMinimized()) host.restore();
      try { host.webContents.send('tf:island:action', action); } catch (err) { }
    }
  });

  ipcMain.on('island:resize', (e, h) => {
    if (!isIsland(e.sender)) return;
    animateHeight(h);
  });

  ipcMain.on('island:ready', (e) => {
    if (!isIsland(e.sender)) return;
    if (lastSnapshot) island.webContents.send('island:snapshot', lastSnapshot);
    if (pendingReminder) island.webContents.send('island:remind', pendingReminder);
  });

  ipcMain.on('island:open-main', (e) => {
    if (!isIsland(e.sender)) return;
    const host = hostId != null ? BrowserWindow.fromId(hostId) : null;
    if (!host || host.isDestroyed()) return;
    host.show();
    host.focus();
  });

  ipcMain.on('island:dismissed', (e, id) => {
    if (!isIsland(e.sender)) return;
    pendingReminder = null;
    const host = hostId != null ? BrowserWindow.fromId(hostId) : null;
    if (host && !host.isDestroyed()) host.webContents.send('tf:island:action', { type: 'dismiss-reminder', id: P.str(id, 40) });
  });
}

/* 主窗生命周期：全屏隐藏、主窗关闭时销毁岛 */
function attachHost(win) {
  hostId = win ? win.id : null;
  const applyFs = (on) => {
    hostFullscreen = on;
    if (!island) return;
    if (on && cfg.hideOnFullscreen) island.hide();
    else if (cfg.enabled) island.showInactive();
  };
  if (!win) return;
  win.on('enter-full-screen', () => applyFs(true));
  win.on('leave-full-screen', () => applyFs(false));
  win.on('show', () => { if (cfg.enabled && !hostFullscreen && island) island.showInactive(); });
  win.on('closed', () => { hostId = null; destroyIsland('host-closed'); });
}

function getState() {
  return {
    enabled: cfg.enabled,
    alive: !!island,
    bounds: island ? island.getBounds() : null,
    config: cfg
  };
}

module.exports = {
  name: 'top-island',
  register,
  attachHost,
  setEnabled,
  getState,
  COLLAPSED_H: P.COLLAPSED_H
};
