/* IPC 注册入口：每个域一个文件，新增域只改这里一行。
 * 频道命名：tf:<域>:<动作>；一律 ipcMain.handle（渲染层用 invoke）；仅托盘/快捷键这类主动指令用 tf:command 单向推送。
 */
const appInfo = require('./app');
const plugins = require('./plugins');
const shell = require('./shell');
const topIsland = require('./top-island');
const update = require('./update');

const domains = [appInfo, plugins, shell, topIsland, update];

function register() {
  domains.forEach((domain) => {
    try {
      domain.register();
    } catch (e) {
      console.error('[ipc] 注册失败: ' + domain.name, e);
    }
  });
  return domains.map((d) => d.name);
}

module.exports = { register, domains };
