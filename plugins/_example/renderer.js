/* 示例插件（渲染层）。加载时机：核心 modules 全部挂载后，由宿主按 manifest 顺序注入。
 * 只能使用 TF.* 公开面与 window.tfBridge，不得 require。
 */
(function () {
  'use strict';
  const TF = window.TF;
  if (!TF || !TF.ext) return;

  TF.define('plugin:com.example.hello', {
    deps: [], // 核心模块 id 将在 P0 迁移时登记（core:store / core:bus），当前留空
    init() {
      TF.ext.contribute('commands', {
        k: 'cmd',
        t: '打个招呼（示例插件）',
        i: 'bolt',
        run() {
          TF.toast && TF.toast('Hello from com.example.hello');
          TF.bus.emit('plugin:hello', { at: Date.now() });
        }
      });
    }
  });
})();
