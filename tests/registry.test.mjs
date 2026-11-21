import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRenderer } from './harness.mjs';

test('define + start 挂载模块', () => {
  const TF = loadRenderer();
  let inited = 0;
  TF.define('demo', { init() { inited++; } });
  const states = TF.start();
  assert.equal(inited, 1);
  assert.equal(states.find((s) => s.id === 'demo').state, 'mounted');
});

test('依赖先于被依赖者挂载', () => {
  const TF = loadRenderer();
  const order = [];
  TF.define('child', { deps: ['parent'], init() { order.push('child'); } });
  TF.define('parent', { init() { order.push('parent'); } });
  TF.start();
  assert.deepEqual(order, ['parent', 'child']);
});

test('循环依赖直接抛错', () => {
  const TF = loadRenderer();
  TF.define('a', { deps: ['b'] });
  TF.define('b', { deps: ['a'] });
  assert.throws(() => TF.registry.mount('a'), /循环依赖/);
});

test('单模块失败被隔离，不影响其它模块', () => {
  const TF = loadRenderer();
  TF.define('bad', { init() { throw new Error('boom'); } });
  TF.define('good', { init() {} });
  const states = TF.start();
  assert.equal(states.find((s) => s.id === 'bad').state, 'failed');
  assert.equal(states.find((s) => s.id === 'good').state, 'mounted');
});

test('重复注册只保留首个', () => {
  const TF = loadRenderer();
  let count = 0;
  TF.define('dup', { init() { count++; } });
  TF.define('dup', { init() { count++; } });
  TF.start();
  assert.equal(count, 1);
});

test('扩展点：未知 point 抛错，commands 可累加', () => {
  const TF = loadRenderer();
  assert.throws(() => TF.ext.contribute('nope', {}), /未知扩展点/);
  TF.ext.contribute('commands', { k: 'cmd', t: 'A' });
  TF.ext.contribute('commands', { k: 'cmd', t: 'B' });
  assert.deepEqual(Array.from(TF.ext.list('commands'), (c) => c.t), ['A', 'B']);
});

test('总线：订阅返回取消函数，异常不打断其它监听', () => {
  const TF = loadRenderer();
  const seen = [];
  TF.bus.on('x', () => { throw new Error('listener boom'); });
  const off = TF.bus.on('x', (p) => seen.push(p));
  TF.bus.emit('x', 1);
  off();
  TF.bus.emit('x', 2);
  assert.deepEqual(seen, [1]);
});

test('unmount 回到 defined 态，可重复挂载', () => {
  const TF = loadRenderer();
  let mounted = 0;
  TF.define('m', { mount() { mounted++; }, unmount() {} });
  TF.registry.mount('m');
  TF.unmount('m');
  TF.registry.mount('m');
  assert.equal(mounted, 2);
});
