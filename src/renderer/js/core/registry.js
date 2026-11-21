/* 刻度 TickFlow · 模块注册表与扩展点
 * 加载顺序：store.js → registry.js → modules/*.js → app.js
 * 目的：新增功能不再改 app.js，也不再依赖 index.html 里手写 <script> 顺序。
 *
 *   TF.define('my-module', { deps: ['Store'], init(ctx) { ... } })
 *   TF.mount('my-module')      // 立即挂载（依赖未挂载会先递归解析）
 *   TF.start()                 // 挂载全部已注册模块
 *   TF.ext.contribute('commands', { k:'cmd', t:'我的命令', i:'bolt', run(){} })
 *   TF.bus.on('task:created', fn)
 */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  /* ---------- 事件总线 ---------- */
  const listeners = new Map();
  const bus = TF.bus = {
    on(evt, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => bus.off(evt, fn);
    },
    off(evt, fn) {
      const set = listeners.get(evt);
      if (set) set.delete(fn);
    },
    emit(evt, payload) {
      const set = listeners.get(evt);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try { fn(payload, evt); } catch (e) { console.error('[bus] ' + evt, e); }
      }
    }
  };

  /* ---------- 扩展点 ---------- */
  const POINTS = ['commands', 'views', 'renderers', 'themes'];
  const store = Object.create(null);
  POINTS.forEach(p => { store[p] = []; });

  const ext = TF.ext = {
    points: POINTS.slice(),
    contribute(point, item) {
      if (!POINTS.includes(point)) throw new Error('未知扩展点: ' + point);
      if (!item || typeof item !== 'object') throw new Error('扩展项必须是对象: ' + point);
      store[point].push(item);
      bus.emit('ext:' + point, item);
      return item;
    },
    list(point) {
      return store[point] ? store[point].slice() : [];
    }
  };

  /* ---------- 模块注册表 ---------- */
  const modules = new Map();

  function define(id, def) {
    if (!id || typeof id !== 'string') throw new Error('模块 id 必须是字符串');
    if (modules.has(id)) {
      console.warn('[registry] 重复注册，已忽略: ' + id);
      return modules.get(id);
    }
    const mod = {
      id,
      deps: Array.isArray(def && def.deps) ? def.deps.slice() : [],
      init: def && typeof def.init === 'function' ? def.init : null,
      mount: def && typeof def.mount === 'function' ? def.mount : null,
      unmount: def && typeof def.unmount === 'function' ? def.unmount : null,
      state: 'defined',
      error: null
    };
    modules.set(id, mod);
    return mod;
  }

  function mount(id, seen) {
    const mod = modules.get(id);
    if (!mod) throw new Error('模块未注册: ' + id);
    if (mod.state === 'mounted' || mod.state === 'mounting') return mod;

    seen = seen || new Set();
    if (seen.has(id)) throw new Error('循环依赖: ' + Array.from(seen).join(' → ') + ' → ' + id);
    seen.add(id);

    for (const dep of mod.deps) mount(dep, seen);

    mod.state = 'mounting';
    try {
      const ctx = { id: mod.id, TF, bus, ext, Store: TF.Store || null };
      if (mod.init) mod.init(ctx);
      if (mod.mount) mod.mount(ctx);
      mod.state = 'mounted';
      bus.emit('module:mounted', mod.id);
    } catch (e) {
      mod.state = 'failed';
      mod.error = e;
      console.error('[registry] 挂载失败: ' + id, e);
    }
    return mod;
  }

  function start() {
    for (const id of modules.keys()) {
      if (modules.get(id).state !== 'defined') continue;
      try {
        mount(id);
      } catch (e) {
        const mod = modules.get(id);
        mod.state = 'failed';
        mod.error = e;
        console.error('[registry] 启动失败: ' + id, e);
      }
    }
    return summary();
  }

  function unmount(id) {
    const mod = modules.get(id);
    if (!mod || mod.state !== 'mounted') return false;
    try { if (mod.unmount) mod.unmount({ id: mod.id, TF }); } catch (e) { console.error('[registry] 卸载失败: ' + id, e); }
    mod.state = 'defined';
    bus.emit('module:unmounted', id);
    return true;
  }

  function summary() {
    return Array.from(modules.values()).map(m => ({ id: m.id, state: m.state, error: m.error ? String(m.error) : null }));
  }

  TF.registry = {
    define,
    mount: (id) => { mount(id); return summary(); },
    unmount,
    start,
    has: (id) => modules.has(id),
    list: summary,
    get: (id) => modules.get(id) || null
  };
  TF.define = define;
  TF.start = start;
  TF.unmount = unmount;
})();
