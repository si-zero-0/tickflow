#!/usr/bin/env node
/* 把 renderer 的经典脚本装进一个假 window，按加载顺序跑起来，供测试使用。
 * 用法：const TF = loadRenderer(); loadRenderer(['js/core/store.js']) 等按需追加。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER = path.join(ROOT, 'src', 'renderer');

export function loadRenderer(files = ['js/core/registry.js']) {
  const window = {};
  const sandbox = {
    window,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: { addEventListener() {}, querySelector() { return null; } },
    localStorage: {
      _d: new Map(),
      getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
      setItem(k, v) { this._d.set(k, String(v)); },
      removeItem(k) { this._d.delete(k); }
    },
    location: { hash: '' },
    performance: { now: () => 0 },
    Notification: undefined
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const rel of files) {
    const code = fs.readFileSync(path.join(RENDERER, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  }
  return window.TF;
}

export const rendererPath = RENDERER;
